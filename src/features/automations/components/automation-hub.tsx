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
import { cn } from "@/lib/utils";
import type { AutomationExecutionLog, AutomationPreset, AutomationRule } from "@/types/review";
import { featuredPresets, automationPresets, mockRules } from "@/features/automations/data/mock-automations";
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
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-indigo-500)] focus-visible:ring-offset-2",
        enabled ? "bg-[var(--rb-indigo-500)]" : "bg-[var(--rb-bg-hover)]",
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
        enabled ? "translate-x-4" : "translate-x-1",
      )} />
    </button>
  );
}

function MetaColumn({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-start min-w-[80px]">
      <span className="text-xs font-semibold text-[var(--rb-fg-2)]">{value}</span>
      <span className="text-[10px] text-[var(--rb-fg-4)] mt-0.5">{label}</span>
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
    <div className="rounded-2xl border border-[var(--rb-border-1)] bg-white shadow-sm p-4 flex items-center gap-4">
      <Toggle enabled={enabled} onToggle={handleToggle} />

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold text-[var(--rb-fg-1)] truncate", saving && "opacity-60")}>
          {rule.isRecommended && <span className="text-[var(--rb-indigo-500)] mr-1">[Recommended]</span>}
          {rule.name}
        </p>
        <p className="text-xs text-[var(--rb-fg-4)] mt-0.5 truncate">{rule.description}</p>
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
          className="rounded-lg p-1.5 text-[var(--rb-fg-4)] hover:text-[var(--rb-indigo-500)] hover:bg-indigo-50 transition-colors"
          aria-label="Edit rule"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-[var(--rb-fg-4)] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
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
          className="flex items-start gap-3 rounded-xl border border-[var(--rb-border-1)] bg-white px-3 py-2.5"
        >
          {/* Status icon */}
          {log.status === "success" ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" strokeWidth={2} />
          ) : (
            <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" strokeWidth={2} />
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
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
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
  AI:               "bg-blue-50 text-blue-600 border border-blue-200",
  Reply:            "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Tag:              "bg-amber-50 text-amber-600 border border-amber-200",
  "Report reviews": "bg-red-50 text-red-600 border border-red-200",
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
    <div className="relative rounded-2xl border border-[var(--rb-border-1)] bg-white shadow-sm p-5 hover:shadow-md transition-shadow">
      {preset.isFree && (
        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">FREE</span>
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
          state === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : state === "error" ? "bg-red-50 text-red-600 border border-red-200"
            : "bg-[var(--rb-indigo-500)] text-white hover:bg-[var(--rb-indigo-600)]",
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
  const [rules, setRules]               = useState<AutomationRule[]>(mockRules);
  const [showBuilder, setShowBuilder]   = useState(false);
  const [editingRule, setEditingRule]   = useState<AutomationRule | null>(null);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/automations/rules")
      .then(async (res) => {
        if (!res.ok) return;
        const json = (await res.json()) as { rules: AutomationRule[] };
        if (!cancelled && Array.isArray(json.rules) && json.rules.length > 0) {
          setRules(json.rules);
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`/api/automations/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
  }

  async function handleDeleteRule(id: string) {
    await fetch(`/api/automations/rules/${id}`, { method: "DELETE" });
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

    const newRule: AutomationRule = res.ok
      ? ((await res.json()) as { rule: AutomationRule }).rule
      : {
          id:          `temp-${Date.now()}`,
          name:        ruleDefaults.name ?? preset.name,
          description: ruleDefaults.description ?? preset.description ?? "",
          enabled:     true,
          conditions:  ruleDefaults.conditions ?? [],
          action:      ruleDefaults.action ?? "ai_reply",
          actionLabel: ruleDefaults.actionLabel ?? "AI reply",
          actionConfig: ruleDefaults.actionConfig,
          appsScope:   "all",
          priority:    0,
          timesRun:    0,
          lastRunAt:   null,
          createdAt:   new Date().toISOString(),
        };

    setRules((prev) => [newRule, ...prev]);
  }

  async function handleSaveRule(rule: Partial<AutomationRule>, editId?: string) {
    if (editId) {
      try {
        const res = await fetch(`/api/automations/rules/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
        if (res.ok) {
          const json = (await res.json()) as { rule: AutomationRule };
          setRules((prev) => prev.map((r) => (r.id === editId ? json.rule : r)));
        } else {
          setRules((prev) => prev.map((r) =>
            r.id === editId ? { ...r, ...rule, actionLabel: rule.actionLabel ?? r.actionLabel } : r,
          ));
        }
      } catch {
        setRules((prev) => prev.map((r) =>
          r.id === editId ? { ...r, ...rule, actionLabel: rule.actionLabel ?? r.actionLabel } : r,
        ));
      }
    } else {
      try {
        const res = await fetch("/api/automations/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rule),
        });
        if (res.ok) {
          const json = (await res.json()) as { rule: AutomationRule };
          setRules((prev) => [json.rule, ...prev]);
        } else {
          setRules((prev) => [makeTemp(rule), ...prev]);
        }
      } catch {
        setRules((prev) => [makeTemp(rule), ...prev]);
      }
    }
    handleCloseBuilder();
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-[var(--rb-bg-hover)] p-1">
        {(["rules", "presets"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150",
              activeTab === tab ? "bg-white text-[var(--rb-fg-1)] shadow-sm" : "text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]",
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--rb-fg-1)]">Added rules</h2>
              <Button
                size="sm"
                className="h-8 bg-[var(--rb-indigo-500)] hover:bg-[var(--rb-indigo-600)] text-white"
                onClick={() => { setEditingRule(null); setShowBuilder(true); }}
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                Add rule
              </Button>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="text-sm text-[var(--rb-fg-4)] py-4 text-center">Loading rules…</div>
              ) : rules.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--rb-border-1)] bg-white py-16 text-center">
                  <Workflow className="size-12 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
                  <h3 className="mt-4 text-sm font-semibold text-[var(--rb-fg-1)]">No automation rules yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-[var(--rb-fg-4)]">
                    Create rules to auto-reply to reviews, tag issues, and escalate crashes.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setEditingRule(null); setShowBuilder(true); }}
                    className="mt-4 rounded-lg bg-[var(--rb-indigo-500)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--rb-indigo-600)]"
                  >
                    Create first rule
                  </button>
                </div>
              ) : (
                rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onToggle={handleToggle}
                    onEdit={openEdit}
                    onDelete={handleDeleteRule}
                  />
                ))
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTemp(rule: Partial<AutomationRule>): AutomationRule {
  return {
    id:          `temp-${Date.now()}`,
    name:        rule.name ?? "Untitled rule",
    description: rule.description ?? "",
    enabled:     true,
    conditions:  rule.conditions ?? [],
    action:      rule.action ?? "ai_reply",
    actionLabel: rule.actionLabel ?? "AI reply",
    actionConfig: rule.actionConfig,
    appsScope:   rule.appsScope ?? "all",
    priority:    rule.priority ?? 0,
    timesRun:    0,
    lastRunAt:   null,
    createdAt:   new Date().toISOString(),
  };
}
