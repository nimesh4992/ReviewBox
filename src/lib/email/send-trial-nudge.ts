/**
 * Trial lifecycle nudge emails.
 *
 * Day-5:  engagement nudge — shows real unreplied count, drives them back to inbox
 * Day-12: conversion push — 2 days left, upgrade CTA (delegates to sendTrialExpiringEmail)
 */

import { getResend, FROM } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function shell(content: string, preview: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${preview}</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:#1e293b;padding:24px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                R&nbsp;<span style="color:#0A84FF;">|</span>&nbsp;ReviewBox
              </p>
            </td>
          </tr>
          ${content}
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
                You're receiving this as part of your ReviewBox trial. Manage notifications at
                <a href="${APP_URL}/settings" style="color:#0A84FF;">Settings</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Day-5 engagement email.
 * Shows real unreplied review count and nudges back into the inbox.
 */
export async function sendTrialDay5Nudge(params: {
  to: string;
  name: string;
  unrepliedCount: number;
  totalReviews: number;
  workspaceName: string;
}): Promise<void> {
  const r = getResend();
  if (!r) return;

  const { to, name, unrepliedCount, totalReviews, workspaceName } = params;

  const hasReviews = totalReviews > 0;
  const hasUnreplied = unrepliedCount > 0;

  const headline = hasUnreplied
    ? `${unrepliedCount} review${unrepliedCount !== 1 ? "s" : ""} waiting for a reply`
    : hasReviews
    ? `${totalReviews} review${totalReviews !== 1 ? "s" : ""} synced — you're off to a great start`
    : "Your ReviewBox trial is rolling — here's what's next";

  const bodyText = hasUnreplied
    ? `ReviewBox has found <strong>${unrepliedCount} review${unrepliedCount !== 1 ? "s" : ""}</strong> in <strong>${workspaceName}</strong> that haven't been replied to yet. Each reply improves your store rating and shows users you care. ReviewBox can generate a draft reply in one click.`
    : hasReviews
    ? `ReviewBox has synced <strong>${totalReviews} review${totalReviews !== 1 ? "s" : ""}</strong> from <strong>${workspaceName}</strong>. You're all caught up — keep it that way by setting up an automation rule to auto-draft replies.`
    : `Connect your app in Settings to start syncing reviews. Once connected, ReviewBox will automatically triage and draft replies for every review.`;

  const ctaLabel = hasUnreplied ? "Reply now" : hasReviews ? "View reviews" : "Connect my app";
  const ctaUrl = hasUnreplied
    ? `${APP_URL}/inbox`
    : hasReviews
    ? `${APP_URL}/inbox`
    : `${APP_URL}/settings`;

  const trialDaysRow = `
    <tr>
      <td style="background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:10px 32px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#1d4ed8;">9 days left in your free trial</p>
      </td>
    </tr>`;

  const statsRow = hasReviews
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:12px 16px;text-align:center;border-right:1px solid #e2e8f0;">
            <p style="margin:0;font-size:24px;font-weight:700;color:#0f172a;">${totalReviews}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Total reviews</p>
          </td>
          <td style="padding:12px 16px;text-align:center;">
            <p style="margin:0;font-size:24px;font-weight:700;color:${unrepliedCount > 0 ? "#0A84FF" : "#16a34a"};">${unrepliedCount}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Needs reply</p>
          </td>
        </tr>
      </table>`
    : "";

  const html = shell(
    `${trialDaysRow}
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">
          Hi ${name} — ${headline}
        </h1>
        <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
          ${bodyText}
        </p>
        ${statsRow}
        <table cellpadding="0" cellspacing="0" style="margin-top:20px;">
          <tr>
            <td style="border-radius:8px;background:#0A84FF;">
              <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                ${ctaLabel}
              </a>
            </td>
            <td style="padding-left:16px;">
              <a href="${APP_URL}/automations" style="font-size:14px;color:#0A84FF;text-decoration:none;">
                Set up automations →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
    headline,
  );

  const text = `Hi ${name},

${headline}

${bodyText.replace(/<[^>]+>/g, "")}

${ctaLabel}: ${ctaUrl}
Set up automations: ${APP_URL}/automations

---
9 days left in your free trial. Upgrade at ${APP_URL}/billing.`;

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `Day 5: ${headline}`,
    html,
    text,
  });

  if (error) console.error("[email] trial-day5 nudge:", error);
}
