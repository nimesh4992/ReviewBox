import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/api-response";
import { writeWithOptionalColumns } from "@/lib/db-errors";
import {
  getBrandVoiceStub,
  STARTER_REPLY_TEMPLATES,
  type AppCategory,
} from "@/lib/brand-voice-stubs";
import { resolveAppMetadata } from "@/services/store-search";
import { syncWorkspace } from "@/services/review-sync";

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
  /** Storefront the client saw this app in (from search) — confirmed server-side. */
  country?:      string | null;
}

const TRIAL_DAYS = 14;

// The after() first-sync scrapes the public store (10–30s) — needs more than
// the default function budget so the sync isn't cut off mid-write.
export const maxDuration = 60;

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

    const wsInsert = await writeWithOptionalColumns<{ id: string }>(
      (payload) => sb.from("workspaces").insert(payload).select("id").single(),
      { name: workspaceName, slug: cleanSlug, plan: "trial" },
      {
        // Mirrors the Clerk trialEndsAt stamped below. The trial-nudge cron
        // and the admin customer pages read this column, so leaving it null
        // meant the day-5 and day-12 emails matched no workspace and silently
        // never sent, while admin showed a blank trial end date.
        trial_ends_at: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
        app_category:  appCategory ?? null,
        brand_voice:   brandVoice ?? null,
      },
    );

    if (wsInsert.droppedColumns.length) {
      console.warn(
        "[onboarding] workspace columns not in this database — inserted without:",
        wsInsert.droppedColumns.join(", "),
      );
    }

    const { data: workspace, error: wsError } = wsInsert;

    if (wsError || !workspace) {
      if (wsError?.code === "23505") {
        return apiError("SLUG_TAKEN", 409);
      }
      console.error("[onboarding] workspace insert:", wsError);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    workspaceId = workspace.id;

    const { error: memberError } = await sb
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, clerk_user_id: userId, role: "owner" });

    if (memberError) {
      console.error("[onboarding] member insert:", memberError);
      // Roll back the orphan workspace. Otherwise the slug is permanently
      // consumed (unique constraint) and getWorkspaceId returns null forever —
      // the user can never re-onboard with that slug.
      await sb.from("workspaces").delete().eq("id", workspaceId);
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

  // Idempotency: only insert app if a LIVE one exists for this workspace.
  // Must exclude soft-deleted apps — otherwise a returning user who deleted
  // their only app reuses the dead row and finishes onboarding with zero
  // active apps.
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
    const dbPlatform = platform.replace("-", "_");

    // Fetch lifetime metadata from the store. Falls back to the values the
    // client sent (from search), then nulls if the store fetch fails too.
    // Done before insert so the app row has icon + rating from row 1.
    let metaIcon = body.icon ?? null;
    let metaDeveloper = body.developer ?? null;
    let metaRating = body.rating ?? null;
    let metaReviewCount: number | null = null;
    let metaCountry: string | null = null;
    if (storeId) {
      try {
        // Resolves WHICH storefront carries this app — a region-locked app
        // scraped against the US storefront yields zero reviews forever.
        const fetched = await resolveAppMetadata(platform, storeId, body.country);
        if (fetched) {
          metaIcon         = fetched.icon ?? metaIcon;
          metaDeveloper    = fetched.developer || metaDeveloper;
          metaRating       = fetched.rating ?? metaRating;
          metaReviewCount  = fetched.reviewCount ?? null;
          metaCountry      = fetched.country ?? null;
        }
      } catch (err) {
        console.warn("[onboarding] app metadata fetch failed:", err);
      }
    }

    // Metadata columns sit behind migrations 012 and 019; drop whichever this
    // database doesn't have rather than failing the whole insert.
    const appInsert = await writeWithOptionalColumns<{ id: string }>(
      (payload) => sb.from("apps").insert(payload).select("id").single(),
      {
        workspace_id: workspaceId,
        name:         appName,
        platform:     dbPlatform,
        store_id:     storeId,
      },
      {
        icon_url:               metaIcon,
        developer:              metaDeveloper,
        lifetime_rating:        metaRating,
        lifetime_review_count:  metaReviewCount,
        store_country:          metaCountry,
        metadata_refreshed_at:  metaIcon || metaRating ? new Date().toISOString() : null,
      },
    );

    if (appInsert.droppedColumns.length) {
      console.warn(
        "[onboarding] app columns not in this database — inserted without:",
        appInsert.droppedColumns.join(", "),
      );
    }

    if (appInsert.error) {
      console.error("[onboarding] app insert:", appInsert.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }
    appId = appInsert.data!.id as string;
  }

  // Kick off the first review sync so the dashboard has real public-store
  // data (rating + latest reviews) the moment the user lands on it — no
  // Play Console credentials needed (D018 Draft Mode).
  //
  // Runs via after(), in-process, AFTER the response is sent. The previous
  // fire-and-forget HTTP self-fetch died in production two ways: Vercel
  // freezes the lambda when the response returns (the request often never
  // left the box), and without CRON_SECRET the sync route rejected the
  // cookieless server-to-server call with a 401. Calling syncWorkspace()
  // directly needs no auth hop and after() keeps the invocation alive.
  after(async () => {
    try {
      await syncWorkspace(workspaceId);
    } catch (err) {
      console.error("[onboarding] first sync failed:", err);
    }
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
