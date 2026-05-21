import { getResend, FROM } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

export interface WeeklyDigestData {
  totalReviews:    number;
  avgRating:       number;
  urgentCount:     number;
  unrepliedCount:  number;
  topIssue:        string | null;
  appName:         string;
}

export async function sendWeeklyDigest(
  to: string,
  data: WeeklyDigestData,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const r = getResend();
  if (!r) return;

  const { totalReviews, avgRating, urgentCount, unrepliedCount, topIssue, appName } = data;

  const stars = "★".repeat(Math.round(avgRating)) + "☆".repeat(5 - Math.round(avgRating));
  const issueRow = topIssue
    ? `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-size:13px;color:#64748b;">Top issue tag</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
          <span style="font-size:13px;font-weight:600;color:#0f172a;">${topIssue}</span>
        </td>
      </tr>`
    : "";

  const urgentBanner = urgentCount > 0
    ? `<tr>
        <td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;font-size:13px;color:#b91c1c;font-weight:600;">
            🔴 ${urgentCount} urgent review${urgentCount === 1 ? "" : "s"} need${urgentCount === 1 ? "s" : ""} attention
          </p>
        </td>
      </tr>
      <tr><td style="height:16px;"></td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Your weekly review summary</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">ReviewBox</p>
              <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Weekly review digest</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#0f172a;">
                Your week in reviews
              </h1>
              <p style="margin:0 0 24px;font-size:14px;color:#64748b;">${appName}</p>

              ${urgentBanner}

              <!-- Stats table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:13px;color:#64748b;">Reviews this week</span>
                  </td>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:13px;font-weight:600;color:#0f172a;">${totalReviews}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:13px;color:#64748b;">Average rating</span>
                  </td>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:13px;font-weight:600;color:#0f172a;">${avgRating.toFixed(1)} ${stars}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;">
                    <span style="font-size:13px;color:#64748b;">Needs reply</span>
                  </td>
                  <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;text-align:right;">
                    <span style="font-size:13px;font-weight:600;color:${unrepliedCount > 10 ? "#dc2626" : "#0f172a"};">${unrepliedCount}</span>
                  </td>
                </tr>
                ${issueRow}
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#0A84FF;">
                    <a href="${APP_URL}/reviews"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Review queue →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Sent every Monday by ReviewBox. Manage notification preferences at
                <a href="${APP_URL}/settings" style="color:#0A84FF;text-decoration:none;">Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Weekly review digest — ${appName}`,
    ``,
    `Reviews this week: ${totalReviews}`,
    `Average rating: ${avgRating.toFixed(1)}`,
    `Needs reply: ${unrepliedCount}`,
    urgentCount > 0 ? `Urgent: ${urgentCount}` : null,
    topIssue ? `Top issue: ${topIssue}` : null,
    ``,
    `View queue: ${APP_URL}/reviews`,
  ].filter(Boolean).join("\n");

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `📊 Weekly digest: ${totalReviews} reviews, ${avgRating.toFixed(1)}★ avg — ${appName}`,
    html,
    text,
  });

  if (error) console.error("[email] weekly digest:", error);
}
