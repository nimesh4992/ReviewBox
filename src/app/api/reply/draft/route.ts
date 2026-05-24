import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { generateReply } from "@/lib/groq";
import { generateReplyWithGemini } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { getMatchedTemplate } from "@/lib/templates";
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

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Only these templates fire without AI — trivially simple cases where brand
 * voice adds nothing. Everything else goes to the AI tier for quality.
 */
const TRIVIAL_TEMPLATE_IDS = new Set(["rating_only", "positive_5star_short"]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRequestBody {
  reviewId:    string;
  reviewBody:  string;
  rating:      number;
  tags:        string[];
  tone:        string;
  /** Google Play = 350, App Store = 5950. Frontend should always pass this. */
  charLimit?:  number;
  /** "Google Play" | "App Store" — used for logging */
  source?:     string;
}

type ReplySource = "reply-kit" | "template" | "cache" | "groq" | "gemini" | "composer";

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseTone(raw: string): AIReplyTone {
  const valid: AIReplyTone[] = ["professional", "empathetic", "casual", "direct"];
  return valid.includes(raw as AIReplyTone) ? (raw as AIReplyTone) : "professional";
}

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

/**
 * Validate reply fits within the store char limit.
 * Returns the text unchanged if within limit, or truncates at the last
 * sentence boundary before the limit.
 */
function enforceCharLimit(text: string, limit: number | undefined): string {
  if (!limit || text.length <= limit) return text;
  // Try to cut at a sentence boundary
  const truncated = text.slice(0, limit);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastNewline = truncated.lastIndexOf("\n");
  const cutAt = Math.max(lastPeriod, lastNewline);
  if (cutAt > limit * 0.6) {
    return text.slice(0, cutAt + 1).trimEnd();
  }
  // No clean boundary — hard cut
  return truncated.trimEnd() + "…";
}

// ── AI generation with automatic failover ─────────────────────────────────────

async function generateWithFailover(params: {
  reviewBody:   string;
  rating:       number;
  tone:         string;
  systemPrompt: string;
  charLimit?:   number;
}): Promise<{ reply: string; source: "groq" | "gemini" }> {
  // Primary: Groq (Llama 3.3 70B, 6K req/day free)
  try {
    const reply = await generateReply({
      reviewBody:   params.reviewBody,
      rating:       params.rating,
      tone:         params.tone,
      systemPrompt: params.systemPrompt,
    });
    return { reply, source: "groq" };
  } catch {
    // Groq failed — fall through to Gemini
  }

  // Fallback: Gemini Flash (1.5K req/day free)
  const reply = await generateReplyWithGemini({
    reviewBody:   params.reviewBody,
    rating:       params.rating,
    tone:         params.tone,
    systemPrompt: params.systemPrompt,
    charLimit:    params.charLimit,
  });
  return { reply, source: "gemini" };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await auth();
    const userId  = session?.userId;
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // ── Plan + rate limit ─────────────────────────────────────────────────
    const plan =
      (session.sessionClaims?.metadata as Record<string, string> | undefined)
        ?.plan ?? "free";
    const { allowed } = await checkAiRateLimit(userId, plan);
    if (!allowed) {
      return NextResponse.json({ error: "LIMIT_REACHED", remaining: 0 }, { status: 429 });
    }

    // ── Parse body ─────────────────────────────────────────────────────────
    const body        = (await req.json()) as DraftRequestBody;
    const { reviewId, reviewBody, rating, tags, charLimit } = body;
    const tone        = normaliseTone(body.tone);
    const review      = buildReview(body);

    // ── Workspace context ──────────────────────────────────────────────────
    const workspaceId = await getWorkspaceId(userId);
    const persona     = workspaceId
      ? await getWorkspacePersona(workspaceId)
      : DEFAULT_PERSONA;

    const log = (source: ReplySource, extra?: Record<string, unknown>) =>
      console.log(JSON.stringify({ userId, plan, source, reviewId, ...extra }));

    // ══════════════════════════════════════════════════════════════════════
    // TIER 0 — Reply-Kit: user's own saved templates
    // Matched by tag overlap + rating range. Highest priority.
    // ══════════════════════════════════════════════════════════════════════
    if (workspaceId) {
      const sb = getServiceClient();
      const { data: kitTemplates } = await sb
        .from("reply_templates")
        .select("id, content, tags, rating_min, rating_max, usage_count")
        .eq("workspace_id", workspaceId)
        .order("usage_count", { ascending: false })
        .limit(20);

      if (kitTemplates && kitTemplates.length > 0) {
        type KitRow = {
          id: string;
          content: string;
          tags: string[] | null;
          rating_min: number | null;
          rating_max: number | null;
          usage_count: number | null;
        };

        let bestMatch: KitRow | null = null;
        let bestOverlap = -1;

        for (const tpl of kitTemplates as KitRow[]) {
          const minOk = tpl.rating_min == null || rating >= tpl.rating_min;
          const maxOk = tpl.rating_max == null || rating <= tpl.rating_max;
          if (!minOk || !maxOk) continue;

          const tplTags: string[] = tpl.tags ?? [];
          const overlap = tplTags.filter((t) => tags.includes(t)).length;
          if (tplTags.length > 0 && overlap === 0) continue;

          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestMatch   = tpl;
          }
        }

        if (bestMatch) {
          const raw   = enforceCharLimit(bestMatch.content, charLimit);
          const reply = personalizeText(raw, persona);
          // Bump usage_count async
          void sb.from("reply_templates")
            .update({ usage_count: (bestMatch.usage_count ?? 0) + 1 })
            .eq("id", bestMatch.id);

          log("reply-kit", { tplId: bestMatch.id });
          return NextResponse.json({ source: "reply-kit" as ReplySource, reply }, { status: 200 });
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIER 1 — Built-in templates: ONLY trivially simple reviews
    // (rating-only, short 5★ praise — no brand voice needed, AI adds nothing)
    // ══════════════════════════════════════════════════════════════════════
    const matchedDef = getMatchedTemplate(review);
    if (matchedDef && TRIVIAL_TEMPLATE_IDS.has(matchedDef.id)) {
      const raw   = matchedDef.pick(review, tone);
      const reply = enforceCharLimit(personalizeText(raw, persona), charLimit);
      log("template", { templateId: matchedDef.id });
      return NextResponse.json({ source: "template" as ReplySource, reply }, { status: 200 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIER 2 — Redis cache: exact match for previously AI-generated replies
    // Checked BEFORE generating to save quota
    // ══════════════════════════════════════════════════════════════════════
    const cached = await getCachedReply({ text: reviewBody, rating }, tone);
    if (cached !== null) {
      const raw   = enforceCharLimit(cached, charLimit);
      const reply = personalizeText(raw, persona);
      log("cache");
      return NextResponse.json({ source: "cache" as ReplySource, reply }, { status: 200 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIER 3 — AI generation: Groq primary → Gemini fallback
    // Brand voice injected here — this is the quality tier.
    // Covers ~98% of non-trivial reviews.
    // Free quota: 6K Groq + 1.5K Gemini = 7.5K/day combined
    // ══════════════════════════════════════════════════════════════════════

    // Fetch KB entry for context (best-effort)
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
    const systemPrompt   = buildSystemPrompt({
      tone,
      contextEntries: kbEntries,
      brandVoice:     persona.brandVoice,
      teamName:       persona.teamName,
      charLimit,
    });

    try {
      const { reply: aiReply, source: aiSource } = await generateWithFailover({
        reviewBody:   compressedBody,
        rating,
        tone,
        systemPrompt,
        charLimit,
      });

      const raw   = enforceCharLimit(aiReply, charLimit);
      const reply = personalizeText(raw, persona);

      // Cache the raw AI output (before personalization — personas can change)
      await setCachedReply({ text: reviewBody, rating }, tone, aiReply);

      log(aiSource, { hasBrandVoice: !!persona.brandVoice, hasKb: kbEntries.length > 0 });
      return NextResponse.json({ source: aiSource as ReplySource, reply }, { status: 200 });

    } catch {
      // Both Groq and Gemini unavailable — fall through to emergency composer
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIER 4 — Composer: emergency fallback only
    // Both AI providers are down. Produces a deterministic reply so the
    // user always gets something they can edit and send.
    // ══════════════════════════════════════════════════════════════════════
    const composedReply = composeReply(review, tone, persona);
    const reply = enforceCharLimit(composedReply, charLimit);
    log("composer", { reason: "ai_unavailable" });
    return NextResponse.json({ source: "composer" as ReplySource, reply }, { status: 200 });

  } catch (err) {
    console.error("Unexpected error in /api/reply/draft:", err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
