/**
 * POST /api/apps/[id]/test-credentials
 *
 * Validates the App Store Connect credentials stored on the given app
 * by actually attempting to build a JWT and call the Apple API. Returns
 * a clear { ok, message } so the user can see exactly what's wrong.
 *
 * Auth: signed-in workspace members only. Workspace-scoped — a user
 * can't test someone else's app.
 *
 * For Google Play apps this is a no-op (the service account is shared
 * across the whole product; we don't need to test it per-app).
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { buildJWT, fetchAppStoreId } from "@/services/app-store/connect-api";
import { fetchReviews as fetchGooglePlayReviews } from "@/services/google-play/publisher-api";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface TestResult {
  ok: boolean;
  message: string;
  /** Apple's numeric app ID, if we resolved it. Display-only. */
  appStoreId?: string;
  /** ISO timestamp when this verification ran. */
  verifiedAt: string;
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse<TestResult>> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json(
      { ok: false, message: "Sign in first.", verifiedAt: new Date().toISOString() },
      { status: 401 },
    );
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, message: "No workspace found.", verifiedAt: new Date().toISOString() },
      { status: 404 },
    );
  }

  const { id: appId } = await params;
  const sb = getServiceClient();

  const { data: app } = await sb
    .from("apps")
    .select("id, platform, store_id, access_token, refresh_token")
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!app) {
    return NextResponse.json(
      { ok: false, message: "App not found.", verifiedAt: new Date().toISOString() },
      { status: 404 },
    );
  }

  const verifiedAt = new Date().toISOString();

  // ── Google Play: call the Publisher API with the app's package name ───────────
  if (app.platform === "google_play") {
    try {
      await fetchGooglePlayReviews(app.store_id as string);
      // If we reach here, the service account has access.
      await sb
        .from("apps")
        .update({ last_sync_status: "credentials_verified", last_sync_error: null })
        .eq("id", appId);
      return NextResponse.json(
        {
          ok: true,
          message:
            `Service account verified — ReviewBox can read reviews for ${app.store_id}. You're ready to sync.`,
          verifiedAt,
        },
        { status: 200 },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lower = msg.toLowerCase();

      if (lower.includes("403") || lower.includes("forbidden") || lower.includes("permission")) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Service account doesn't have access yet. Complete the invite steps below, then wait up to 5 minutes for Google to propagate permissions.",
            verifiedAt,
          },
          { status: 200 },
        );
      }
      if (lower.includes("404") || lower.includes("not found")) {
        return NextResponse.json(
          {
            ok: false,
            message: `App '${app.store_id}' not found in Google Play. Check the package name is correct.`,
            verifiedAt,
          },
          { status: 200 },
        );
      }
      if (lower.includes("timeout")) {
        return NextResponse.json(
          {
            ok: false,
            message:
              "Google Play API timed out. This is usually a transient issue — try again in a few seconds.",
            verifiedAt,
          },
          { status: 200 },
        );
      }
      return NextResponse.json(
        {
          ok: false,
          message: `Google Play API error: ${msg.slice(0, 200)}`,
          verifiedAt,
        },
        { status: 200 },
      );
    }
  }

  // ── App Store: actually call Apple's API ────────────────────────────────────

  if (!app.access_token || !app.refresh_token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Credentials not saved yet. Paste your Key ID, Issuer ID, and .p8 private key below.",
        verifiedAt,
      },
      { status: 400 },
    );
  }

  let creds: { keyId: string; issuerId: string };
  try {
    creds = JSON.parse(app.access_token as string) as { keyId: string; issuerId: string };
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Stored credential metadata is corrupted. Re-paste your Key ID and Issuer ID.",
        verifiedAt,
      },
      { status: 400 },
    );
  }

  let jwt: string;
  try {
    jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token as string);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Couldn't sign a JWT with your .p8 key — Apple rejected the key format. Re-download the .p8 file from App Store Connect and paste it exactly as-is (with the BEGIN/END lines).",
        verifiedAt,
      },
      { status: 400 },
    );
  }

  let appStoreId: string | null = null;
  try {
    appStoreId = await fetchAppStoreId(app.store_id as string, jwt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes("401") || lower.includes("unauthorized")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apple rejected the credentials (401). The most common cause: the Key ID or Issuer ID doesn't match the .p8 file. Double-check all three came from the same row in App Store Connect → Users & Access → Integrations → Keys.",
          verifiedAt,
        },
        { status: 200 },
      );
    }
    if (lower.includes("403")) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Apple authorized the key but it doesn't have access to this app's data (403). Set the key's access role to at least 'Customer Support'.",
          verifiedAt,
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        message: `Apple API call failed: ${msg.slice(0, 200)}`,
        verifiedAt,
      },
      { status: 200 },
    );
  }

  if (!appStoreId) {
    return NextResponse.json(
      {
        ok: false,
        message: `Apple couldn't find an app with bundle ID '${app.store_id}' under this API key. Verify the bundle ID matches what's in App Store Connect.`,
        verifiedAt,
      },
      { status: 200 },
    );
  }

  // Success — record the verification timestamp on the app row.
  await sb
    .from("apps")
    .update({
      last_sync_status: "credentials_verified",
      last_sync_error: null,
      last_sync_attempted_at: verifiedAt,
    })
    .eq("id", appId);

  return NextResponse.json(
    {
      ok: true,
      message: `Credentials verified — Apple found your app (internal ID ${appStoreId}). You can sync reviews now.`,
      appStoreId,
      verifiedAt,
    },
    { status: 200 },
  );
}
