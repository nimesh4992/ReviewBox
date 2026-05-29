import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const clientId = process.env.SLACK_CLIENT_ID;
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!clientId) return apiError("SERVICE_UNAVAILABLE", 503, "Slack OAuth not configured");

  const state       = crypto.randomBytes(32).toString("hex");
  const redirectUri = `${appUrl}/api/auth/slack/callback`;

  const cookieStore = await cookies();
  cookieStore.set("slack_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path:     "/",
    maxAge:   600,
  });

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id",     clientId);
  url.searchParams.set("scope",         "incoming-webhook,channels:read,groups:read");
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("state",         state);

  return NextResponse.redirect(url);
}
