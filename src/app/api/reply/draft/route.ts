import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { generateReply } from "@/lib/groq";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { matchTemplate } from "@/lib/templates";
import { getCachedReply, setCachedReply } from "@/lib/reply-cache";
import { compressReviewText, buildSystemPrompt } from "@/lib/prompt-utils";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

interface DraftRequestBody {
  reviewId: string;
  reviewBody: string;
  rating: number;
  tags: string[];
  tone: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Resolve plan from session claims
    const plan =
      (session.sessionClaims?.metadata as Record<string, string> | undefined)
        ?.plan ?? "free";

    // 3. Rate-limit check
    const { allowed } = await checkAiRateLimit(userId, plan);

    if (!allowed) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", remaining: 0 },
        { status: 429 },
      );
    }

    // Parse body
    const body = (await req.json()) as DraftRequestBody;
    const { reviewId, reviewBody, rating, tags, tone } = body;

    // ── TIER 1: Template match (0 tokens, <2ms) ─────────────────────────────
    const templateReply = matchTemplate({ rating, body: reviewBody, tags });
    if (templateReply !== null) {
      console.log(JSON.stringify({ userId, plan, source: "template", reviewId }));
      return NextResponse.json(
        { source: "template", reply: templateReply },
        { status: 200 },
      );
    }

    // ── TIER 2: Reply cache (0 tokens, ~5ms) ────────────────────────────────
    const cached = await getCachedReply({ text: reviewBody, rating }, tone);
    if (cached !== null) {
      console.log(JSON.stringify({ userId, plan, source: "cache", reviewId }));
      return NextResponse.json({ source: "cache", reply: cached }, { status: 200 });
    }

    // ── TIER 3: AI generation (compressed, ~80 tokens) ──────────────────────

    // Fetch 1 KB entry (was 3 — saves ~120 tokens per call)
    let kbEntries: Array<{ category: string; title: string; content: string }> = [];
    const workspaceId = await getWorkspaceId(userId);
    if (workspaceId) {
      const sb = getServiceClient();
      const { data } = await sb
        .from("knowledge_base")
        .select("category, title, content")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1); // reduced from 3 → 1 (saves ~120 tokens)
      kbEntries = data ?? [];
    }

    // Compress review text: strips filler phrases, truncates to 280 chars
    const compressedBody = compressReviewText(reviewBody);

    // Build minimal system prompt: ~35-45 tokens (was ~245)
    const systemPrompt = buildSystemPrompt(tone, kbEntries);

    // Generate via Groq with compressed inputs
    const reply = await generateReply({
      reviewBody: compressedBody,
      rating,
      tone,
      systemPrompt,
    });

    // Store in cache for future identical/similar requests
    await setCachedReply({ text: reviewBody, rating }, tone, reply);

    console.log(
      JSON.stringify({
        userId,
        plan,
        source: "groq",
        reviewId,
        hasContext: kbEntries.length > 0,
      }),
    );

    return NextResponse.json({ source: "groq", reply }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") {
      return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
    }

    console.error("Unexpected error in /api/reply/draft:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
