/**
 * gemini.ts
 *
 * Google Gemini 2.0 Flash client — used for:
 *   1. Batch sentiment analysis (up to 50 reviews per call)
 *   2. ASO keyword suggestions (one call per app per 24h, cached in Redis)
 *
 * Free tier: 1,500 requests/day, 10 requests/minute.
 * All inputs are compressed before sending to minimise token usage.
 *
 * Both functions throw on unrecoverable errors — callers should try/catch
 * and fall back to rule-based results gracefully.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AppReview, ReviewSentiment } from "@/types/review";
import { compressReviewText } from "@/lib/prompt-utils";

// ── generateReplyWithGemini ───────────────────────────────────────────────────

/**
 * Generate a reply to an app store review using Gemini Flash.
 * Used as fallback when Groq is unavailable or rate-limited.
 * Throws "AI_UNAVAILABLE" on failure.
 */
export async function generateReplyWithGemini(params: {
  reviewBody: string;
  rating: number;
  tone: string;
  systemPrompt: string;
  charLimit?: number;
}): Promise<string> {
  const { reviewBody, rating, tone: _tone, systemPrompt, charLimit } = params;
  void _tone; // used via systemPrompt

  const client = getGeminiClient();
  const model  = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
  });

  const charNote = charLimit ? ` Stay under ${charLimit} characters.` : "";
  const userContent = `Rating: ${rating}/5\n\nReview: ${reviewBody}${charNote}`;

  try {
    const result = await model.generateContent(userContent);
    const text   = result.response.text().trim();
    if (!text) throw new Error("AI_UNAVAILABLE");
    return text;
  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") throw err;
    throw new Error("AI_UNAVAILABLE");
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-exp";

// ── Singleton client ──────────────────────────────────────────────────────────

let _client: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SentimentResult {
  id: string;
  sentiment: ReviewSentiment;
  /** Coarse topic: one of crash | login | performance | pricing | general */
  primaryTopic: string;
  /** Model confidence 0-1 */
  confidence: number;
}

// ── analyzeSentimentBatch ─────────────────────────────────────────────────────

/**
 * Analyse sentiment for a batch of reviews in a single Gemini call.
 *
 * Each review is compressed to: `ID:${id} R:${rating} "${text120}"`
 * The model returns a JSON array matching the input order.
 *
 * @param reviews  Array of reviews — caller must chunk to ≤50 before calling.
 * @throws         On API error or unparseable JSON response.
 */
export async function analyzeSentimentBatch(
  reviews: AppReview[],
): Promise<SentimentResult[]> {
  if (reviews.length === 0) return [];

  const client = getGeminiClient();
  const model  = client.getGenerativeModel({ model: GEMINI_MODEL });

  // Build compact per-review lines
  const lines = reviews
    .map((r) => {
      const compressed = compressReviewText(r.text ?? "", 120);
      return `ID:${r.id} R:${r.rating} "${compressed}"`;
    })
    .join("\n");

  const prompt =
    `Analyse the sentiment of each app store review below.\n` +
    `Return ONLY a JSON array (no markdown, no prose) with one object per review in the same order.\n` +
    `Each object: { "id": string, "sentiment": "critical"|"negative"|"mixed"|"positive", "primaryTopic": "crash"|"login"|"performance"|"pricing"|"general", "confidence": 0-1 }\n\n` +
    lines;

  const result = await model.generateContent(prompt);
  const raw    = result.response.text().trim();

  // Strip any accidental markdown code fences
  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: SentimentResult[];
  try {
    parsed = JSON.parse(json) as SentimentResult[];
  } catch {
    throw new Error(`Gemini returned unparseable JSON: ${json.slice(0, 200)}`);
  }

  // Validate shape — fall back to "mixed" for any malformed entries
  return parsed.map((item, i) => ({
    id:           item.id           ?? reviews[i]?.id ?? String(i),
    sentiment:    isValidSentiment(item.sentiment) ? item.sentiment : "mixed",
    primaryTopic: item.primaryTopic ?? "general",
    confidence:   typeof item.confidence === "number" ? item.confidence : 0.5,
  }));
}

function isValidSentiment(s: unknown): s is ReviewSentiment {
  return (
    s === "critical" || s === "negative" || s === "mixed" || s === "positive"
  );
}

// ── estimateKeywordVolume ─────────────────────────────────────────────────────

/**
 * Returns a rough monthly search volume estimate for a keyword on the Play Store.
 * Gemini produces a single integer — caller should treat it as order-of-magnitude.
 * Returns null on failure (caller falls back to showing no volume).
 */
export async function estimateKeywordVolume(keyword: string): Promise<number | null> {
  try {
    const client = getGeminiClient();
    const model  = client.getGenerativeModel({ model: GEMINI_MODEL });

    const prompt =
      `You are an App Store Optimisation expert.\n` +
      `Estimate the approximate monthly Google Play search volume for the keyword: "${keyword}"\n` +
      `Return ONLY a single integer (no units, no text). Examples: 500, 2000, 15000, 80000`;

    const result = await model.generateContent(prompt);
    const raw    = result.response.text().trim().replace(/[^0-9]/g, "");
    const num    = parseInt(raw, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

// ── suggestAsoKeywords ────────────────────────────────────────────────────────

interface AsoSuggestParams {
  appName: string;
  appDescription: string;
  currentKeywords: string[];
  /** Summary of recent review topics, compressed to ~300 chars. */
  reviewSummary: string;
}

/**
 * Generate ASO keyword suggestions using Gemini.
 *
 * Returns up to 15 new keyword strings.
 * Throws on API error — caller should catch and return `source: "unavailable"`.
 */
export async function suggestAsoKeywords(
  params: AsoSuggestParams,
): Promise<string[]> {
  const { appName, appDescription, currentKeywords, reviewSummary } = params;

  const client = getGeminiClient();
  const model  = client.getGenerativeModel({ model: GEMINI_MODEL });

  // Compress inputs to minimise tokens
  const desc      = appDescription.slice(0, 200).trim();
  const summary   = reviewSummary.slice(0, 300).trim();
  const existing  = currentKeywords.slice(0, 20).join(", ");

  const prompt =
    `You are an App Store Optimisation expert.\n` +
    `App: "${appName}"\n` +
    `Description: "${desc}"\n` +
    `Current keywords: ${existing}\n` +
    `Recent review themes: ${summary}\n\n` +
    `Suggest up to 15 NEW high-traffic keywords not already in the current list.\n` +
    `Return ONLY a JSON string array, no markdown, no prose.\n` +
    `Example: ["keyword one","keyword two"]`;

  const result = await model.generateContent(prompt);
  const raw    = result.response.text().trim();

  const json = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

  let parsed: string[];
  try {
    parsed = JSON.parse(json) as string[];
  } catch {
    throw new Error(`Gemini returned unparseable keywords: ${json.slice(0, 200)}`);
  }

  return Array.isArray(parsed)
    ? parsed.filter((k) => typeof k === "string").slice(0, 15)
    : [];
}
