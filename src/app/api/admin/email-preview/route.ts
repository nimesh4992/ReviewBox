/**
 * GET /api/admin/email-preview?template=welcome
 *
 * Renders an email with sample data so it can be looked at in a browser.
 *
 * Email is the one surface with no preview environment — you find out it is
 * broken by sending it to a customer. Every template in this file was reviewed
 * by rendering it here first. Sample data is realistic on purpose: lorem ipsum
 * hides the layout problems that real names and real 200-character review text
 * cause.
 *
 * Admin-gated, read-only, sends nothing.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-response";
import {
  dailyDigestEmail,
  inviteEmail,
  monthlyDigestEmail,
  trialEndingEmail,
  welcomeEmail,
  type RenderedEmail,
} from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const SAMPLE_REVIEWS = [
  {
    id: "r1",
    author: "Vandita Sharma",
    rating: 1,
    body: "what's the point of having one new app for booking tickets when it won't work and now you have to stand in line to book a ticket and miss your train",
    meta: "Android v1.5",
  },
  {
    id: "r2",
    author: "Ravindra Panchal",
    rating: 4,
    body: "Checking the Ticket History tab gives a detailed breakdown of past rides with dates, times, and exact fares. It makes filing monthly expenses much easier.",
    meta: "Android v1.5",
  },
  {
    id: "r3",
    author: "mikhail dsouza",
    rating: 1,
    body: "took my money and didn't confirm ticket. absolute chor behaviour",
    meta: "Android v1.5",
  },
];

const TEMPLATES: Record<string, () => RenderedEmail> = {
  welcome: () =>
    welcomeEmail({ appName: "Mumbai One", platform: "Google Play",
      iconUrl: "https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYr6JmMFmMfMYcRuFqSb=w240-h480", reviewCount: 20, needsReply: 14, rating: 3.1 }),

  "welcome-empty": () =>
    welcomeEmail({ appName: "Mumbai One", reviewCount: 0, needsReply: 0, rating: null }),

  "trial-midway": () =>
    trialEndingEmail({
      appName: "Mumbai One",
      daysLeft: 7,
      repliesPublished: 12,
      reviewsHandled: 47,
      extendAvailable: true,
    }),

  "trial-ending": () =>
    trialEndingEmail({
      appName: "Mumbai One",
      daysLeft: 2,
      repliesPublished: 12,
      reviewsHandled: 47,
      extendAvailable: true,
    }),

  "trial-ended": () =>
    trialEndingEmail({
      appName: "Mumbai One",
      daysLeft: 0,
      repliesPublished: 12,
      reviewsHandled: 47,
      extendAvailable: true,
    }),

  invite: () =>
    inviteEmail({
      inviterName: "Nimesh",
      workspaceName: "AT WORK",
      appName: "Mumbai One",
      inviteUrl: "https://app.tryreviewbox.com/invite/sample-token",
      expiresInDays: 14,
    }),

  "daily-digest": () =>
    dailyDigestEmail({
      appName: "Mumbai One",
      platform: "Google Play",
      iconUrl: "https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYr6JmMFmMfMYcRuFqSb=w240-h480",
      distribution: [9, 1, 3, 4, 3],
      newReviews: 3,
      needsReply: 12,
      rating: 3.1,
      ratingDelta: -0.08,
      reviews: SAMPLE_REVIEWS,
      quietDay: false,
      unsubscribeUrl: "https://app.tryreviewbox.com/settings",
    }),

  "daily-digest-quiet": () =>
    dailyDigestEmail({
      appName: "Mumbai One",
      newReviews: 0,
      needsReply: 12,
      rating: 3.1,
      ratingDelta: null,
      reviews: [SAMPLE_REVIEWS[0]],
      quietDay: true,
      unsubscribeUrl: "https://app.tryreviewbox.com/settings",
    }),

  "monthly-digest": () =>
    monthlyDigestEmail({
      appName: "Mumbai One",
      platform: "Google Play",
      iconUrl: "https://play-lh.googleusercontent.com/8ddL1kuoNUB5vUvgDVjYY3_6HwQcrg1K2fd_R8soD-e2QYr6JmMFmMfMYcRuFqSb=w240-h480",
      distribution: [18, 4, 6, 9, 10],
      monthLabel: "August",
      rating: 3.1,
      ratingDelta: 0.14,
      totalReviews: 47,
      repliesPublished: 42,
      replyRate: 89,
      topThemes: [
        { label: "Ticket booking failures", count: 18, sentiment: "negative" },
        { label: "Payment and refunds", count: 11, sentiment: "negative" },
        { label: "Ticket history", count: 7, sentiment: "positive" },
        { label: "App speed", count: 6, sentiment: "mixed" },
      ],
      unsubscribeUrl: "https://app.tryreviewbox.com/settings",
    }),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await requireAdminUser())) return apiError("FORBIDDEN", 403);

  const name = req.nextUrl.searchParams.get("template") ?? "";
  const format = req.nextUrl.searchParams.get("format");

  const render = TEMPLATES[name];
  if (!render) {
    const links = Object.keys(TEMPLATES)
      .map(
        (t) =>
          `<li style="margin:6px 0"><a href="?template=${t}" style="color:#0A84FF">${t}</a> · <a href="?template=${t}&format=text" style="color:#86868B;font-size:13px">text</a> · <a href="?template=${t}&format=subject" style="color:#86868B;font-size:13px">subject</a></li>`,
      )
      .join("");
    return new NextResponse(
      `<body style="font-family:-apple-system,sans-serif;padding:40px;background:#F5F5F7">
         <h1 style="font-size:18px">Email previews</h1>
         <ul style="padding-left:18px">${links}</ul>
       </body>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  const email = render();

  if (format === "text") {
    return new NextResponse(email.text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  if (format === "subject") {
    return NextResponse.json({ subject: email.subject });
  }

  return new NextResponse(email.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
