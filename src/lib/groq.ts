import Groq from "groq-sdk";

/**
 * Groq retired the entire Llama family from its production line-up; the old
 * default `llama-3.3-70b-versatile` answers 404 `model_not_found`. Exported so
 * the public demo route cannot drift back to a hardcoded id (it had one).
 */
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

/**
 * gpt-oss is a REASONING model: it spends output tokens thinking before it
 * emits any visible text, and those tokens count against max_tokens. At the
 * old cap of 150 the whole budget went to reasoning and the API returned an
 * empty completion -- which this module reported as AI_UNAVAILABLE, i.e.
 * indistinguishable from a dead provider. Measured on a 5-language smoke run:
 * 1/5 replies survived at 150, 5/5 at "low" effort with a 400 cap.
 *
 * Keep the effort low rather than raising caps further: it is the lever that
 * bounds cost and latency, and reply drafting needs no deep reasoning.
 */
const REASONING_EFFORT = "low" as const;

/**
 * 400, not 150: the visible reply is still short (the prompt caps it), but the
 * budget must also cover the model's reasoning tokens. See REASONING_EFFORT.
 */
const MAX_TOKENS = 400;

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
      reasoning_effort: REASONING_EFFORT,
      messages: [
        { role: "system", content: finalSystemPrompt },
        { role: "user",   content: userContent },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      // An empty completion is NOT the same as a failed request, and it used
      // to be indistinguishable: this throw is re-thrown unlogged by the catch
      // below. A reasoning model that spends the whole max_tokens budget on
      // reasoning returns exactly this, and it looks like a dead provider.
      console.error("[groq] empty completion", {
        model: GROQ_MODEL,
        maxTokens: MAX_TOKENS,
        finishReason: completion.choices[0]?.finish_reason,
      });
      throw new Error("AI_UNAVAILABLE");
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") throw err;
    // Log and attach the cause. generateSummary() below carries a long comment
    // about how a bare `catch` here left "nothing to look at either" -- that
    // same defect lived on in this function until a P1-2 smoke run hit it and
    // could not tell a bad key from a blocked network from a wrong model name.
    // Callers only ever compare `.message`, so behaviour is unchanged.
    console.error("[groq] generateReply failed:", err);
    throw new Error("AI_UNAVAILABLE", { cause: err });
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
      max_tokens: 800,
      reasoning_effort: REASONING_EFFORT,
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

/** Shown when there genuinely are no reviews to summarise. */
export const SUMMARY_NO_DATA = "Not enough recent review data to generate a summary.";
/** Shown when we HAD reviews and the AI call didn't come back. */
export const SUMMARY_FAILED =
  "We couldn't generate a summary just now — the AI service didn't respond. Try Refresh.";

/**
 * Summarise recent reviews.
 *
 * All three exits used to return the same sentence — "Not enough recent review
 * data" — for three different situations: no reviews, an empty completion, and
 * a thrown request. So a workspace with 202 reviews, 50 of them handed to this
 * function, was told it didn't have enough data. The panel said "Based on 50
 * recent reviews" directly above it, contradicting itself on the same screen,
 * and the `catch` swallowed the error without logging, so there was nothing to
 * look at either.
 *
 * Groq's free tier is 6K requests/day and rate-limits in bursts, so the failing
 * path is not exotic — it is the expected one on a busy afternoon.
 */
export async function generateSummary(snippets: string[]): Promise<string> {
  if (!snippets || snippets.length === 0) {
    return SUMMARY_NO_DATA;
  }
  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      reasoning_effort: REASONING_EFFORT,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user",   content: snippets.join("\n") },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      console.error("[groq] summary returned an empty completion", {
        snippets: snippets.length,
      });
      return SUMMARY_FAILED;
    }
    return text;
  } catch (err) {
    console.error("[groq] summary failed:", err instanceof Error ? err.message : err);
    return SUMMARY_FAILED;
  }
}
