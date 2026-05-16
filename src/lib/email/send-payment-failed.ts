import { getResend, FROM } from "./client";

export async function sendPaymentFailedEmail(
  to: string,
  name: string,
  retryDate: string
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping payment-failed email");
    return;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment failed</title>
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

          <!-- Alert bar -->
          <tr>
            <td style="background:#fef2f2;border-bottom:1px solid #fecaca;padding:12px 32px;">
              <p style="margin:0;font-size:13px;font-weight:600;color:#b91c1c;">
                Action required: payment issue on your account
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
                Hi ${name},
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
                We weren't able to charge the card on file for your ReviewBox subscription.
                Don't worry — your account remains fully active for the next <strong>7 days</strong>,
                giving you time to update your payment details.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                We'll automatically retry the payment on <strong>${retryDate}</strong>.
                If the charge fails again, your account will be paused.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-radius:8px;background:#dc2626;">
                    <a
                      href="https://tryreviewbox.com/billing"
                      style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Update payment method
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                If you have questions or think this is a mistake, reply to this email and we'll
                sort it out right away.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                This is a transactional email regarding your ReviewBox subscription. You cannot
                unsubscribe from billing notifications.
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

We weren't able to charge the card on file for your ReviewBox subscription.

Your account remains active for 7 days. We'll retry on ${retryDate}.

Please update your payment method to avoid losing access:
https://tryreviewbox.com/billing

If you have questions, reply to this email.

---
This is a transactional email regarding your ReviewBox subscription.`;

  const r = getResend();
  if (!r) return;
  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: "Action required: Payment failed for your ReviewBox subscription",
    html,
    text,
  });

  if (error) {
    console.error("[email] Failed to send payment-failed email:", error);
  }
}
