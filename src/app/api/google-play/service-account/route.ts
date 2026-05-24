/**
 * GET /api/google-play/service-account
 *
 * Returns the email address of the Google service account ReviewBox uses
 * to fetch reviews. Users add this email as a member of their Play Console
 * with "View app information" + "Reply to reviews" permissions.
 *
 * Email is not secret — it's a public-shareable identifier. Auth required
 * just to prevent random scraping.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const email = process.env.GOOGLE_CLIENT_EMAIL ?? null;
  return NextResponse.json({ email, configured: Boolean(email) });
}
