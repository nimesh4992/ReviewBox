/**
 * slack.ts
 *
 * Sends notifications to a workspace's Slack channel via Incoming Webhooks.
 * Zero dependencies beyond native fetch — no Slack SDK needed.
 *
 * Usage:
 *   await sendSlackNotification(webhookUrl, { text: "Hello" });
 *   await notifySlack(workspaceId, { text: "Hello" });   // looks up URL from DB
 */

import { getServiceClient } from "@/lib/supabase-server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  accessory?: Record<string, unknown>;
}

export interface SlackPayload {
  text: string;          // fallback + notification text
  blocks?: SlackBlock[]; // rich layout (optional)
}

// ── Core sender ───────────────────────────────────────────────────────────────

/**
 * POST a message to a Slack Incoming Webhook URL.
 * Returns true on success, false on failure (never throws).
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: SlackPayload,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[slack] sendSlackNotification failed:", err);
    return false;
  }
}

// ── Workspace-aware helper ────────────────────────────────────────────────────

/**
 * Look up the workspace's Slack webhook URL from Supabase and send.
 * No-ops silently if the workspace has no Slack connected.
 * Returns true if sent, false if not connected or failed.
 */
export async function notifySlack(
  workspaceId: string,
  payload: SlackPayload,
): Promise<boolean> {
  try {
    const sb = getServiceClient();
    const { data } = await sb
      .from("workspaces")
      .select("slack_webhook_url")
      .eq("id", workspaceId)
      .single();

    const url = (data as { slack_webhook_url?: string | null } | null)?.slack_webhook_url;
    if (!url) return false;

    return sendSlackNotification(url, payload);
  } catch (err) {
    console.error("[slack] notifySlack failed:", err);
    return false;
  }
}

// ── Pre-built notification payloads ──────────────────────────────────────────

export function ratingSpike(params: {
  appName: string;
  avgRating: number;
  reviewCount: number;
  appVersion: string;
}): SlackPayload {
  const { appName, avgRating, reviewCount, appVersion } = params;
  return {
    text: `⚠️ Rating spike detected for ${appName}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `⚠️ *Rating spike detected*\n*${appName}* v${appVersion} received ${reviewCount} reviews averaging *${avgRating}★* in the last 24h.`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Avg Rating*\n${avgRating}★` },
          { type: "mrkdwn", text: `*Reviews*\n${reviewCount} in 24h` },
          { type: "mrkdwn", text: `*Version*\nv${appVersion}` },
        ],
      },
    ],
  };
}

export function newIncident(params: {
  title: string;
  severity: string;
  appName: string;
  appUrl: string;
}): SlackPayload {
  const { title, severity, appName, appUrl } = params;
  const emoji = severity === "critical" ? "🚨" : severity === "high" ? "🔴" : "🟡";
  return {
    text: `${emoji} New incident: ${title}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${emoji} *New incident detected*\n*${title}*\nApp: ${appName} · Severity: ${severity}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${appUrl}|View incident in ReviewBox →>`,
        },
      },
    ],
  };
}

export function urgentReview(params: {
  author: string;
  rating: number;
  text: string;
  appName: string;
  reviewUrl: string;
}): SlackPayload {
  const { author, rating, text, appName, reviewUrl } = params;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  const snippet = text.length > 120 ? text.slice(0, 120) + "…" : text;
  return {
    text: `🔴 Urgent review on ${appName}: ${stars}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔴 *Urgent review* — ${appName}\n${stars} · ${author}\n_"${snippet}"_`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${reviewUrl}|Reply in ReviewBox →>`,
        },
      },
    ],
  };
}
