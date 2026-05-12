import Groq from "groq-sdk";

const GROQ_MODEL = "llama-3.3-70b-versatile";
const MAX_TOKENS = 200;

let _client: Groq | null = null;

function getGroqClient(): Groq {
  if (!_client) {
    _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _client;
}

export async function generateReply(params: {
  reviewBody: string;
  rating: number;
  tone: string;
  context?: string;
}): Promise<string> {
  const { reviewBody, rating, tone, context } = params;

  const systemPrompt = [
    `You are a professional mobile app support specialist. Write a concise, helpful reply to the following app store review. Be ${tone}. Keep it under 150 words. Don't mention specific version numbers unless provided. Sign off as 'The Revi Team'.`,
    context ? `\n${context}` : null,
  ]
    .filter(Boolean)
    .join("");

  const userContent = [
    `Rating: ${rating}/5`,
    `Review: ${reviewBody}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("AI_UNAVAILABLE");
    }
    return text;
  } catch (err) {
    // Re-throw our sentinel so callers can distinguish AI failures
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") {
      throw err;
    }
    throw new Error("AI_UNAVAILABLE");
  }
}
