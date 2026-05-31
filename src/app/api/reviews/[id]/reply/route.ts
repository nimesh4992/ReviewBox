import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import { submitReply as submitGooglePlayReply } from "@/services/google-play/publisher-api";
import {
  buildJWT,
  submitReply as submitAppStoreReply,
} from "@/services/app-store/connect-api";

interface ReplyRequestBody {
  replyText:    string;
  // "sent"          → post to the store via API, then mark replied (Pro / connected accounts)
  // "manual_replied"→ user posted the reply themselves (copy-paste into the store console);
  //                   mark replied in our DB WITHOUT calling the store API (Draft Mode, D018)
  // "draft"         → save as draft_ready, no store call
  status:       "sent" | "manual_replied" | "draft";
  /** Which tier generated the draft (reply-kit|template|cache|groq|gemini|composer|manual) */
  draftSource?: string;
  /** True if the user edited the AI draft before sending */
  draftEdited?: boolean;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // 30 reply publishes per 10 min — protects store APIs from abuse.
    const rl = await rateLimit(req, userId, { bucket: "reply-publish", limit: 30, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    // Block writes if workspace is soft-deleted (in 30-day restore grace)
    const sbCheck = getServiceClient();
    const { data: ws } = await sbCheck
      .from("workspaces")
      .select("deleted_at")
      .eq("id", workspaceId)
      .maybeSingle();
    if (ws?.deleted_at) {
      return apiError("WORKSPACE_DELETED", 403);
    }

    const { id: reviewId } = await params;
    const body = (await req.json()) as ReplyRequestBody;
    const { replyText, status, draftSource, draftEdited } = body;

    if (!replyText?.trim() || !status) {
      return apiError("MISSING_FIELDS", 400);
    }

    // Store-side character limits enforced server-side to prevent silent failures:
    // Google Play rejects replies > 350 chars; App Store Connect rejects > 5950 chars.
    // Without this check the DB gets reply_status='replied' but nothing appears in the store.
    const REPLY_CHAR_LIMITS: Record<string, number> = {
      google_play: 350,
      app_store:   5950,
    };

    const sb = getServiceClient();

    // Fetch review + app info in one query
    const { data: review, error: lookupError } = await sb
      .from("reviews")
      .select("id, external_id, source, apps(store_id, platform, access_token, refresh_token)")
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId)
      .single();

    if (lookupError || !review) {
      return apiError("NOT_FOUND", 404);
    }

    // ── Publish to store if status = "sent" ──────────────────────────────────

    if (status === "sent") {
      type AppInfo = { store_id: string; platform: string; access_token: string | null; refresh_token: string | null };
      const app = (Array.isArray(review.apps) ? review.apps[0] : review.apps) as AppInfo | null;

      // Validate length against the store's hard limit before attempting submit.
      if (app?.platform && REPLY_CHAR_LIMITS[app.platform]) {
        const limit = REPLY_CHAR_LIMITS[app.platform];
        if (replyText.trim().length > limit) {
          return apiError(
            "REPLY_TOO_LONG",
            400,
            `Reply exceeds the ${limit}-character limit for ${app.platform === "google_play" ? "Google Play" : "App Store"}.`,
          );
        }
      }

      try {
        if (app?.platform === "google_play") {
          await submitGooglePlayReply(app.store_id, review.external_id, replyText.trim());
        } else if (app?.platform === "app_store") {
          if (!app.access_token || !app.refresh_token) {
            return apiError("APP_STORE_NOT_CONNECTED", 422);
          }
          const creds = JSON.parse(app.access_token) as { keyId: string; issuerId: string };
          const jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token);
          await submitAppStoreReply(review.external_id, replyText.trim(), jwt);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[reply] store submit failed:", msg);

        if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
          return apiError("STORE_RATE_LIMITED", 429);
        }
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          return apiError("REVIEW_NOT_FOUND_ON_STORE", 422);
        }
        return apiError("STORE_SUBMIT_FAILED", 502, msg);
      }
    }

    // ── Persist to Supabase ───────────────────────────────────────────────────

    // Both "sent" (API post) and "manual_replied" (user pasted it themselves)
    // mean the reply is live on the store → reply_status = "replied".
    const isReplied = status === "sent" || status === "manual_replied";

    const { error: updateError } = await sb
      .from("reviews")
      .update({
        reply_text:   replyText.trim(),
        reply_status: isReplied ? "replied" : "draft_ready",
        replied_at:   isReplied ? new Date().toISOString() : null,
        ...(draftSource !== undefined && { draft_source: draftSource }),
        ...(draftEdited !== undefined && { draft_edited: draftEdited }),
      })
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error("[reply] Supabase update failed:", updateError);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: status === "sent" ? "reply.publish"
            : status === "manual_replied" ? "reply.mark_replied"
            : "reply.draft.generate",
      targetType: "review",
      targetId: reviewId,
      payload: {
        replyLength: replyText.trim().length,
        source: (review.apps && (Array.isArray(review.apps) ? review.apps[0]?.platform : (review.apps as { platform?: string }).platform)) ?? null,
      },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return captureAndError(err, "POST /api/reviews/[id]/reply");
  }
}
