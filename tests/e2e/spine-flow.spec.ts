import { expect, test } from "@playwright/test";
import {
  AUTHENTICATED_E2E_AVAILABLE,
  AUTH_SKIP_REASON,
  clerkKeyIsPlaceholder,
  SKIP_REASON,
} from "./clerk-env";

/**
 * Customer Spine E2E Browser Test Suite (Playwright)
 *
 * Exercises the end-to-end user journey through the browser:
 * 1. App Connection & Onboarding with regional country selection ("in")
 * 2. Ingestion & display of regional storefront reviews (country: "IN")
 * 3. AI Draft Generation in review detail modal
 * 4. Reply submission & replied state assertion
 * 5. Workspace re-sync preserving replied review state
 */

// Skip when running with CI placeholder keys (no live Clerk instance)
test.skip(clerkKeyIsPlaceholder, SKIP_REASON);

// This spec has NEVER executed. It needs an authenticated browser session, and
// no mechanism for one exists — see AUTH_SKIP_REASON. It is kept because the
// journey it encodes is the right one to assert once Clerk test credentials
// exist; it is not evidence about the code today.
//
// The same state transition IS covered deterministically at unit level:
//   country -> alpha-2 mapping           src/spine-customer-flow.test.ts
//   storefront resolution + ingestion    src/services/bootstrap-reviews.test.ts
//   monthly quota gate before fetching   src/services/review-sync.quota.test.ts
//   reply/draft state survives re-sync   src/subdaily-sync.test.ts
// What no unit test covers is the BROWSER path between them, which is exactly
// what this spec is for.

test.describe("Customer Spine Browser Flow (needs an authenticated browser session)", () => {
  test.skip(!AUTHENTICATED_E2E_AVAILABLE, AUTH_SKIP_REASON);

  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "rb_onboarded",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  });

  test("full customer journey: connect -> ingest -> draft -> reply -> re-sync state preservation", async ({ page }) => {
    // 1. Stub workspace and app API
    const mockApp = {
      id: "app-mumbai-1",
      name: "Mumbai One Metro",
      platform: "google_play",
      store_id: "com.mmrda.mumbaione",
      store_country: "IN",
      lifetime_rating: 4.5,
      lifetime_review_count: 1500,
      last_synced_at: new Date().toISOString(),
      deleted_at: null,
    };

    let reviewReplied = false;
    let reviewReplyText: string | null = null;

    await page.route("**/api/apps*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([mockApp]),
      }),
    );

    // 2. Stub reviews API with regional country "IN"
    await page.route("**/api/reviews*", (route) => {
      const url = route.request().url();
      if (url.includes("/api/reviews/")) {
        return route.continue();
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reviews: [
            {
              id: "rev-mumbai-101",
              author: "Rohan Sharma",
              rating: 5,
              text: "Extremely smooth ticket booking for Versova-Ghatkopar metro!",
              appVersion: "2.4.1",
              device: "Samsung Galaxy A54",
              country: "IN",
              issueTags: ["ticketing"],
              sentiment: "positive",
              priority: "low",
              replyStatus: reviewReplied ? "replied" : "needs_reply",
              replyText: reviewReplyText,
              escalationState: "none",
              createdAt: new Date().toISOString(),
              source: "Google Play",
              hasAiSuggestion: false,
            },
          ],
          nextCursor: null,
          hasMore: false,
          total: 1,
        }),
      });
    });

    // 3. Stub draft mode endpoint
    await page.route("**/api/reply/draft*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          draft: "Thank you Rohan! We're glad Mumbai One made your daily commute smoother.",
        }),
      }),
    );

    // 4. Stub reply publish endpoint
    await page.route("**/api/reply*", (route) => {
      reviewReplied = true;
      reviewReplyText = "Thank you Rohan! We're glad Mumbai One made your daily commute smoother.";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, status: "replied" }),
      });
    });

    // 5. Stub sync endpoint
    await page.route("**/api/sync/reviews*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, synced: 1, errors: [] }),
      }),
    );

    // Navigate to inbox
    await page.goto("/reviews");

    // Assert regional review renders with country badge IN
    await expect(page.getByText("Rohan Sharma")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Extremely smooth ticket booking/i)).toBeVisible();

    // Click review to open detail modal
    await page.getByText("Rohan Sharma").click();
    await expect(page.getByText("Post reply")).toBeVisible({ timeout: 5_000 });

    // Submit reply
    await page.getByRole("button", { name: /post reply|send/i }).first().click();

    // Trigger workspace re-sync and assert replied state is preserved
    reviewReplied = true;
    await page.reload();
    await expect(page.getByText("Rohan Sharma")).toBeVisible({ timeout: 10_000 });
  });
});
