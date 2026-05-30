/**
 * POST /api/onboarding/setup
 *
 * Step 3 of the new 5-step onboarding wizard.
 * Creates the workspace + app and fires bootstrap (200 reviews) in the
 * background. Does NOT mark the user as onboarded — that happens at
 * /api/onboarding/complete when the user clicks "Launch workspace".
 *
 * This gives Steps 4 (connect store) and 5 (ready screen) ~30-40 seconds
 * of scraping time before the user lands on a populated dashboard.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { fetchAppMetadata } from "@/services/store-search";
import { getBrandVoiceStub, type AppCategory } from "@/lib/brand-voice-stubs";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BrandVoiceConfig {
  tone:          "professional" | "friendly" | "empathetic" | "direct";
  wordsToUse:    string[];
  wordsToAvoid:  string[];
  signOff:       string;
  replyLength:   "short" | "standard" | "detailed";
}

interface SetupBody {
  workspaceName: string;
  workspaceSlug: string;
  appName:       string;
  platform:      "google-play" | "app-store";
  storeId:       string;
  appCategory?:  AppCategory;
  icon?:         string | null;
  developer?:    string | null;
  rating?:       number | null;
  brandVoice?:   BrandVoiceConfig;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "blog", "billing", "dashboard", "help",
  "inbox", "onboarding", "pricing", "privacy", "reviews", "settings",
  "sign-in", "sign-up", "terms", "www",
]);

// ── Brand voice text generator ────────────────────────────────────────────────

function buildBrandVoiceText(config: BrandVoiceConfig): string {
  const toneMap = {
    professional: "professional and polished",
    friendly:     "warm and friendly",
    empathetic:   "empathetic and understanding",
    direct:       "direct and concise",
  };
  const lengthMap = {
    short:    "Keep replies to 1-2 sentences.",
    standard: "Keep replies to 2-3 sentences.",
    detailed: "Write thorough replies of 3-5 sentences.",
  };

  const parts: string[] = [
    `Our tone is ${toneMap[config.tone]}.`,
    lengthMap[config.replyLength],
  ];
  if (config.wordsToUse.length) {
    parts.push(`Prefer these phrases: ${config.wordsToUse.join(", ")}.`);
  }
  if (config.wordsToAvoid.length) {
    parts.push(`Never use: ${config.wordsToAvoid.join(", ")}.`);
  }
  if (config.signOff.trim()) {
    parts.push(`Sign off as: ${config.signOff.trim()}.`);
  }
  return parts.join(" ");
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId  = session?.userId;
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const rl = await rateLimit(req, userId, { bucket: "onboarding-setup", limit: 5, window: "10 m" });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const body = (await req.json()) as SetupBody;
  const { workspaceName, workspaceSlug, appName, platform, storeId = "", appCategory, brandVoice } = body;

  if (!workspaceName?.trim() || !workspaceSlug?.trim() || !appName?.trim()) {
    return apiError("MISSING_FIELDS", 400);
  }
  const cleanSlug = workspaceSlug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(cleanSlug)) {
    return apiError("INVALID_INPUT", 400, "Slug must be 3-40 lowercase letters, numbers, or hyphens.");
  }
  if (RESERVED_SLUGS.has(cleanSlug)) {
    return apiError("SLUG_RESERVED", 409, "That URL is reserved.");
  }

  const sb = getServiceClient();

  // ── Idempotency: reuse existing workspace if present ─────────────────────────
  const { data: existingMember } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let workspaceId: string;
  const isNew = !existingMember?.workspace_id;

  if (existingMember?.workspace_id) {
    workspaceId = existingMember.workspace_id as string;
  } else {
    // Build brand voice: user-provided config takes priority, falls back to category stub
    let brandVoiceValue: string | object | undefined;
    if (brandVoice) {
      brandVoiceValue = {
        ...brandVoice,
        text: buildBrandVoiceText(brandVoice),
      };
    } else if (appCategory) {
      brandVoiceValue = getBrandVoiceStub(appCategory);
    }

    const wsInsert = await sb
      .from("workspaces")
      .insert({
        name:         workspaceName.trim(),
        slug:         cleanSlug,
        plan:         "trial",
        app_category: appCategory ?? null,
        brand_voice:  brandVoiceValue ?? null,
      })
      .select("id")
      .single();

    if (wsInsert.error?.code === "23505") return apiError("SLUG_TAKEN", 409);
    if (wsInsert.error) {
      console.error("[onboarding/setup] workspace insert:", wsInsert.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
    workspaceId = wsInsert.data!.id as string;

    await sb.from("workspace_members").insert({
      workspace_id: workspaceId,
      clerk_user_id: userId,
      role: "owner",
    });
  }

  // ── Idempotency: reuse existing app if present ────────────────────────────────
  const { data: existingApp } = await sb
    .from("apps")
    .select("id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  let appId: string;

  if (existingApp?.id) {
    appId = existingApp.id as string;
  } else {
    // Fetch metadata (often cached from onboarding search step)
    let metaIcon     = body.icon ?? null;
    let metaDev      = body.developer ?? null;
    let metaRating   = body.rating ?? null;
    let metaCount: number | null = null;

    if (storeId) {
      try {
        const meta = await fetchAppMetadata(platform, storeId);
        if (meta) {
          metaIcon   = meta.icon ?? metaIcon;
          metaDev    = meta.developer || metaDev;
          metaRating = meta.rating ?? metaRating;
          metaCount  = meta.reviewCount ?? null;
        }
      } catch (err) {
        console.warn("[onboarding/setup] metadata fetch failed:", err);
      }
    }

    const dbPlatform = platform.replace("-", "_");
    const appInsert  = await sb
      .from("apps")
      .insert({
        workspace_id:          workspaceId,
        name:                  appName.trim(),
        platform:              dbPlatform,
        store_id:              storeId,
        icon_url:              metaIcon,
        developer:             metaDev,
        lifetime_rating:       metaRating,
        lifetime_review_count: metaCount,
      })
      .select("id")
      .single();

    if (appInsert.error) {
      console.error("[onboarding/setup] app insert:", appInsert.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
    appId = appInsert.data!.id as string;
  }

  // ── Fire bootstrap + enrichment in background ─────────────────────────────────
  // This runs the 200-review public scrape + Gemini enrichment while the user
  // fills in Steps 4 (connect) and 5 (ready). By the time they click
  // "Launch workspace", the inbox should be populated.
  if (isNew) {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
        ? process.env.NEXT_PUBLIC_APP_URL
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";
    const secret = process.env.CRON_SECRET;
    void fetch(`${appUrl}/api/sync/reviews?workspaceId=${workspaceId}`, {
      method: "GET",
      headers: secret ? { authorization: `Bearer ${secret}` } : {},
    }).catch((err) => console.error("[onboarding/setup] bootstrap trigger:", err));
  }

  return NextResponse.json({ workspaceId, appId });
}
