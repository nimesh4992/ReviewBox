import { getResend, FROM } from "./client";
import { getServiceClient } from "@/lib/supabase-server";
import { welcomeEmail } from "./templates";

/**
 * The first email, sent once the first sync has finished.
 *
 * It used to fire the instant the workspace row was written, which meant it
 * could only ever say "welcome, here are three things to try" — a feature tour
 * to someone who has not yet seen the product work on their own app. Sending it
 * after the sync lets it say "2,943 reviews, 12 with no reply yet", which is
 * the same email doing an entirely different job.
 *
 * Every step is best-effort. A welcome email is never worth failing onboarding
 * over, so a missing app row or a failed count degrades to the honest
 * "we are still pulling your reviews" variant rather than throwing.
 */
export async function sendWelcomeEmail(
  to: string,
  workspaceId: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping welcome email");
    return;
  }

  const r = getResend();
  if (!r) return;

  let appName      = "your app";
  let iconUrl: string | null = null;
  let platform     = "Google Play";
  let reviewCount  = 0;
  let needsReply   = 0;
  let rating: number | null = null;

  try {
    const sb = getServiceClient();

    // `lifetime_rating` and `icon_url` arrive with migrations 012/022. Read
    // them separately from the columns that have existed since 001, so a
    // database that has not caught up still yields the app name rather than
    // dropping the whole row and falling back to "your app".
    const selectApp = (columns: string) =>
      sb
        .from("apps")
        .select(columns)
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    let { data: app } = await selectApp("id, name, icon_url, platform, lifetime_rating");
    if (!app) ({ data: app } = await selectApp("id, name, platform"));

    if (app) {
      const row  = app as unknown as Record<string, unknown>;
      appName  = (row.name as string) || appName;
      iconUrl  = (row.icon_url as string | null) ?? null;
      platform = row.platform === "app_store" ? "App Store" : "Google Play";
      const storeRating = Number(row.lifetime_rating);
      rating = Number.isFinite(storeRating) && storeRating > 0 ? storeRating : null;

      const appId = row.id as string;
      const [total, unreplied] = await Promise.all([
        sb.from("reviews").select("id", { count: "exact", head: true })
          .eq("app_id", appId),
        sb.from("reviews").select("id", { count: "exact", head: true })
          .eq("app_id", appId).eq("reply_status", "needs_reply"),
      ]);

      reviewCount = total.count ?? 0;
      needsReply  = unreplied.count ?? 0;
    }
  } catch (err) {
    // Falls through to the reviewCount === 0 variant, which says we are still
    // pulling — true enough, and better than not writing at all.
    console.error("[email] welcome: could not read workspace state:", err);
  }

  const message = welcomeEmail({ appName, iconUrl, platform, reviewCount, needsReply, rating });

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    console.error("[email] Failed to send welcome email:", error);
  }
}
