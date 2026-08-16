"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Workflow,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import type { AutomationExecutionLog, AutomationPreset, AutomationRule } from "@/types/review";
import { featuredPresets, automationPresets } from "@/features/automations/data/mock-automations";
import { RuleBuilderModal } from "./rule-builder-modal";

// ── Preset → default rule mapping ─────────────────────────────────────────────

const PRESET_TO_RULE: Record<string, Partial<AutomationRule>> = {
  "preset-featured-1": {
    name: "Auto-reply to all new reviews",
    description: "Reply to all new reviews with AI",
    conditions: [{ field: "rating", operator: "greater_than", value: "0" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-featured-2": {
    name: "Reply to positive reviews",
    description: "Reply to all positive reviews with AI",
    conditions: [{ field: "rating", operator: "greater_than", value: "3" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-featured-3": {
    name: "Reply to negative reviews",
    description: "Reply to all negative reviews with AI",
    conditions: [{ field: "rating", operator: "less_than", value: "3" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-featured-4": {
    name: "Tag feature requests",
    description: "Assign tag 'feature-request'",
    conditions: [{ field: "tag", operator: "equals", value: "feature-request" }],
    action: "apply_tag", actionLabel: "Apply tag", actionConfig: "feature-request",
  },
  "preset-featured-5": {
    name: "Tag crash reports",
    description: "Assign tag 'crash'",
    conditions: [{ field: "tag", operator: "equals", value: "crash" }],
    action: "apply_tag", actionLabel: "Apply tag", actionConfig: "crash",
  },
  "preset-featured-6": {
    name: "Flag suspected spam",
    description: "Mark critical reviews for manual spam review",
    conditions: [{ field: "sentiment", operator: "equals", value: "critical" }],
    action: "report_spam", actionLabel: "Flag for review",
  },
  "preset-auto-1": {
    name: "Reply to feature requests",
    conditions: [{ field: "tag", operator: "equals", value: "feature-request" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-auto-2": {
    name: "Auto-tag crash reports",
    conditions: [{ field: "tag", operator: "equals", value: "crash" }],
    action: "apply_tag", actionLabel: "Apply tag", actionConfig: "crash",
  },
  "preset-auto-3": {
    name: "Handle billing issues",
    conditions: [{ field: "tag", operator: "equals", value: "billing" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-auto-4": {
    name: "Tag 5-star reviews",
    conditions: [{ field: "rating", operator: "equals", value: "5" }],
    action: "apply_tag", actionLabel: "Apply tag", actionConfig: "feature-request",
  },
  "preset-auto-5": {
    name: "Respond to login problems",
    conditions: [{ field: "tag", operator: "equals", value: "login" }],
    action: "ai_reply", actionLabel: "AI reply",
  },
  "preset-auto-6": {
    name: "Tag performance issues",
    conditions: [{ field: "tag", operator: "equals", value: "performance" }],
    action: "apply_tag", actionLabel: "Apply tag", actionConfig: "performance",
  },
};

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-checked={enabled}
      role="switch"
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-blue-500)] focus-visible:ring-offset-2",
        enabled ? "bg-[var(--rb-blue-500)]" : "bg-[var(--rb-bg-hover)]",
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 transform rounded-full bg-surface shadow-sm transition-transform duration-200",
        enabled ? "translate-x-4" : "translate-x-1",
      )} />
    </button>
  );
}

function MetaColumn({ value, label }: { value: string; label: string }) {
  // Fixed width + tabular numerals so the four columns line up across rows —
  // with min-w they drifted per row and read as scattered text, not a table.
  return (
    <div className="flex w-24 flex-col items-start">
      <span className="w-full truncate text-rb-sm font-medium tabular-nums text-fg-2">{value}</span>
      <span className="mt-0.5 text-rb-xs text-fg-3">{label}</span>
    </div>
  );
}

// ── RuleRow ───────────────────────────────────────────────────────────────────

interface RuleRowProps {
  rule: AutomationRule;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onEdit: (rule: AutomationRule) => void;
  onDelete: (id: string) => Promise<void>;
}

function RuleRow({ rule, onToggle, onEdit, onDelete }: RuleRowProps) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await onToggle(rule.id, next);
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    setDeleting(true);
    try { await onDelete(rule.id); } finally { setDeleting(false); }
  }

  return (
    <div className="flex items-center gap-4 bg-surface px-4 py-3 hover:bg-[var(--rb-bg-hover)]">
      <Toggle enabled={enabled} onToggle={handleToggle} />

      <div className="flex-1 min-w-0">
        {/* The "[Recommended]" bracket prefix is gone on purpose: once a rule
            is added it is the user's rule, and a vendor label shouting inside
            its name added nothing. Presets keep a quiet Suggested pill. */}
        <p className={cn("truncate text-rb-md font-medium text-fg-1", saving && "opacity-60")}>
          {rule.name}
        </p>
        <p className="mt-0.5 truncate text-rb-sm text-fg-3">{rule.description}</p>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <MetaColumn
          value={Array.isArray(rule.appsScope) ? rule.appsScope.join(", ") : "All apps"}
          label="Apps"
        />
        <MetaColumn value={rule.actionLabel} label="Action" />
        <MetaColumn value={String(rule.timesRun)} label="Times run" />
        <MetaColumn value={rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleDateString() : "—"} label="Last run" />
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(rule)}
          className="rounded-lg p-1.5 text-[var(--rb-fg-4)] hover:text-[var(--rb-blue-500)] hover:bg-[var(--rb-bg-accent-soft)] transition-colors"
          aria-label="Edit rule"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-[var(--rb-fg-4)] hover:text-red-500 hover:bg-[var(--rb-red-500)]/10 transition-colors disabled:opacity-40"
          aria-label="Delete rule"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── Run history panel ─────────────────────────────────────────────────────────

const ACTION_LABEL: Record<string, string> = {
  ai_reply:       "AI reply",
  template_reply: "Template reply",
  apply_tag:      "Applied tag",
  escalate:       "Escalated",
  report_spam:    "Flagged",
};

function RunHistoryPanel() {
  const [logs, setLogs]       = useState<AutomationExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/automations/logs?limit=20")
      .then((r) => r.json())
      .then((d: { logs: AutomationExecutionLog[] }) => setLogs(d.logs ?? []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-[var(--rb-bg-hover)]" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <Clock className="size-8 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
        <p className="mt-2 text-xs text-[var(--rb-fg-4)]">No runs yet — logs appear after the next sync.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-start gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-3 py-2.5"
        >
          {/* Status icon */}
          {log.status === "success" ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[var(--rb-fg-2)] truncate">
              <span className="font-medium">{log.ruleName}</span>
              {log.reviewRating && (
                <span className="ml-1 text-[var(--rb-fg-4)]">★{log.reviewRating}</span>
              )}
              {log.reviewSnippet && (
                <span className="ml-1 text-[var(--rb-fg-4)] italic truncate">
                  — &ldquo;{log.reviewSnippet.slice(0, 60)}&hellip;&rdquo;
                </span>
              )}
            </p>
            {log.status === "error" && log.errorMessage && (
              <p className="text-[11px] text-red-400 mt-0.5 truncate">{log.errorMessage}</p>
            )}
          </div>

          {/* Action badge + time */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full border border-[var(--rb-border-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--rb-fg-3)]">
              {ACTION_LABEL[log.action] ?? log.action}
            </span>
            <span className="text-[11px] text-[var(--rb-fg-4)]">{timeAgo(log.executedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BadgePill + PresetCard ────────────────────────────────────────────────────

type BadgeVariant = "AI" | "Reply" | "Tag" | "Report reviews";

const badgeStyles: Record<BadgeVariant, string> = {
  AI:               "bg-[#0A84FF]/10 text-[#0A84FF] border border-[#0A84FF]/25",
  Reply:            "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)] border border-[var(--rb-green-500)]/25",
  Tag:              "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)] border border-[var(--rb-amber-500)]/25",
  "Report reviews": "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)] border border-[var(--rb-red-500)]/25",
};

function BadgePill({ variant }: { variant: BadgeVariant }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
      badgeStyles[variant],
    )}>
      {variant}
    </span>
  );
}

type PresetInstallState = "idle" | "loading" | "success" | "error";

function PresetCard({ preset, onInstall }: { preset: AutomationPreset; onInstall: (p: AutomationPreset) => Promise<void> }) {
  const [state, setState] = useState<PresetInstallState>("idle");

  async function handleInstall() {
    setState("loading");
    try {
      await onInstall(preset);
      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  return (
    <div className="relative rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5 hover:shadow-md transition-shadow">
      {preset.isFree && (
        <span className="absolute top-3 right-3 bg-[var(--rb-green-500)]/100 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">FREE</span>
      )}
      <p className="text-sm font-semibold text-[var(--rb-fg-1)] pr-10">{preset.name}</p>
      <p className="text-xs text-[var(--rb-fg-4)] mt-1">{preset.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {preset.badges.map((badge) => <BadgePill key={badge} variant={badge} />)}
      </div>
      <button
        type="button"
        onClick={handleInstall}
        disabled={state === "loading" || state === "success"}
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed",
          state === "success" ? "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)] border border-[var(--rb-green-500)]/25"
            : state === "error" ? "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)] border border-[var(--rb-red-500)]/25"
            : "bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)]",
        )}
      >
        {state === "loading" ? (
          <><Loader2 className="size-3 animate-spin" strokeWidth={1.5} />Installing…</>
        ) : state === "success" ? (
          <><CheckCircle2 className="size-3" strokeWidth={1.5} />Installed</>
        ) : (
          preset.isFree ? "Install" : "Add"
        )}
      </button>
    </div>
  );
}

// ── AutomationHub ─────────────────────────────────────────────────────────────

type ActiveTab = "rules" | "presets";

export function AutomationHub() {
  const [activeTab, setActiveTab]       = useState<ActiveTab>("rules");
  // Starts empty and only ever shows DB rules. Seeding with sample rules made
  // every zero-rule workspace look configured forever (the fetch below skipped
  // empty responses), and toggling a sample fired the API with a fake id.
  const [rules, setRules]               = useState<AutomationRule[]>([]);
  const [showBuilder, setShowBuilder]   = useState(false);
  const [editingRule, setEditingRule]   = useState<AutomationRule | null>(null);
  const [loading, setLoading]           = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/automations/rules")
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { rules: AutomationRule[] };
        if (!cancelled && Array.isArray(json.rules)) {
          setRules(json.rules);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Read the canonical { error: { code, message } } envelope off a failed response. */
  async function failureMessage(res: Response, fallback: string): Promise<string> {
    const body = await res.json().catch(() => null);
    return apiErrorMessage(body, fallback);
  }

  // These two used to update local state without looking at the response, so a
  // rejected PATCH/DELETE still flipped the switch or removed the row — the
  // rule was untouched on the server and reappeared on the next reload.
  async function handleToggle(id: string, enabled: boolean) {
    setActionError(null);
    const res = await fetch(`/api/automations/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });

    if (!res.ok) {
      setActionError(await failureMessage(res, "Could not update that rule."));
      throw new Error("toggle failed");   // lets RuleRow revert its own switch
    }
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  }

  async function handleDeleteRule(id: string) {
    setActionError(null);
    const res = await fetch(`/api/automations/rules/${id}`, { method: "DELETE" });

    if (!res.ok) {
      setActionError(await failureMessage(res, "Could not delete that rule."));
      throw new Error("delete failed");
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function openEdit(rule: AutomationRule) {
    setEditingRule(rule);
    setShowBuilder(true);
  }

  function handleCloseBuilder() {
    setShowBuilder(false);
    setEditingRule(null);
  }

  async function handleInstallPreset(preset: AutomationPreset) {
    const ruleDefaults = PRESET_TO_RULE[preset.id];
    if (!ruleDefaults) throw new Error("No rule mapping for preset");

    const res = await fetch("/api/automations/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:         ruleDefaults.name ?? preset.name,
        description:  ruleDefaults.description ?? preset.description ?? "",
        conditions:   ruleDefaults.conditions ?? [],
        action:       ruleDefaults.action ?? "ai_reply",
        actionLabel:  ruleDefaults.actionLabel ?? "AI reply",
        actionConfig: ruleDefaults.actionConfig ?? null,
        appsScope:    "all",
        priority:     0,
      }),
    });

    // A failed POST used to insert a fabricated `temp-…` rule, so the preset
    // card showed the green "Installed" state for a rule that does not exist
    // server-side: it never fires, and it vanishes on reload. Throw instead —
    // PresetCard renders its own error state from this.
    if (!res.ok) {
      const message = await failureMessage(res, "Could not install that automation.");
      setActionError(message);
      throw new Error(message);
    }

    const newRule = ((await res.json()) as { rule: AutomationRule }).rule;
    setRules((prev) => [newRule, ...prev]);
  }

  // Both branches previously fell back to writing the user's unsaved edit into
  // local state (`makeTemp`), so a rejected save looked identical to a
  // successful one until the page was reloaded and the rule was gone.
  async function handleSaveRule(rule: Partial<AutomationRule>, editId?: string) {
    setActionError(null);
    try {
      const res = editId
        ? await fetch(`/api/automations/rules/${editId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rule),
          })
        : await fetch("/api/automations/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rule),
          });

      if (!res.ok) {
        setActionError(await failureMessage(res, "Could not save that rule."));
        return;   // keep the builder open so the edit isn't lost
      }

      const json = (await res.json()) as { rule: AutomationRule };
      setRules((prev) =>
        editId
          ? prev.map((r) => (r.id === editId ? json.rule : r))
          : [json.rule, ...prev],
      );
      handleCloseBuilder();
    } catch {
      setActionError("Could not reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="space-y-4">
      {actionError !== null && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-4 py-2 text-sm font-medium text-[var(--rb-red-500)]"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 underline underline-offset-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-[var(--rb-bg-hover)] p-1">
        {(["rules", "presets"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150",
              activeTab === tab ? "bg-surface text-[var(--rb-fg-1)] shadow-sm" : "text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]",
            )}
          >
            {tab === "rules" ? "Added rules" : "Presets"}
          </button>
        ))}
      </div>

      {/* Rules tab */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          {/* Rules list */}
          {/* No section heading here: the tab above already says "Added rules"
              and the page header already carries the Add rule action. Saying
              each twice on one screen was noise. */}
          <div className="space-y-4">
            <div className="space-y-3">
              {loading ? (
                <div className="text-sm text-[var(--rb-fg-4)] py-4 text-center">Loading rules…</div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--rb-border-1)] bg-surface py-16 text-center">
                  <Workflow className="size-12 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
                  <h3 className="mt-4 text-sm font-semibold text-[var(--rb-fg-1)]">No automation rules yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-[var(--rb-fg-4)]">
                    Create rules to auto-reply to reviews, tag issues, and escalate crashes.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setEditingRule(null); setShowBuilder(true); }}
                    className="mt-4 rounded-lg bg-[var(--rb-blue-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--rb-blue-600)]"
                  >
                    Create first rule
                  </button>
                </div>
              ) : (
                // One bordered list with dividers, not floating shadowed cards.
                // Rules are a table the user scans, not content to showcase.
                <div className="divide-y divide-[var(--rb-border-1)] overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
                  {rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      onToggle={handleToggle}
                      onEdit={openEdit}
                      onDelete={handleDeleteRule}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Run history */}
          <div>
            <h2 className="text-base font-semibold text-[var(--rb-fg-1)] mb-3">Run history</h2>
            <RunHistoryPanel />
          </div>
        </div>
      )}

      {/* Presets tab */}
      {activeTab === "presets" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-base font-semibold text-[var(--rb-fg-1)] mb-3">Featured presets</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPresets.map((p) => <PresetCard key={p.id} preset={p} onInstall={handleInstallPreset} />)}
            </div>
          </section>
          <section>
            <h2 className="text-base font-semibold text-[var(--rb-fg-1)] mb-3">Automation presets</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {automationPresets.map((p) => <PresetCard key={p.id} preset={p} onInstall={handleInstallPreset} />)}
            </div>
          </section>
        </div>
      )}

      <RuleBuilderModal
        open={showBuilder}
        onClose={handleCloseBuilder}
        onSave={handleSaveRule}
        initialRule={editingRule ?? undefined}
        editId={editingRule?.id}
      />
    </div>
  );
}

// makeTemp() lived here: it minted a client-only `temp-…` rule whenever a save
// failed, which is what made a rejected save look successful. Removed with the
// handlers that called it — a rule now exists in this list only if the server
// returned it.
