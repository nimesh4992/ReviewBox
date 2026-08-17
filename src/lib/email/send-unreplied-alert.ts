import { getResend, FROM } from "./client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

/** One app's slice of the alert. */
export interface UnrepliedAppSummary {
  appName: string;
  count: number;
  urgentCount: number;
}

/**
 * One email per workspace, broken down per app.
 *
 * This used to take a single (appName, count) pair, which forced a choice
 * between two wrong answers on a multi-app workspace: label the workspace-wide
 * total with one arbitrary app's name, or send one email per app and put five
 * messages a day in the owner's inbox. Neither is acceptable, so the email
 * itself now carries the breakdown.
 */
export async function sendUnrepliedAlert(
  to: string,
  apps: UnrepliedAppSummary[],
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  const r = getResend();
  if (!r) return;
  if (!apps.length) return;

  const count       = apps.reduce((sum, a) => sum + a.count, 0);
  const urgentCount = apps.reduce((sum, a) => sum + a.urgentCount, 0);
  if (count === 0) return;

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // One app reads as a sentence; several read as a list. Never a total with
  // one app's name on it.
  const bodyCopy = apps.length === 1
    ? `<strong>${escape(apps[0].appName)}</strong> has ${count} review${count === 1 ? "" : "s"} that
       ${count === 1 ? "has" : "have"} been waiting for a reply for more than 48 hours.
       Responding promptly improves your store rating and shows users you care.`
    : `${count} reviews across <strong>${apps.length} apps</strong> have been waiting for a reply
       for more than 48 hours. Responding promptly improves your store rating and shows users you care.`;

  const perAppList = apps.length === 1
    ? ""
    : `<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;width:100%;">
        ${apps
          .map(
            (a) => `<tr>
              <td style="padding:6px 0;font-size:14px;color:#0f172a;">${escape(a.appName)}</td>
              <td style="padding:6px 0;font-size:14px;color:#475569;text-align:right;">
                ${a.count} waiting${a.urgentCount > 0 ? ` · <span style="color:#dc2626;font-weight:600;">${a.urgentCount} urgent</span>` : ""}
              </td>
            </tr>`,
          )
          .join("")}
      </table>`;

  const urgentLine = urgentCount > 0 && apps.length === 1
    ? `<p style="margin:0 0 16px;font-size:14px;font-weight:600;color:#dc2626;">
        🔴 ${urgentCount} of these are marked urgent
      </p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Reviews waiting for reply</title>
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
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">
                ${count} review${count === 1 ? "" : "s"} still waiting
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.6;">
                ${bodyCopy}
              </p>
              ${perAppList}
              ${urgentLine}
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#0A84FF;">
                    <a href="${APP_URL}/reviews?filter=needs_reply"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reply now →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                Manage notification preferences at
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

  // Subject names the app only when there IS one app — otherwise it says how
  // many, rather than picking one and implying the total is its own.
  const scopeLabel = apps.length === 1 ? apps[0].appName : `${apps.length} apps`;

  const text = [
    `${count} review${count === 1 ? "" : "s"} waiting for reply — ${scopeLabel}`,
    ``,
    ...(apps.length === 1
      ? []
      : apps.map((a) => `· ${a.appName}: ${a.count} waiting${a.urgentCount > 0 ? ` (${a.urgentCount} urgent)` : ""}`)),
    urgentCount > 0 ? `🔴 ${urgentCount} urgent` : null,
    `Reply now: ${APP_URL}/reviews?filter=needs_reply`,
  ].filter(Boolean).join("\n");

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `⏰ ${count} review${count === 1 ? "" : "s"} waiting 48h+ — ${scopeLabel}`,
    html,
    text,
  });

  if (error) console.error("[email] unreplied alert:", error);
}
