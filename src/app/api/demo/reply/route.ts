import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// Public demo endpoint — no auth required. IP-based rate limit: 5 req/hr.
// Keyed by X-Forwarded-For or cf-connecting-ip to stay serverless-friendly.

const CALLS_PER_HOUR = 5;
// Simple in-memory store (resets on cold start — acceptable for demo limits)
const ipLog = new Map<string, { count: number; resetAt: number }>();

function checkLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipLog.get(ip);
  if (!entry || now > entry.resetAt) {
    ipLog.set(ip, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }
  if (entry.count >= CALLS_PER_HOUR) return false;
  entry.count += 1;
  return true;
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getIp(req);
  if (!checkLimit(ip)) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Demo limit reached. Start a free trial for unlimited drafts." },
      { status: 429 },
    );
  }

  let body: { reviewBody?: string; rating?: number; reviewTitle?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  const { reviewBody = "", rating = 1, reviewTitle = "" } = body;

  if (!reviewBody.trim()) {
    return NextResponse.json({ error: "MISSING_BODY" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }

  const groq = new Groq({ apiKey });

  const prompt = `You are a helpful support agent for a mobile app. Write a concise, empathetic reply to this ${rating}-star app store review${reviewTitle ? ` titled "${reviewTitle}"` : ""}.

Requirements:
- 3-4 sentences, ~60-80 words
- Acknowledge the specific issue
- Professional and human tone
- No "Hi [name]," opener, no signature
- End with a clear next step or offer

Review: "${reviewBody.trim()}"

Write only the reply text.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 180,
      temperature: 0.65,
    });
    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ reply }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
  }
}
