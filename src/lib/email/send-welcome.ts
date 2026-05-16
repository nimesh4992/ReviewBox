import { getResend, FROM } from "./client";

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping welcome email");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to ReviewBox</title>
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
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">
                Hi ${name} 👋
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#475569;line-height:1.6;">
                Welcome to ReviewBox! Your 14-day free trial has started. Here's what to do next:
              </p>

              <!-- Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="padding:12px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #6366f1;margin-bottom:8px;display:block;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <strong style="color:#6366f1;">1.</strong>&nbsp; Connect Google Play Console
                    </p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #6366f1;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <strong style="color:#6366f1;">2.</strong>&nbsp; Generate your first AI reply
                    </p>
                  </td>
                </tr>
                <tr><td style="height:8px;"></td></tr>
                <tr>
                  <td style="padding:12px 16px;background:#f8fafc;border-radius:8px;border-left:3px solid #6366f1;">
                    <p style="margin:0;font-size:14px;color:#0f172a;">
                      <strong style="color:#6366f1;">3.</strong>&nbsp; Set up email alerts
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#6366f1;">
                    <a
                      href="https://tryreviewbox.com/dashboard"
                      style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Go to your dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You're receiving this because you signed up for ReviewBox. If you didn't create an account,
                you can safely ignore this email. To unsubscribe from marketing emails, reply with
                "unsubscribe" in the subject line.
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

Welcome to ReviewBox! Your 14-day free trial has started.

Here's what to do next:
1. Connect Google Play Console
2. Generate your first AI reply
3. Set up email alerts

Go to your dashboard: https://tryreviewbox.com/dashboard

---
You're receiving this because you signed up for ReviewBox. To unsubscribe, reply with "unsubscribe" in the subject line.`;

  const r = getResend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: "Welcome to ReviewBox 🎉",
    html,
    text,
  });

  if (error) {
    console.error("[email] Failed to send welcome email:", error);
  }
}
