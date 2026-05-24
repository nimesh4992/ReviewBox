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
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">ReviewBox</p>
            </td>
          </tr>
          ${content}
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                You're receiving this because you have an app connected to ReviewBox.
                Manage notifications at <a href="${APP_URL}/settings" style="color:#0A84FF;">tryreviewbox.com/settings</a>.
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

function cta(label: string, href: string, color = "#0A84FF"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:20px;">
    <tr>
      <td style="border-radius:8px;background:${color};">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ── Signal 1: Sync never ran (48h after app added) ────────────────────────────

export async function sendNeverSyncedNudge(
  to: string,
  appName: string,
  platform: "google_play" | "app_store",
): Promise<void> {
  const r = getResend();
  if (!r) return;

  const isPlay = platform === "google_play";
  const fixUrl = isPlay
    ? "https://play.google.com/console"
    : `${APP_URL}/settings`;
  const guideUrl = isPlay
    ? `${APP_URL}/help/connect-google-play`
    : `${APP_URL}/help/connect-app-store`;

  const body = isPlay
    ? `ReviewBox can read your Google Play reviews once you invite our service account to your Play Console. It takes about 2 minutes.`
    : `ReviewBox needs your App Store Connect API credentials (.p8 key, Key ID, Issuer ID) to sync reviews. Paste them in Settings → Apps.`;

  const html = shell(
    `<tr>
      <td style="background:#fff7ed;border-bottom:1px solid #fed7aa;padding:12px 32px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#c2410c;">Reviews aren't syncing yet</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">
          ${appName} hasn't synced
        </h1>
        <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
          You connected <strong>${appName}</strong> 2 days ago but no reviews have appeared yet.
        </p>
        <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">${body}</p>
        <table cellpadding="0" cellspacing="0" style="margin-top:20px;border-spacing:12px 0;">
          <tr>
            <td style="border-radius:8px;background:#0A84FF;">
              <a href="${fixUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                ${isPlay ? "Open Play Console" : "Add credentials"}
              </a>
            </td>
            <td style="padding-left:12px;">
              <a href="${guideUrl}" style="font-size:14px;color:#0A84FF;text-decoration:none;">
                Step-by-step guide →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`,
    `${appName} hasn't synced yet — here's how to fix it`,
  );

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `${appName} hasn't synced yet — 2-minute fix`,
    html,
    text: `${appName} hasn't synced yet.\n\n${body}\n\n${isPlay ? "Open Play Console: " + fixUrl : "Add credentials: " + fixUrl}\nSetup guide: ${guideUrl}`,
  });

  if (error) console.error("[email] never-synced nudge:", error);
}

// ── Signal 2: Sync failing 2+ days ───────────────────────────────────────────

export async function sendSyncFailingNudge(
  to: string,
  appName: string,
  platform: "google_play" | "app_store",
  syncStatus: string,
): Promise<void> {
  const r = getResend();
  if (!r) return;

  const settingsUrl = `${APP_URL}/settings`;

  const statusMessages: Record<string, { headline: string; body: string }> = {
    needs_play_console_access: {
      headline: "Play Console access missing",
      body: "ReviewBox doesn't have permission to read your reviews. Invite our service account to your Play Console with <strong>Reply to reviews</strong> permission.",
    },
    google_credentials_invalid: {
      headline: "Google credentials are invalid",
      body: "Our service account credentials aren't working. This is on our side — reply to this email and we'll sort it out within a few hours.",
    },
    needs_app_store_credentials: {
      headline: "App Store credentials missing",
      body: "Your .p8 key, Key ID, or Issuer ID haven't been saved yet. Go to Settings → Apps and paste all three.",
    },
    app_store_unauthorized: {
      headline: "App Store API key rejected",
      body: "Apple is rejecting your API key. Regenerate it in App Store Connect → Users & Access → Integrations → Keys and re-paste it in Settings.",
    },
    bundle_id_not_found: {
      headline: "Bundle ID not found",
      body: "App Store Connect can't find your app under this API key. Check that the bundle ID in Settings matches exactly what's in App Store Connect.",
    },
    package_not_found: {
      headline: "Package name not found",
      body: "Google Play can't find your app's package name. Double-check it in Settings → Apps.",
    },
  };

  const msg = statusMessages[syncStatus] ?? {
    headline: "Sync is failing",
    body: "ReviewBox is having trouble syncing your reviews. Go to Settings to check the error details, or reply to this email for help.",
  };

  const html = shell(
    `<tr>
      <td style="background:#fef2f2;border-bottom:1px solid #fecaca;padding:12px 32px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#b91c1c;">Sync has been failing for 2+ days</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">${msg.headline}</h1>
        <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
          <strong>${appName}</strong> hasn't synced successfully in the last 2 days.
        </p>
        <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">${msg.body}</p>
        ${cta("Fix in Settings", settingsUrl, "#dc2626")}
      </td>
    </tr>`,
    `Action needed: ${appName} sync is failing`,
  );

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `Action needed: ${appName} hasn't synced in 2 days`,
    html,
    text: `${appName} sync has been failing for 2+ days.\n\n${msg.headline}: ${msg.body.replace(/<[^>]+>/g, "")}\n\nFix in Settings: ${settingsUrl}`,
  });

  if (error) console.error("[email] sync-failing nudge:", error);
}

// ── Signal 3: Review spike unreplied 6h+ ─────────────────────────────────────

export async function sendSpikeUnrepliedNudge(
  to: string,
  appName: string,
  count: number,
): Promise<void> {
  const r = getResend();
  if (!r) return;

  const reviewsUrl = `${APP_URL}/reviews`;

  const html = shell(
    `<tr>
      <td style="background:#fef2f2;border-bottom:1px solid #fecaca;padding:12px 32px;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#b91c1c;">${count} negative reviews need a response</p>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">
          ${count} negative reviews are waiting
        </h1>
        <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
          <strong>${appName}</strong> has received ${count} reviews rated 1–2 stars in the last 24 hours that haven't been replied to.
        </p>
        <p style="margin:0;font-size:15px;color:#475569;line-height:1.6;">
          Responding within 24 hours improves your store rating and shows users you care.
          ReviewBox can draft replies for you in one click.
        </p>
        ${cta("Reply now", reviewsUrl, "#dc2626")}
      </td>
    </tr>`,
    `${count} negative reviews need a response — ${appName}`,
  );

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: `${count} negative reviews need a response — ${appName}`,
    html,
    text: `${appName} has ${count} negative reviews (1–2 stars) from the last 24 hours that haven't been replied to.\n\nReply now: ${reviewsUrl}`,
  });

  if (error) console.error("[email] spike-unreplied nudge:", error);
}
