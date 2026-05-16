/**
 * Automation executor — evaluates rules against a review and runs matching actions.
 * Called from /api/sync/reviews after each batch upsert.
 * All actions are best-effort: failures are logged but don't block the sync.
 */

import type { AppReview, AutomationRule, AutomationCondition } from "@/types/review";
import { getServiceClient } from "@/lib/supabase-server";

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
      if (operator === "contains") return review.issueTags.includes(value as AppReview["issueTags"][number]);
      if (operator === "in")       return Array.isArray(value) && (value as string[]).some((v) => review.issueTags.includes(v as AppReview["issueTags"][number]));
      return false;

    case "keyword":
      if (operator === "contains")
        return typeof value === "string" && review.text.toLowerCase().includes(value.toLowerCase());
      return false;

    case "platform":
      if (operator === "equals")
        return (value === "google_play" ? "Google Play" : "App Store") === review.source;
      return false;

    case "country":
      if (operator === "equals") return review.country?.toLowerCase() === String(value).toLowerCase();
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

// ── Action executor ────────────────────────────────────────────────────────────

async function executeAction(
  rule: AutomationRule,
  review: AppReview,
  workspaceId: string,
): Promise<void> {
  const sb = getServiceClient();

  switch (rule.action) {
    case "ai_reply": {
      // Call the draft endpoint internally — generates and saves a draft
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const res = await fetch(`${appUrl}/api/reply/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Internal call header so rate limiter uses workspace quota
          "x-internal-workspace-id": workspaceId,
        },
        body: JSON.stringify({
          reviewId:   review.id,
          reviewBody: review.text,
          rating:     review.rating,
          tags:       review.issueTags,
          tone:       "professional",
        }),
      });

      if (res.ok) {
        const { reply } = (await res.json()) as { reply: string };
        await sb
          .from("reviews")
          .update({ reply_text: reply, reply_status: "draft_ready", has_ai_suggestion: true })
          .eq("id", review.id);
      }
      break;
    }

    case "template_reply": {
      // Find the best matching template from the DB
      const { data: templates } = await sb
        .from("reply_templates")
        .select("id, content, rating_min, rating_max, tags")
        .eq("workspace_id", workspaceId)
        .lte("rating_min", review.rating)
        .gte("rating_max", review.rating);

      const best = templates?.[0];
      if (best) {
        await sb
          .from("reviews")
          .update({ reply_text: best.content, reply_status: "draft_ready" })
          .eq("id", review.id);
      }
      break;
    }

    case "apply_tag": {
      // actionConfig is stored in DB but not on the type — we cast from the rule object
      const tagToAdd = (rule as unknown as { actionConfig: string }).actionConfig;
      const existing = review.issueTags ?? [];
      if (tagToAdd && !existing.includes(tagToAdd as AppReview["issueTags"][number])) {
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
      // Mark for spam review — set a special tag
      const existing = review.issueTags ?? [];
      await sb
        .from("reviews")
        .update({ issue_tags: [...existing, "spam"] })
        .eq("id", review.id);
      break;
    }
  }

  // Update rule run stats
  await sb
    .from("automation_rules")
    .update({ times_run: (rule.timesRun ?? 0) + 1, last_run_at: new Date().toISOString() })
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
    id:           r.id,
    name:         r.name,
    description:  r.description ?? "",
    enabled:      r.enabled,
    conditions:   r.conditions,
    action:       r.action,
    actionLabel:  r.action,
    actionConfig: r.action_config,
    appsScope:    r.apps_scope,
    priority:     r.priority,
    timesRun:     r.times_run,
    lastRunAt:    r.last_run_at,
    createdAt:    r.created_at,
  }));

  for (const review of reviews) {
    for (const rule of rules) {
      // Scope check: rule may target "all" or a specific app_id
      if (rule.appsScope !== "all") {
        const scopeIds = Array.isArray(rule.appsScope) ? rule.appsScope : [rule.appsScope];
        if (!scopeIds.some((s) => review.id.startsWith(s))) continue;
      }

      if (evaluateRule(rule, review)) {
        await executeAction(rule, review, workspaceId).catch((err) =>
          console.error(`[automation] rule ${rule.id} on review ${review.id}:`, err),
        );
        break; // first-match only — rules are ordered by priority
      }
    }
  }
}
