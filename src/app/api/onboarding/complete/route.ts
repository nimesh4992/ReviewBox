import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/api-response";
import {
  getBrandVoiceStub,
  STARTER_REPLY_TEMPLATES,
  type AppCategory,
} from "@/lib/brand-voice-stubs";
import { fetchAppMetadata } from "@/services/store-search";

interface OnboardingBody {
  workspaceName: string;
  workspaceSlug: string;
  appName:       string;
  platform:      "google-play" | "app-store";
  storeId?:      string;
  /** App category selected during onboarding — used to pre-fill brand voice. */
  appCategory?:  AppCategory;
  /** App metadata captured at search time. We refresh from the store too. */
  icon?:         string | null;
  developer?:    string | null;
  rating?:       number | null;
}

const TRIAL_DAYS = 14;

// Same pattern as /api/onboarding/slug-check — keep in sync.
// Requires minimum 3 chars: one leading alnum, 1-38 middle chars, one trailing alnum.
// The old pattern used (?:...)?$ which made the middle+trailing group optional,
// allowing single-character slugs despite the "3-40 chars" error message.
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "blog", "billing", "careers", "changelog", "compare",
  "contact", "cookies", "customers", "dashboard", "dpa", "faq", "help",
  "inbox", "incidents", "onboarding", "pricing", "privacy", "refund",
  "releases", "reports", "reviews", "settings", "sign-in", "sign-up",
  "status", "support", "terms", "www",
]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId  = session?.userId;

  if (!userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  // Cheap insurance against workspace-creation spam from a single user.
  const rl = await rateLimit(req, userId, { bucket: "onboarding-complete", limit: 5, window: "10 m" });
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", 429);
  }

  const body = (await req.json()) as OnboardingBody;
  const { workspaceName, workspaceSlug, appName, platform, storeId = "", appCategory } = body;

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

  // Idempotency: if this user already has a workspace, reuse it
  const { data: existingMember } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let workspaceId: string;

  const workspaceWasJustCreated = !existingMember?.workspace_id;

  if (existingMember?.workspace_id) {
    workspaceId = existingMember.workspace_id as string;
  } else {
    // Pre-fill brand_voice from category stub so AI replies are good from day 1
    const brandVoice = appCategory ? getBrandVoiceStub(appCategory) : undefined;

    let wsInsert = await sb
      .from("workspaces")
      .insert({
        name:         workspaceName,
        slug:         cleanSlug,
        plan:         "trial",
        app_category: appCategory ?? null,
        brand_voice:  brandVoice ?? null,
      })
      .select("id")
      .single();

    // 42703 = "column does not exist" — migrations 007/008 not yet run in prod.
    // Fall back to inserting without those columns so onboarding still works.
    if (wsInsert.error?.code === "42703") {
      wsInsert = await sb
        .from("workspaces")
        .insert({ name: workspaceName, slug: cleanSlug, plan: "trial" })
        .select("id")
        .single();
    }

    const { data: workspace, error: wsError } = wsInsert;

    if (wsError) {
      if (wsError.code === "23505") {
        return apiError("SLUG_TAKEN", 409);
      }
      console.error("[onboarding] workspace insert:", wsError);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    workspaceId = workspace.id as string;

    const { error: memberError } = await sb
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, clerk_user_id: userId, role: "owner" });

    if (memberError) {
      console.error("[onboarding] member insert:", memberError);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
  }

  // Seed starter Reply-Kit templates for new workspaces
  // Non-blocking — fires only for freshly created workspaces
  if (workspaceWasJustCreated) {
    const templates = STARTER_REPLY_TEMPLATES.map((t) => ({
      workspace_id: workspaceId,
      name:         t.name,
      content:      t.content,
      tags:         t.tags,
      rating_min:   t.rating_min,
      rating_max:   t.rating_max,
      usage_count:  0,
    }));
    void sb.from("reply_templates")
      .insert(templates)
      .then(({ error }) => {
        if (error) console.error("[onboarding] template seed:", error);
      });
  }

  // Idempotency: only insert app if none exists for this workspace
  const { data: existingApp } = await sb
    .from("apps")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  let appId: string;

  if (existingApp?.id) {
    appId = existingApp.id as string;
  } else {
    const dbPlatform = platform.replace("-", "_");

    // Fetch lifetime metadata from the store. Falls back to the values the
    // client sent (from search), then nulls if the store fetch fails too.
    // Done before insert so the app row has icon + rating from row 1.
    let metaIcon = body.icon ?? null;
    let metaDeveloper = body.developer ?? null;
    let metaRating = body.rating ?? null;
    let metaReviewCount: number | null = null;
    if (storeId) {
      try {
        const fetched = await fetchAppMetadata(platform, storeId);
        if (fetched) {
          metaIcon         = fetched.icon ?? metaIcon;
          metaDeveloper    = fetched.developer || metaDeveloper;
          metaRating       = fetched.rating ?? metaRating;
          metaReviewCount  = fetched.reviewCount ?? null;
        }
      } catch (err) {
        console.warn("[onboarding] app metadata fetch failed:", err);
      }
    }

    let appInsert = await sb
      .from("apps")
      .insert({
        workspace_id:           workspaceId,
        name:                   appName,
        platform:               dbPlatform,
        store_id:               storeId,
        icon_url:               metaIcon,
        developer:              metaDeveloper,
        lifetime_rating:        metaRating,
        lifetime_review_count:  metaReviewCount,
        metadata_refreshed_at:  metaIcon || metaRating ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    // 42703 = column does not exist — migration 012 not yet applied. Fall
    // back to inserting without metadata columns so onboarding still works.
    if (appInsert.error?.code === "42703") {
      appInsert = await sb
        .from("apps")
        .insert({
          workspace_id: workspaceId,
          name:         appName,
          platform:     dbPlatform,
          store_id:     storeId,
        })
        .select("id")
        .single();
    }

    if (appInsert.error) {
      console.error("[onboarding] app insert:", appInsert.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
    appId = appInsert.data!.id as string;
  }

  // Kick off the first review sync immediately so the user doesn't have to
  // wait up to 24h for the daily cron. Fire-and-forget — non-blocking so
  // the response isn't held up by Google Play API latency.
  // Google Play sync takes 5–15s; App Store needs credentials so it'll
  // be a no-op until the user adds them in Settings.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;
  void fetch(`${appUrl}/api/sync/reviews?workspaceId=${workspaceId}`, {
    method: "GET",
    headers: cronSecret ? { authorization: `Bearer ${cronSecret}` } : {},
  }).catch((err) => {
    console.error("[onboarding] first-sync trigger:", err);
  });

  // Mark user as onboarded + set trial window + fire welcome email
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const alreadyOnboarded = clerkUser.publicMetadata?.onboarded === true;

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        onboarded: true,
        plan: clerkUser.publicMetadata?.plan ?? "trial",
        trialEndsAt: clerkUser.publicMetadata?.trialEndsAt ?? trialEndsAt,
      },
    });

    if (!alreadyOnboarded) {
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      const name =
        clerkUser.firstName ??
        email?.split("@")[0] ??
        "there";

      if (email) {
        // Non-blocking — don't await so the response isn't delayed
        sendWelcomeEmail(email, name).catch((err) =>
          console.error("[onboarding] welcome email:", err),
        );
      }
    }
  } catch (err) {
    // Non-fatal — workspace created, just metadata/email failed
    console.error("[onboarding] post-create hooks:", err);
  }

  if (workspaceWasJustCreated) {
    await audit({
      workspaceId,
      actorUserId: userId,
      action: "workspace.create",
      targetType: "workspace",
      targetId: workspaceId,
      payload: { workspaceName, workspaceSlug: cleanSlug, platform, appName },
      request: req,
    });
  }

  // Middleware no longer enforces an onboarding gate, so no cookie hint
  // is needed. Onboarding routing is page-level — see middleware.ts comment.
  return NextResponse.json({ workspaceId, appId }, { status: 200 });
}
