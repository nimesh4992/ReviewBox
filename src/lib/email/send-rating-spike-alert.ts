import { getResend, FROM } from "./client";

export async function sendRatingSpikeAlert(
  to: string,
  appName: string,
  version: string,
  negativeCount: number,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com"}/reviews`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Rating spike detected</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:#1e293b;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">ReviewBox</p>
            </td>
          </tr>
          <tr>
            <td style="background:#fef2f2;border-bottom:1px solid #fecaca;padding:12px 32px;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#b91c1c;">
                Rating spike detected — action recommended
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
                ${negativeCount} negative reviews in 24h
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
                <strong>${appName}</strong> version <strong>${version}</strong> has received
                ${negativeCount} reviews rated 1–2 stars in the last 24 hours. This may indicate
                a regression or incident in this release.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#dc2626;">
                    <a href="${dashboardUrl}"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      View reviews
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                You're receiving this because rating spike alerts are enabled for your workspace.
                Manage alerts at tryreviewbox.com/settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Rating spike detected for ${appName} v${version}: ${negativeCount} negative reviews in 24h.\n\nView reviews: ${dashboardUrl}`;

  const r = getResend();
  if (!r) return;

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `⚠️ Rating spike: ${appName} v${version} — ${negativeCount} negative reviews in 24h`,
    html,
    text,
  });

  if (error) console.error("[email] rating spike alert:", error);
}
