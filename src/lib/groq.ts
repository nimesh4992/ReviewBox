import Groq from "groq-sdk";

const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

/** Reduced from 200 to match the "under 120 words" system prompt instruction. */
const MAX_TOKENS = 150;

let _client: Groq | null = null;

function getGroqClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

export async function generateReply(params: {
  /** Compressed review text (use compressReviewText() before calling). */
  reviewBody: string;
  rating: number;
  tone: string;
  /** @deprecated Pass systemPrompt instead for better token efficiency. */
  context?: string;
  /**
   * Pre-built system prompt from buildSystemPrompt().
   * When provided, overrides the internally built prompt and `context`.
   * Target: ~35-45 tokens vs the old ~245 token approach.
   */
  systemPrompt?: string;
}): Promise<string> {
  const { reviewBody, rating, tone, context, systemPrompt: prebuiltPrompt } = params;

  // Use the pre-built compressed prompt if provided, otherwise fall back to
  // the original verbose approach (backward compatibility).
  const finalSystemPrompt =
    prebuiltPrompt ??
    [
      `You are a professional mobile app support specialist. Write a concise, helpful reply to the following app store review. Be ${tone}. Keep it under 120 words. Sign off as 'The ReviewBox Team'.`,
      context ? `\n${context}` : null,
    ]
      .filter(Boolean)
      .join("");

  const userContent = `Rating: ${rating}/5\n\nReview: ${reviewBody}`;

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user",   content: userContent },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) throw new Error("AI_UNAVAILABLE");
    return text;
  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") throw err;
    throw new Error("AI_UNAVAILABLE");
  }
}

export async function translateText(
  text: string,
): Promise<{ translatedText: string; sourceLang: string }> {
  if (!text.trim()) {
    return { translatedText: text, sourceLang: "en" };
  }
  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are a translation assistant. Detect the language of the text and translate it to English. Respond with JSON only: {\"sourceLang\": \"<ISO 639-1 code>\", \"translatedText\": \"<english translation>\"}. If text is already English, return {\"sourceLang\": \"en\", \"translatedText\": \"<original text unchanged>\"}. No markdown, no explanation, JSON only.",
        },
        { role: "user", content: text },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip possible markdown code fence
    const json = raw.replace(/^```(?:json)?|```$/g, "").trim();
    const parsed = JSON.parse(json) as { sourceLang: string; translatedText: string };
    return {
      sourceLang: parsed.sourceLang ?? "unknown",
      translatedText: parsed.translatedText ?? text,
    };
  } catch {
    return { translatedText: text, sourceLang: "unknown" };
  }
}

const SUMMARY_SYSTEM_PROMPT =
  "You are a product analytics assistant. In 2-3 sentences, summarize the most important patterns in these recent app reviews. Be specific about issues and sentiment. No markdown, no headers, just flowing prose.";

export async function generateSummary(snippets: string[]): Promise<string> {
  if (!snippets || snippets.length === 0) {
    return "Not enough recent review data to generate a summary.";
  }
  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 200,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user",   content: snippets.join("\n") },
      ],
    });
    return completion.choices[0]?.message?.content?.trim()
      ?? "Not enough recent review data to generate a summary.";
  } catch {
    return "Not enough recent review data to generate a summary.";
  }
}
