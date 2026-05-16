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
