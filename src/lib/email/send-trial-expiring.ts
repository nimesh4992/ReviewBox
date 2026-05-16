import { getResend, FROM } from "./client";

export async function sendTrialExpiringEmail(
  to: string,
  name: string,
  daysLeft: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping trial-expiring email");
    return;
  }

  const dayLabel = daysLeft === 1 ? "day" : "days";
  const subject = `Your ReviewBox trial ends in ${daysLeft} ${dayLabel}`;

  const urgencyColor = daysLeft <= 1 ? "#dc2626" : daysLeft <= 3 ? "#d97706" : "#6366f1";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                R&nbsp;<span style="color:#6366f1;">|</span>&nbsp;ReviewBox
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${urgencyColor};text-transform:uppercase;letter-spacing:0.5px;">
                Trial ending soon
              </p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
                Hi ${name}, your free trial ends in ${daysLeft} ${dayLabel}
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
                Your ReviewBox free trial is almost over. Upgrade now to keep uninterrupted access to:
              </p>

              <!-- Features list -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <span style="color:#6366f1;font-weight:700;">✓</span>&nbsp; AI-generated reply suggestions
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <span style="color:#6366f1;font-weight:700;">✓</span>&nbsp; Automation rules and smart routing
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <span style="color:#6366f1;font-weight:700;">✓</span>&nbsp; Your full review history and data
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:${urgencyColor};">
                    <a
                      href="https://tryreviewbox.com/billing"
                      style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Upgrade my plan
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                No credit card was required to start your trial. You can cancel at any time after upgrading.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You're receiving this because your ReviewBox trial is expiring. To unsubscribe from
                marketing emails, reply with "unsubscribe" in the subject line.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

Your ReviewBox free trial ends in ${daysLeft} ${dayLabel}.

Upgrade now to keep access to:
- AI-generated reply suggestions
- Automation rules and smart routing
- Your full review history and data

Upgrade your plan: https://tryreviewbox.com/billing

---
You're receiving this because your ReviewBox trial is expiring. Reply "unsubscribe" to opt out of marketing emails.`;

  const r = getResend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    console.error("[email] Failed to send trial-expiring email:", error);
  }
}
