import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { submitReply as submitGooglePlayReply } from "@/services/google-play/publisher-api";
import {
  buildJWT,
  submitReply as submitAppStoreReply,
} from "@/services/app-store/connect-api";

interface ReplyRequestBody {
  replyText: string;
  status: "sent" | "draft";
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
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
    }

    const { id: reviewId } = await params;
    const body = (await req.json()) as ReplyRequestBody;
    const { replyText, status } = body;

    if (!replyText?.trim() || !status) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
    }

    const sb = getServiceClient();

    // Fetch review + app info in one query
    const { data: review, error: lookupError } = await sb
      .from("reviews")
      .select("id, external_id, source, apps(store_id, platform, access_token, refresh_token)")
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId)
      .single();

    if (lookupError || !review) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // ── Publish to store if status = "sent" ──────────────────────────────────

    if (status === "sent") {
      type AppInfo = { store_id: string; platform: string; access_token: string | null; refresh_token: string | null };
      const app = (Array.isArray(review.apps) ? review.apps[0] : review.apps) as AppInfo | null;

      try {
        if (app?.platform === "google_play") {
          await submitGooglePlayReply(app.store_id, review.external_id, replyText.trim());
        } else if (app?.platform === "app_store") {
          if (!app.access_token || !app.refresh_token) {
            return NextResponse.json({ error: "APP_STORE_NOT_CONNECTED" }, { status: 422 });
          }
          const creds = JSON.parse(app.access_token) as { keyId: string; issuerId: string };
          const jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token);
          await submitAppStoreReply(review.external_id, replyText.trim(), jwt);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[reply] store submit failed:", msg);

        if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
          return NextResponse.json({ error: "STORE_RATE_LIMITED" }, { status: 429 });
        }
        if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
          return NextResponse.json({ error: "REVIEW_NOT_FOUND_ON_STORE" }, { status: 422 });
        }
        return NextResponse.json({ error: "STORE_SUBMIT_FAILED", detail: msg }, { status: 502 });
      }
    }

    // ── Persist to Supabase ───────────────────────────────────────────────────

    const { error: updateError } = await sb
      .from("reviews")
      .update({
        reply_text:   replyText.trim(),
        reply_status: status === "sent" ? "replied" : "draft_ready",
        replied_at:   status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error("[reply] Supabase update failed:", updateError);
      return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: status === "sent" ? "reply.publish" : "reply.draft.generate",
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
    console.error("[reply] unexpected:", err);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }
}
