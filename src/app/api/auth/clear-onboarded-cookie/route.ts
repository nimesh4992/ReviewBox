/**
 * POST /api/auth/clear-onboarded-cookie
 *
 * Clears the rb_onboarded cookie. Called from the UserMenu component
 * BEFORE Clerk's signOut() so a different user signing in on the same
 * browser within the 5-minute cookie TTL isn't mis-classified as
 * already-onboarded by middleware.
 *
 * No auth check — the cookie is per-browser, not per-user, and clearing
 * it is harmless.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("rb_onboarded", "", {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
