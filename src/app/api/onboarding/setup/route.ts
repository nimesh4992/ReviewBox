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

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { resolveAppMetadata } from "@/services/store-search";
import { syncWorkspace } from "@/services/review-sync";
import { getBrandVoiceStub, type AppCategory } from "@/lib/brand-voice-stubs";

// The after() bootstrap scrapes the public store (10-30s) — needs more than
// the default function budget so the sync isn't cut off mid-write.
export const maxDuration = 60;

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
  /** Storefront the client saw this app in (from search) — confirmed server-side. */
  country?:      string | null;
  brandVoice?:   BrandVoiceConfig;
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
// Must stay in sync with /api/onboarding/slug-check and /api/onboarding/complete.
// When this set was the smaller of the three, a user could be shown "Reserved
// URL." on step 1 and still have the slug accepted here.
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "blog", "billing", "careers", "changelog", "compare",
  "contact", "cookies", "customers", "dashboard", "dpa", "faq", "help",
  "inbox", "incidents", "onboarding", "pricing", "privacy", "refund",
  "releases", "reports", "reviews", "settings", "sign-in", "sign-up",
  "status", "support", "terms", "www",
]);

const TRIAL_DAYS = 14;

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
    // `workspaces.brand_voice` is TEXT with a 500-char check, and every
    // consumer (workspace-persona, Settings) treats it as prose that goes
    // straight into the AI prompt. Storing the config object here serialised
    // raw JSON into the prompt, and a generous word list blew the check
    // constraint and 500'd onboarding. Store the rendered sentence only.
    let brandVoiceValue: string | undefined;
    if (brandVoice) {
      brandVoiceValue = buildBrandVoiceText(brandVoice).slice(0, 500);
    } else if (appCategory) {
      brandVoiceValue = getBrandVoiceStub(appCategory)?.slice(0, 500);
    }

    const wsInsert = await sb
      .from("workspaces")
      .insert({
        name:           workspaceName.trim(),
        slug:           cleanSlug,
        plan:           "trial",
        trial_ends_at:  new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
        app_category:   appCategory ?? null,
        brand_voice:    brandVoiceValue ?? null,
      })
      .select("id")
      .single();

    if (wsInsert.error?.code === "23505") return apiError("SLUG_TAKEN", 409);
    if (wsInsert.error) {
      console.error("[onboarding/setup] workspace insert:", wsInsert.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
    workspaceId = wsInsert.data!.id as string;

    // Roll back the orphan workspace if membership fails. Without this the
    // workspace row survives holding the slug, the user has no membership so
    // getWorkspaceId() returns null forever, and retrying setup hits 23505 —
    // the user is locked out of their own workspace name by their own orphan.
    // /api/onboarding/complete already guards this; setup never did.
    const memberInsert = await sb.from("workspace_members").insert({
      workspace_id: workspaceId,
      clerk_user_id: userId,
      role: "owner",
    });

    if (memberInsert.error) {
      console.error("[onboarding/setup] member insert:", memberInsert.error);
      await sb.from("workspaces").delete().eq("id", workspaceId);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
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
    let metaCountry: string | null = null;

    if (storeId) {
      try {
        // Confirms the storefront the client saw, or probes for the right one.
        // Persisting it matters: a region-locked app scraped against the US
        // storefront returns zero reviews on every future sync.
        const meta = await resolveAppMetadata(platform, storeId, body.country);
        if (meta) {
          metaIcon    = meta.icon ?? metaIcon;
          metaDev     = meta.developer || metaDev;
          metaRating  = meta.rating ?? metaRating;
          metaCount   = meta.reviewCount ?? null;
          metaCountry = meta.country ?? null;
        }
      } catch (err) {
        console.warn("[onboarding/setup] metadata fetch failed:", err);
      }
    }

    const dbPlatform = platform.replace("-", "_");
    let appInsert = await sb
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
        store_country:         metaCountry,
      })
      .select("id")
      .single();

    // 42703 = a metadata column doesn't exist yet (migration 012 / 019 not
    // applied). Retry without them rather than failing onboarding outright.
    if (appInsert.error?.code === "42703") {
      appInsert = await sb
        .from("apps")
        .insert({
          workspace_id: workspaceId,
          name:         appName.trim(),
          platform:     dbPlatform,
          store_id:     storeId,
        })
        .select("id")
        .single();
    }

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
  //
  // Runs in-process via after(), AFTER the response is sent. A fire-and-forget
  // HTTP self-fetch is unreliable here: Vercel freezes the lambda on response,
  // and without CRON_SECRET the sync route rejects cookieless server-to-server
  // calls in production — the two failure modes that left new dashboards empty.
  if (isNew) {
    after(async () => {
      try {
        await syncWorkspace(workspaceId);
      } catch (err) {
        console.error("[onboarding/setup] bootstrap sync failed:", err);
      }
    });
  }

  // Stamp the trial as soon as the workspace exists, not at /complete.
  //
  // The wizard's last two steps include a forced ~10s wait, and a user who
  // closed the tab there never reached /complete — the only place that used to
  // set plan + trialEndsAt. They came back to a workspace whose Clerk metadata
  // had no plan at all, so /api/reply/draft resolved them to 0 AI drafts a day
  // and told them "AI draft limit reached for your plan", while
  // /api/onboarding/state reported them onboarded and refused to send them
  // back through the wizard. /complete still runs this (both are idempotent —
  // existing values are preserved); doing it here just removes the window.
  after(async () => {
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          plan: clerkUser.publicMetadata?.plan ?? "trial",
          trialEndsAt:
            clerkUser.publicMetadata?.trialEndsAt ??
            new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
        },
      });
    } catch (err) {
      console.error("[onboarding/setup] trial stamp failed:", err);
    }
  });

  return NextResponse.json({ workspaceId, appId });
}
