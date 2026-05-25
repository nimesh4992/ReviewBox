/**
 * Automation executor — evaluates rules against a review and runs matching actions.
 * Called from /api/sync/reviews after each batch upsert.
 * All actions are best-effort: failures are logged but don't block the sync.
 */

import type { AppReview, AutomationRule, AutomationCondition } from "@/types/review";
import { getServiceClient } from "@/lib/supabase-server";
import { generateReply } from "@/lib/groq";
import { submitReply as submitGooglePlayReply } from "@/services/google-play/publisher-api";
import { buildJWT, submitReply as submitAppStoreReply } from "@/services/app-store/connect-api";

// ── Condition evaluator ────────────────────────────────────────────────────────

function evaluateCondition(condition: AutomationCondition, review: AppReview): boolean {
  const { field, operator, value } = condition;

  switch (field) {
    case "rating": {
      const r = review.rating;
      const v = Number(value);
      if (operator === "equals")       return r === v;
      if (operator === "less_than")    return r < v;
      if (operator === "greater_than") return r > v;
      if (operator === "in")           return Array.isArray(value) && (value as string[]).map(Number).includes(r);
      return false;
    }

    case "sentiment":
      if (operator === "equals") return review.sentiment === value;
      if (operator === "in")     return Array.isArray(value) && (value as string[]).includes(review.sentiment);
      return false;

    case "tag":
      // "equals" is the primary operator emitted by the rule builder UI
      if (operator === "equals")   return review.issueTags.includes(value as AppReview["issueTags"][number]);
      if (operator === "contains") return review.issueTags.includes(value as AppReview["issueTags"][number]);
      if (operator === "in")       return Array.isArray(value) && (value as string[]).some((v) => review.issueTags.includes(v as AppReview["issueTags"][number]));
      return false;

    case "keyword":
      if (operator === "contains")
        return typeof value === "string" && (review.text ?? "").toLowerCase().includes(value.toLowerCase());
      return false;

    case "platform":
      if (operator === "equals")
        return (value === "google_play" ? "Google Play" : "App Store") === review.source;
      return false;

    case "country":
      if (operator === "equals") return (review.country ?? "").toLowerCase() === String(value).toLowerCase();
      return false;

    case "version":
      if (operator === "equals")   return review.appVersion === value;
      if (operator === "contains") return typeof value === "string" && review.appVersion.includes(value);
      return false;

    default:
      return false;
  }
}

export function evaluateRule(rule: AutomationRule, review: AppReview): boolean {
  if (!rule.enabled || !rule.conditions.length) return false;
  return rule.conditions.every((c) => evaluateCondition(c, review));
}

// ── Execution log helper ──────────────────────────────────────────────────────

async function writeLog(
  workspaceId: string,
  rule: AutomationRule,
  review: AppReview,
  status: "success" | "error",
  errorMessage?: string,
): Promise<void> {
  const sb = getServiceClient();
  await sb.from("automation_execution_logs").insert({
    workspace_id:   workspaceId,
    rule_id:        rule.id,
    rule_name:      rule.name,
    review_id:      review.id,
    review_rating:  review.rating,
    review_snippet: (review.text ?? "").slice(0, 120) || null,
    action:         rule.action,
    status,
    error_message:  errorMessage ?? null,
    executed_at:    new Date().toISOString(),
  });
}

// ── Action executor ────────────────────────────────────────────────────────────

async function executeAction(
  rule: AutomationRule,
  review: AppReview,
  workspaceId: string,
): Promise<void> {
  const sb = getServiceClient();

  switch (rule.action) {
    case "ai_reply": {
      // Call generateReply() directly — HTTP call to /api/reply/draft always 401
      // because automation executor runs server-side with no Clerk session.
      const reply = await generateReply({
        reviewBody: review.text ?? "",
        rating:     review.rating,
        tone:       "professional",
      });
      await sb
        .from("reviews")
        .update({ reply_text: reply, reply_status: "draft_ready", has_ai_suggestion: true })
        .eq("id", review.id);
      break;
    }

    case "auto_reply": {
      // 1) Generate reply
      const replyText = await generateReply({
        reviewBody: review.text ?? "",
        rating:     review.rating,
        tone:       "professional",
      });

      // 2) Look up store credentials via the review's app
      const { data: reviewRow } = await sb
        .from("reviews")
        .select("external_id, apps(store_id, platform, access_token, refresh_token)")
        .eq("id", review.id)
        .single();

      if (!reviewRow) throw new Error("auto_reply: review not found");

      type AppInfo = { store_id: string; platform: string; access_token: string | null; refresh_token: string | null };
      const app = (Array.isArray(reviewRow.apps) ? reviewRow.apps[0] : reviewRow.apps) as AppInfo | null;

      // 3) Submit to store
      if (app?.platform === "google_play") {
        await submitGooglePlayReply(app.store_id, reviewRow.external_id as string, replyText);
      } else if (app?.platform === "app_store") {
        if (!app.access_token || !app.refresh_token) {
          throw new Error("auto_reply: App Store credentials not configured");
        }
        const creds = JSON.parse(app.access_token) as { keyId: string; issuerId: string };
        const jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token);
        await submitAppStoreReply(reviewRow.external_id as string, replyText, jwt);
      } else {
        throw new Error("auto_reply: unsupported platform or missing app");
      }

      // 4) Mark as replied in DB
      await sb
        .from("reviews")
        .update({
          reply_text:   replyText,
          reply_status: "replied",
          replied_at:   new Date().toISOString(),
          draft_source: "automation",
        })
        .eq("id", review.id);
      break;
    }

    case "template_reply": {
      let query = sb
        .from("reply_templates")
        .select("id, content, rating_min, rating_max, tags")
        .eq("workspace_id", workspaceId);

      // If a specific template was configured, use it; otherwise auto-match by rating
      if (rule.actionConfig) {
        query = query.eq("id", rule.actionConfig) as typeof query;
      } else {
        query = query
          .lte("rating_min", review.rating)
          .gte("rating_max", review.rating) as typeof query;
      }

      const { data: templates } = await query.limit(1);
      const best = templates?.[0];
      if (best) {
        await sb
          .from("reviews")
          .update({ reply_text: best.content, reply_status: "draft_ready" })
          .eq("id", review.id);
      } else {
        throw new Error("template_reply: no matching template found");
      }
      break;
    }

    case "apply_tag": {
      const tagToAdd = rule.actionConfig;
      if (!tagToAdd) throw new Error("apply_tag: no actionConfig (tag name) set on rule");
      const existing = review.issueTags ?? [];
      if (!existing.includes(tagToAdd as AppReview["issueTags"][number])) {
        await sb
          .from("reviews")
          .update({ issue_tags: [...existing, tagToAdd] })
          .eq("id", review.id);
      }
      break;
    }

    case "escalate": {
      await sb
        .from("reviews")
        .update({ escalation_state: "engineering", priority: "urgent" })
        .eq("id", review.id);
      break;
    }

    case "report_spam": {
      // Flag for manual review — add tag + escalate to support queue
      const existing = review.issueTags ?? [];
      const updatePayload: Record<string, unknown> = {
        escalation_state: "support",
      };
      if (!existing.includes("support-delay" as AppReview["issueTags"][number])) {
        updatePayload.issue_tags = [...existing, "support-delay"];
      }
      await sb
        .from("reviews")
        .update(updatePayload)
        .eq("id", review.id);
      break;
    }
  }

  // Update rule run stats (increment times_run, stamp last_run_at)
  await sb
    .from("automation_rules")
    .update({
      times_run:   (rule.timesRun ?? 0) + 1,
      last_run_at: new Date().toISOString(),
    })
    .eq("id", rule.id);
}

// ── Public: run all rules against a batch of new reviews ──────────────────────

export async function runAutomationRules(
  workspaceId: string,
  reviews: AppReview[],
): Promise<void> {
  if (!reviews.length) return;

  const sb = getServiceClient();
  const { data: rulesData } = await sb
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  if (!rulesData?.length) return;

  // Map DB snake_case → AutomationRule camelCase
  const rules: AutomationRule[] = rulesData.map((r) => ({
    id:           r.id          as string,
    name:         r.name        as string,
    description:  (r.description ?? "") as string,
    enabled:      r.enabled     as boolean,
    conditions:   r.conditions  as AutomationRule["conditions"],
    action:       r.action      as AutomationRule["action"],
    actionLabel:  r.action_label as string,
    actionConfig: (r.action_config ?? undefined) as string | undefined,
    appsScope:    r.apps_scope  as AutomationRule["appsScope"],
    priority:     r.priority    as number,
    timesRun:     r.times_run   as number,
    lastRunAt:    r.last_run_at as string | null,
    createdAt:    r.created_at  as string,
  }));

  for (const review of reviews) {
    for (const rule of rules) {
      // Scope check: rule may target "all" or specific app IDs
      if (rule.appsScope !== "all") {
        const scopeIds = Array.isArray(rule.appsScope) ? rule.appsScope : [rule.appsScope];
        if (!scopeIds.some((s) => review.id.startsWith(s as string))) continue;
      }

      if (evaluateRule(rule, review)) {
        try {
          await executeAction(rule, review, workspaceId);
          await writeLog(workspaceId, rule, review, "success").catch(() => undefined);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[automation] rule ${rule.id} on review ${review.id}:`, msg);
          await writeLog(workspaceId, rule, review, "error", msg).catch(() => undefined);
        }
        break; // first-match wins — rules ordered by priority
      }
    }
  }
}
