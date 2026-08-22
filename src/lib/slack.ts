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
import { Redis } from "@upstash/redis";

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

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

// ── Dedup-guarded notification helpers ───────────────────────────────────────
// Prevents flooding the same channel with repeated alerts for the same event.

/**
 * Notify Slack with a dedup guard.
 * `dedupKey` — a unique key for this event (e.g. "spike:{workspaceId}:{appId}:{version}")
 * `ttlSeconds` — how long to suppress the same key (e.g. 23*3600 for rating spikes)
 * Returns: "sent" | "deduped" | "not_connected" | "failed"
 */
export async function dedupAndNotifySlack(
  workspaceId: string,
  dedupKey:    string,
  ttlSeconds:  number,
  payload:     SlackPayload,
): Promise<"sent" | "deduped" | "not_connected" | "failed"> {
  const redis = getRedis();
  if (redis) {
    const existing = await redis.get(dedupKey);
    if (existing) return "deduped";
  }

  const sent = await notifySlack(workspaceId, payload);
  if (!sent) return "not_connected";

  if (redis) {
    await redis.set(dedupKey, "1", { ex: ttlSeconds });
  }
  return "sent";
}

/** Notify about a rating spike — deduped per workspace+app+version for 23h. */
export async function notifyRatingSpike(
  workspaceId: string,
  appId:       string,
  params:      Parameters<typeof ratingSpike>[0],
): Promise<void> {
  const key = `slack:spike:${workspaceId}:${appId}:${params.appVersion}`;
  await dedupAndNotifySlack(workspaceId, key, 23 * 3600, ratingSpike(params));
}

/** Notify about an urgent review — deduped per workspace+review for 48h. */
export async function notifyUrgentReview(
  workspaceId: string,
  reviewId:    string,
  params:      Parameters<typeof urgentReview>[0],
): Promise<void> {
  const key = `slack:urgent:${workspaceId}:${reviewId}`;
  await dedupAndNotifySlack(workspaceId, key, 48 * 3600, urgentReview(params));
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

/**
 * Urgent-review alert — **metadata only, by design**.
 *
 * This payload deliberately carries no reviewer name and no review text. An
 * Incoming Webhook posts into a Slack channel, which is a third party we do
 * not control the retention of, and `/dpa` classifies review content and
 * author handles as personal data. Everything a responder needs in order to
 * decide *whether to open ReviewBox* is metadata; everything that identifies
 * or quotes the reviewer lives behind the link.
 *
 * The signature enforces it: `author` and `text` are not parameters, so a
 * future caller cannot reintroduce them without editing this contract on
 * purpose. `src/slack-privacy-contract.test.ts` fails the build if they
 * reappear in any payload builder.
 */
export function urgentReview(params: {
  rating: number;
  appName: string;
  reviewUrl: string;
  issueTags?: readonly string[] | null;
  appVersion?: string | null;
  createdAt?: string | null;
}): SlackPayload {
  const { rating, appName, reviewUrl, issueTags, appVersion, createdAt } = params;
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  // Tags are our own fixed classification vocabulary (crash, billing, login,
  // …), not text lifted from the review, so they carry no reviewer content.
  const tags = (issueTags ?? []).filter((t) => typeof t === "string" && t.length > 0);

  const facts = [
    `*Rating*\n${stars}`,
    tags.length ? `*Tagged*\n${tags.join(", ")}` : null,
    appVersion ? `*Version*\nv${appVersion}` : null,
    createdAt ? `*Posted*\n${formatUtcDay(createdAt)}` : null,
  ].filter((f): f is string => f !== null);

  return {
    text: `🔴 Urgent review on ${appName}: ${stars}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔴 *Urgent review* — ${appName}\n${stars}${tags.length ? ` · ${tags.join(", ")}` : ""}`,
        },
      },
      {
        type: "section",
        fields: facts.map((text) => ({ type: "mrkdwn", text })),
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${reviewUrl}|Read it and reply in ReviewBox →>`,
        },
      },
    ],
  };
}

/**
 * `2026-08-22` from an ISO timestamp. Day precision, UTC, no time-of-day —
 * enough to tell a fresh alert from a replayed one without narrowing the
 * posting window enough to help identify who wrote it.
 */
function formatUtcDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
