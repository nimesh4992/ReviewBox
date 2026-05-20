import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { generateReply } from "@/lib/groq";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { matchTemplate } from "@/lib/templates";
import { getCachedReply, setCachedReply } from "@/lib/reply-cache";
import { compressReviewText, buildSystemPrompt } from "@/lib/prompt-utils";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import {
  getWorkspacePersona,
  personalizeText,
  DEFAULT_PERSONA,
} from "@/lib/workspace-persona";
import { composeReply } from "@/lib/reply-composer";
import type { AIReplyTone } from "@/lib/templates";
import type { AppReview } from "@/types/review";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRequestBody {
  reviewId:   string;
  reviewBody: string;
  rating:     number;
  tags:       string[];
  tone:       string;
}

type ReplySource = "reply-kit" | "template" | "composer" | "cache" | "groq";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseTone(raw: string): AIReplyTone {
  const valid: AIReplyTone[] = ["professional", "empathetic", "casual", "direct"];
  return valid.includes(raw as AIReplyTone)
    ? (raw as AIReplyTone)
    : "professional";
}

/** Build a minimal AppReview for the template + composer tiers. */
function buildReview(body: DraftRequestBody): AppReview {
  return {
    id:             body.reviewId,
    author:         "",
    rating:         body.rating as AppReview["rating"],
    text:           body.reviewBody,
    appVersion:     "",
    device:         "",
    country:        "",
    issueTags:      body.tags as AppReview["issueTags"],
    sentiment:      "mixed",
    priority:       "normal",
    replyStatus:    "needs_reply",
    escalationState:"none",
    createdAt:      new Date().toISOString(),
    source:         "Google Play",
    hasAiSuggestion:false,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await auth();
    const userId  = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // ── Plan + rate limit ───────────────────────────────────────────────────
    const plan =
      (session.sessionClaims?.metadata as Record<string, string> | undefined)
        ?.plan ?? "free";

    const { allowed } = await checkAiRateLimit(userId, plan);
    if (!allowed) {
      return NextResponse.json(
        { error: "LIMIT_REACHED", remaining: 0 },
        { status: 429 },
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body  = (await req.json()) as DraftRequestBody;
    const { reviewId, reviewBody, rating, tags, tone: rawTone } = body;
    const tone  = normaliseTone(rawTone);
    const review = buildReview(body);

    // ── Workspace context ───────────────────────────────────────────────────
    const workspaceId = await getWorkspaceId(userId);
    const persona     = workspaceId
      ? await getWorkspacePersona(workspaceId)
      : DEFAULT_PERSONA;

    // ──────────────────────────────────────────────────────────────────────
    // TIER 0: Reply-Kit — user's own saved templates (DB)
    // Matched by: tag overlap + rating in range
    // ──────────────────────────────────────────────────────────────────────
    if (workspaceId) {
      const sb = getServiceClient();
      const { data: kitTemplates } = await sb
        .from("reply_templates")
        .select("id, content, tags, rating_min, rating_max")
        .eq("workspace_id", workspaceId)
        .order("usage_count", { ascending: false })
        .limit(20);

      if (kitTemplates && kitTemplates.length > 0) {
        // Find best match: most tag overlaps within rating range
        type KitRow = {
          id: string;
          content: string;
          tags: string[] | null;
          rating_min: number | null;
          rating_max: number | null;
        };
        let bestMatch: KitRow | null = null;
        let bestOverlap = 0;

        for (const tpl of kitTemplates as KitRow[]) {
          const minOk = tpl.rating_min == null || rating >= tpl.rating_min;
          const maxOk = tpl.rating_max == null || rating <= tpl.rating_max;
          if (!minOk || !maxOk) continue;

          const tplTags: string[] = tpl.tags ?? [];
          const overlap = tplTags.filter((t) => tags.includes(t)).length;

          if (tplTags.length > 0 && overlap === 0) continue; // tag-gated, no match
          if (overlap > bestOverlap || (overlap === 0 && !bestMatch)) {
            bestOverlap = overlap;
            bestMatch   = tpl;
          }
        }

        if (bestMatch) {
          const reply = personalizeText(bestMatch.content, persona);
          // Bump usage_count async — don't await
          sb.from("reply_templates")
            .update({ usage_count: (bestMatch as KitRow & { usage_count?: number }).usage_count ?? 0 })
            .eq("id", bestMatch.id)
            .then(() => undefined)
            .catch(() => undefined);

          console.log(JSON.stringify({ userId, plan, source: "reply-kit", reviewId, tplId: bestMatch.id }));
          return NextResponse.json({ source: "reply-kit" as ReplySource, reply }, { status: 200 });
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────
    // TIER 1: Built-in tone-aware templates (0 tokens, <2ms)
    // ──────────────────────────────────────────────────────────────────────
    const templateRaw = matchTemplate({ rating, body: reviewBody, tags, tone });
    if (templateRaw !== null) {
      const reply = personalizeText(templateRaw, persona);
      console.log(JSON.stringify({ userId, plan, source: "template", reviewId }));
      return NextResponse.json({ source: "template" as ReplySource, reply }, { status: 200 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // TIER 2: Composite builder (0 tokens, <5ms)
    // Assembles a persona-aware reply from building blocks.
    // Covers ~20% of reviews that fall through templates.
    // ──────────────────────────────────────────────────────────────────────
    if (tags.length > 0) {
      // Fetch relevant KB entry for resolution hint (best-effort)
      let kbHint: string | undefined;
      if (workspaceId) {
        const sb  = getServiceClient();
        const tag = tags[0];
        const { data: kbRows } = await sb
          .from("knowledge_base")
          .select("content")
          .eq("workspace_id", workspaceId)
          .eq("category", "known_issue")
          .order("created_at", { ascending: false })
          .limit(1);
        if (kbRows?.[0]) {
          // Use first 120 chars of KB content as resolution hint
          const raw = (kbRows[0].content as string) ?? "";
          // Only use if it mentions the tag keyword (relevance check)
          if (raw.toLowerCase().includes(tag.toLowerCase())) {
            kbHint = raw.slice(0, 120).trim();
          }
        }
      }

      const composedReply = composeReply(review, tone, persona, kbHint ? { kbHint } : {});
      console.log(JSON.stringify({ userId, plan, source: "composer", reviewId, tags, kbHint: !!kbHint }));
      return NextResponse.json({ source: "composer" as ReplySource, reply: composedReply }, { status: 200 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // TIER 3: Redis cache (~5ms) — exact match for prior AI-generated replies
    // ──────────────────────────────────────────────────────────────────────
    const cached = await getCachedReply({ text: reviewBody, rating }, tone);
    if (cached !== null) {
      const reply = personalizeText(cached, persona);
      console.log(JSON.stringify({ userId, plan, source: "cache", reviewId }));
      return NextResponse.json({ source: "cache" as ReplySource, reply }, { status: 200 });
    }

    // ──────────────────────────────────────────────────────────────────────
    // TIER 4: Groq LLM — truly novel reviews (~80 tokens input)
    // ──────────────────────────────────────────────────────────────────────
    let kbEntries: Array<{ category: string; title: string; content: string }> = [];
    if (workspaceId) {
      const sb = getServiceClient();
      const { data } = await sb
        .from("knowledge_base")
        .select("category, title, content")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(1);
      kbEntries = data ?? [];
    }

    const compressedBody = compressReviewText(reviewBody);
    const systemPrompt   = buildSystemPrompt(tone, kbEntries);

    const aiReply = await generateReply({
      reviewBody: compressedBody,
      rating,
      tone,
      systemPrompt,
    });

    await setCachedReply({ text: reviewBody, rating }, tone, aiReply);

    const reply = personalizeText(aiReply, persona);

    console.log(
      JSON.stringify({
        userId,
        plan,
        source: "groq",
        reviewId,
        hasContext: kbEntries.length > 0,
      }),
    );

    return NextResponse.json({ source: "groq" as ReplySource, reply }, { status: 200 });

  } catch (err) {
    if (err instanceof Error && err.message === "AI_UNAVAILABLE") {
      return NextResponse.json({ error: "AI_UNAVAILABLE" }, { status: 503 });
    }
    console.error("Unexpected error in /api/reply/draft:", err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
