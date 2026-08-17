import { auth } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

import { recordAiUsage } from "@/lib/ai-usage";

import { generateReply } from "@/lib/groq";
import { generateReplyWithGemini } from "@/lib/gemini";
import { checkAiRateLimit } from "@/lib/rate-limit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import { getMatchedTemplate } from "@/lib/templates";
import { getCachedReply, setCachedReply } from "@/lib/reply-cache";
import { compressReviewText, buildSystemPrompt, humanizePunctuation } from "@/lib/prompt-utils";
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
  // Both provider errors used to be swallowed by bare `catch {}`, so when AI
  // generation stopped working the only visible symptom was that every reply
  // suddenly read like a form letter — the deterministic Tier 4 composer. The
  // reason was unknowable after the fact: no log, no Sentry event, nothing.
  // Log both, with the provider named, so the next occurrence is a one-line
  // diagnosis instead of a guess.
  let groqError: unknown;
  try {
    const reply = await generateReply({
      reviewBody:   params.reviewBody,
      rating:       params.rating,
      tone:         params.tone,
      systemPrompt: params.systemPrompt,
    });
    return { reply, source: "groq" };
  } catch (err) {
    groqError = err;
    console.error("[reply/draft] groq failed:", err instanceof Error ? err.message : err);
  }

  // Fallback: Gemini Flash (1.5K req/day free)
  try {
    const reply = await generateReplyWithGemini({
      reviewBody:   params.reviewBody,
      rating:       params.rating,
      tone:         params.tone,
      systemPrompt: params.systemPrompt,
      charLimit:    params.charLimit,
    });
    return { reply, source: "gemini" };
  } catch (err) {
    console.error("[reply/draft] gemini failed:", err instanceof Error ? err.message : err);
    Sentry.captureMessage("[reply/draft] both AI providers failed — serving composer fallback", {
      level: "error",
      extra: {
        groq:   groqError instanceof Error ? groqError.message : String(groqError),
        gemini: err instanceof Error ? err.message : String(err),
        groqKeySet:   !!process.env.GROQ_API_KEY,
        geminiKeySet: !!process.env.GEMINI_API_KEY,
      },
    });
    throw err;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const session = await auth();
    const userId  = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    // ── Plan + rate limit ─────────────────────────────────────────────────
    // Absent metadata means "not stamped yet", not "free tier". Clerk caches
    // session claims for up to 60s after onboarding writes them, so defaulting
    // to `free` here gave brand-new users 0 AI drafts a day and the misleading
    // "AI draft limit reached for your plan". middleware.ts:151 already treats
    // a missing plan as `trial`; match it. (`free` remains the fail-closed
    // default for an *unknown* plan string — see plans.ts.)
    const plan =
      (session.sessionClaims?.metadata as Record<string, string> | undefined)
        ?.plan ?? "trial";

    // The per-plan AI quota is NOT charged here. It used to be, and that made
    // it a limit on *interactions* rather than on AI calls: opening a review
    // auto-drafts, switching tone re-drafts, and reopening a review drafts
    // again — every one of which spent a token even when the answer came from
    // a saved template or the Redis cache and no provider was touched. On
    // Starter (50/day) simply reading through the inbox exhausted the day's
    // quota without the customer ever asking for a draft.
    //
    // It's charged immediately before TIER 3 instead, the only tier that calls
    // Groq or Gemini. Tiers 0-2 (workspace templates, built-in templates,
    // cache) are free, which is what "aiDraftsPerDay" was always meant to
    // mean.
    //
    // A cheap request-rate guard stays here so the endpoint still can't be
    // hammered — it bounds requests per minute, not drafts per day.
    const burst = await rateLimit(req, userId, { bucket: "reply-draft", limit: 60, window: "1 m" });
    if (!burst.allowed) return apiError("RATE_LIMITED", 429, "Too many requests — slow down a moment.");

    // ── Parse body ─────────────────────────────────────────────────────────
    const body        = (await req.json()) as DraftRequestBody;
    const { reviewId, reviewBody, rating, tags, charLimit } = body;

    // Cap reviewBody to prevent quota abuse — reviews beyond this length don't improve quality
    if (!reviewBody || reviewBody.length > 5000) {
      return apiError("INVALID_INPUT", 400, "reviewBody required, max 5000 chars");
    }
    // Cap tags array
    const safeTags = Array.isArray(tags) ? tags.slice(0, 20) : [];
    const tone        = normaliseTone(body.tone);
    const review      = buildReview({ ...body, tags: safeTags });

    // ── Workspace context ──────────────────────────────────────────────────
    // Resolve which app this review belongs to before building the persona.
    // The reply is signed with the app's name, and a workspace can hold more
    // than one — signing a Mumbai One reviewer as another app's team would be
    // published publicly on the store.
    const workspaceId = await getWorkspaceId(userId);

    let reviewAppId: string | undefined;
    if (workspaceId && reviewId) {
      const sb = getServiceClient();
      const { data: reviewRow } = await sb
        .from("reviews")
        .select("app_id")
        .eq("id", reviewId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      reviewAppId = (reviewRow?.app_id as string | null) ?? undefined;
    }

    const persona = workspaceId
      ? await getWorkspacePersona(workspaceId, reviewAppId)
      : DEFAULT_PERSONA;

    // One hook for both the console line and the usage row, so a tier added
    // later cannot be metered by accident only in one of the two.
    //
    // Every tier is recorded, not just the ones that call a provider: the
    // `model` column carries which tier served it, and knowing that 80% of
    // drafts came from saved templates is the number that tells you the token
    // budget is safe. Counting only Groq calls would have shown that as silence.
    const log = (source: ReplySource, extra?: Record<string, unknown>) => {
      console.log(JSON.stringify({ userId, plan, source, reviewId, ...extra }));
      // after() rather than a detached promise — Vercel freezes the invocation
      // the moment the response returns, and a bare .catch() chain dies with it.
      after(() =>
        recordAiUsage({
          workspaceId,
          clerkUserId: userId,
          action: "draft_reply",
          model: source,
        }),
      );
    };

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
          const reply = humanizePunctuation(personalizeText(raw, persona));
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
      const reply = humanizePunctuation(enforceCharLimit(personalizeText(raw, persona), charLimit));
      log("template", { templateId: matchedDef.id });
      return NextResponse.json({ source: "template" as ReplySource, reply }, { status: 200 });
    }

    // The system prompt is built BEFORE the cache tier because it is part of
    // the cache key: the cached value is raw model output, and the prompt
    // bakes in this workspace's sign-off, brand voice, KB snippet and char
    // limit. Keying by review text alone served one tenant's draft — signed
    // with their team name, referencing their private KB — to a different
    // tenant whose customer wrote the same short review. One small KB select
    // per cache hit is the price of that isolation.
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

    const systemPrompt = buildSystemPrompt({
      tone,
      contextEntries: kbEntries,
      brandVoice:     persona.brandVoice,
      teamName:       persona.teamName,
      charLimit,
    });

    const cacheScope = {
      workspaceId,
      appId: reviewAppId ?? null,
      systemPrompt,
    };

    // ══════════════════════════════════════════════════════════════════════
    // TIER 2 — Redis cache: exact match for previously AI-generated replies
    // Checked BEFORE generating to save quota. Scoped to workspace + app +
    // prompt — never shared across tenants.
    // ══════════════════════════════════════════════════════════════════════
    // No workspace means no tenant to scope the cache to, and a shared bucket
    // is exactly what this cache must never be again — so such a caller simply
    // skips the cache rather than reading or writing a common namespace.
    const cached = workspaceId
      ? await getCachedReply(workspaceId, { text: reviewBody, rating }, tone)
      : null;
    const cached = await getCachedReply(cacheScope, { text: reviewBody, rating }, tone);
    if (cached !== null) {
      const raw   = enforceCharLimit(cached, charLimit);
      const reply = humanizePunctuation(personalizeText(raw, persona));
      log("cache");
      return NextResponse.json({ source: "cache" as ReplySource, reply }, { status: 200 });
    }

    // ══════════════════════════════════════════════════════════════════════
    // TIER 3 — AI generation: Groq primary → Gemini fallback
    // Brand voice injected here — this is the quality tier.
    // Covers ~98% of non-trivial reviews.
    // Free quota: 6K Groq + 1.5K Gemini = 7.5K/day combined
    // ══════════════════════════════════════════════════════════════════════

    // Charge the plan's AI quota here — the first point at which we are
    // actually going to call a provider. Everything above this line answered
    // from the workspace's own templates or the cache and cost nothing.
    const { allowed } = await checkAiRateLimit(userId, plan);
    if (!allowed) return apiError("RATE_LIMITED", 429, "AI draft limit reached for your plan");

    const compressedBody = compressReviewText(reviewBody);

    try {
      const { reply: aiReply, source: aiSource } = await generateWithFailover({
        reviewBody:   compressedBody,
        rating,
        tone,
        systemPrompt,
        charLimit,
      });

      const raw   = enforceCharLimit(aiReply, charLimit);
      const reply = humanizePunctuation(personalizeText(raw, persona));

      // Cache the raw AI output (before personalization — personas can change)
      if (workspaceId) {
        await setCachedReply(workspaceId, { text: reviewBody, rating }, tone, aiReply);
      }
      // Cache the raw AI output under the workspace/app/prompt-scoped key.
      // A persona or KB change produces a different prompt, hence a different
      // key — stale drafts age out rather than being served.
      await setCachedReply(cacheScope, { text: reviewBody, rating }, tone, aiReply);

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
    const reply = humanizePunctuation(enforceCharLimit(composedReply, charLimit));
    log("composer", { reason: "ai_unavailable" });
    return NextResponse.json({ source: "composer" as ReplySource, reply }, { status: 200 });

  } catch (err) {
    return captureAndError(err, "POST /api/reply/draft");
  }
}
