"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutomationRule, AutomationPreset } from "@/types/review";
import { featuredPresets, automationPresets, mockRules } from "@/features/automations/data/mock-automations";
import { RuleBuilderModal } from "./rule-builder-modal";

// ── Preset → default rule mapping ─────────────────────────────────────────────

const PRESET_TO_RULE: Record<string, Partial<AutomationRule>> = {
  "preset-featured-1": {
    name: "Auto-reply to all new reviews",
    description: "Reply to all new reviews with AI",
    conditions: [{ field: "rating", operator: "greater_than", value: "0" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-featured-2": {
    name: "Reply to positive reviews",
    description: "Reply to all positive reviews with AI",
    conditions: [{ field: "rating", operator: "greater_than", value: "3" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-featured-3": {
    name: "Reply to negative reviews",
    description: "Reply to all negative reviews with AI",
    conditions: [{ field: "rating", operator: "less_than", value: "3" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-featured-4": {
    name: "Tag feature requests",
    description: "Assign tag 'Feature request'",
    conditions: [{ field: "tag", operator: "equals", value: "feature-request" }],
    action: "apply_tag",
    actionLabel: "Apply tag",
  },
  "preset-featured-5": {
    name: "Tag bug reports",
    description: "Assign tag 'Bug report'",
    conditions: [{ field: "tag", operator: "equals", value: "crash" }],
    action: "apply_tag",
    actionLabel: "Apply tag",
  },
  "preset-featured-6": {
    name: "Report SPAM and offensive reviews",
    description: "Get rid of SPAM and offensive reviews",
    conditions: [{ field: "sentiment", operator: "equals", value: "critical" }],
    action: "report_spam",
    actionLabel: "Report spam",
  },
  "preset-auto-1": {
    name: "Reply to feature requests",
    description: "Reply to all reviews with feature requests",
    conditions: [{ field: "tag", operator: "equals", value: "feature-request" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-auto-2": {
    name: "Auto-tag crash reports",
    description: "Seamlessly cover all reviews reporting crashes",
    conditions: [{ field: "tag", operator: "equals", value: "crash" }],
    action: "apply_tag",
    actionLabel: "Apply crash tag",
  },
  "preset-auto-3": {
    name: "Handle billing issues",
    description: "Handle all billing and payment complaints",
    conditions: [{ field: "tag", operator: "equals", value: "billing" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-auto-4": {
    name: "Tag satisfied users",
    description: "Assign tag 'Satisfied users'",
    conditions: [{ field: "rating", operator: "equals", value: "5" }],
    action: "apply_tag",
    actionLabel: "Apply tag",
  },
  "preset-auto-5": {
    name: "Respond to login problems",
    description: "Respond to all login and account issues",
    conditions: [{ field: "tag", operator: "equals", value: "login" }],
    action: "ai_reply",
    actionLabel: "AI reply",
  },
  "preset-auto-6": {
    name: "Tag performance issues",
    description: "Assign tag 'Performance'",
    conditions: [{ field: "tag", operator: "equals", value: "performance" }],
    action: "apply_tag",
    actionLabel: "Apply tag",
  },
};

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

function Toggle({ enabled, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-checked={enabled}
      role="switch"
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B5BD6] focus-visible:ring-offset-2",
        enabled ? "bg-[#5B5BD6]" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          enabled ? "translate-x-4" : "translate-x-1"
        )}
      />
    </button>
  );
}

// ── MetaColumn ────────────────────────────────────────────────────────────────

interface MetaColumnProps {
  value: string;
  label: string;
}

function MetaColumn({ value, label }: MetaColumnProps) {
  return (
    <div className="flex flex-col items-start min-w-[80px]">
      <span className="text-xs font-semibold text-gray-700">{value}</span>
      <span className="text-[10px] text-gray-400 mt-0.5">{label}</span>
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await onToggle(rule.id, next);
    } catch {
      setEnabled(!next); // revert optimistic update on error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    setDeleting(true);
    try {
      await onDelete(rule.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex items-center gap-4">
      {/* Toggle */}
      <Toggle enabled={enabled} onToggle={handleToggle} />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold text-gray-900 truncate", saving && "opacity-60")}>
          {rule.isRecommended && (
            <span className="text-[#5B5BD6] mr-1">[Recommended]</span>
          )}
          {rule.name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{rule.description}</p>
      </div>

      {/* Meta columns — hidden on mobile */}
      <div className="hidden md:flex items-center gap-6">
        <MetaColumn
          value={Array.isArray(rule.appsScope) ? rule.appsScope.join(", ") : "All apps"}
          label="Apps"
        />
        <MetaColumn value={rule.actionLabel} label="Action" />
        <MetaColumn value={String(rule.timesRun)} label="Times run" />
        <MetaColumn value={rule.lastRunAt ?? "—"} label="Last run" />
      </div>

      {/* Edit + Delete buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onEdit(rule)}
          className="rounded-lg p-1.5 text-gray-400 hover:text-[#5B5BD6] hover:bg-indigo-50 transition-colors"
          aria-label="Edit rule"
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-lg p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
          aria-label="Delete rule"
        >
          <Trash2 className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── BadgePill ─────────────────────────────────────────────────────────────────

type BadgeVariant = "AI" | "Reply" | "Tag" | "Report reviews";

const badgeStyles: Record<BadgeVariant, string> = {
  AI: "bg-blue-50 text-blue-600 border border-blue-200",
  Reply: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Tag: "bg-amber-50 text-amber-600 border border-amber-200",
  "Report reviews": "bg-red-50 text-red-600 border border-red-200",
};

interface BadgePillProps {
  variant: BadgeVariant;
}

function BadgePill({ variant }: BadgePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        badgeStyles[variant]
      )}
    >
      {variant}
    </span>
  );
}

// ── PresetCard ────────────────────────────────────────────────────────────────

type PresetInstallState = "idle" | "loading" | "success" | "error";

interface PresetCardProps {
  preset: AutomationPreset;
  onInstall: (preset: AutomationPreset) => Promise<void>;
}

function PresetCard({ preset, onInstall }: PresetCardProps) {
  const [installState, setInstallState] = useState<PresetInstallState>("idle");

  async function handleInstall() {
    setInstallState("loading");
    try {
      await onInstall(preset);
      setInstallState("success");
      setTimeout(() => setInstallState("idle"), 2000);
    } catch {
      setInstallState("error");
      setTimeout(() => setInstallState("idle"), 2000);
    }
  }

  const ctaLabel = (() => {
    if (installState === "loading") return null;
    if (installState === "success") return "✓ Installed";
    if (installState === "error") return "Failed";
    return preset.isFree ? "Install" : "Add";
  })();

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm p-5 hover:shadow-md transition-shadow duration-150">
      {/* FREE badge */}
      {preset.isFree && (
        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          FREE
        </span>
      )}

      <p className="text-sm font-semibold text-gray-900 pr-10">{preset.name}</p>
      <p className="text-xs text-gray-400 mt-1">{preset.description}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {preset.badges.map((badge) => (
          <BadgePill key={badge} variant={badge} />
        ))}
      </div>

      <button
        type="button"
        onClick={handleInstall}
        disabled={installState === "loading" || installState === "success"}
        className={cn(
          "mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed",
          installState === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : installState === "error"
              ? "bg-red-50 text-red-600 border border-red-200"
              : "bg-[#5B5BD6] text-white hover:bg-[#4a4ac4]",
        )}
      >
        {installState === "loading" ? (
          <>
            <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            Installing…
          </>
        ) : installState === "success" ? (
          <>
            <CheckCircle2 className="size-3" strokeWidth={1.5} />
            {ctaLabel}
          </>
        ) : (
          ctaLabel
        )}
      </button>
    </div>
  );
}

// ── AutomationHub ─────────────────────────────────────────────────────────────

type ActiveTab = "rules" | "presets";

export function AutomationHub() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("rules");
  const [rules, setRules] = useState<AutomationRule[]>(mockRules);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch rules from API on mount; fall back to mock data if fetch fails
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
      .catch(() => {
        // network error — keep mock data
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
        name: ruleDefaults.name ?? preset.name,
        description: ruleDefaults.description ?? preset.description,
        conditions: ruleDefaults.conditions ?? [],
        action: ruleDefaults.action ?? "ai_reply",
        actionLabel: ruleDefaults.actionLabel ?? "AI reply",
        appsScope: "all",
        priority: 0,
      }),
    });

    if (res.ok) {
      const json = (await res.json()) as { rule: AutomationRule };
      setRules((prev) => [json.rule, ...prev]);
    } else {
      const tempRule: AutomationRule = {
        id: `temp-${Date.now()}`,
        name: ruleDefaults.name ?? preset.name,
        description: ruleDefaults.description ?? preset.description,
        enabled: true,
        conditions: ruleDefaults.conditions ?? [],
        action: ruleDefaults.action ?? "ai_reply",
        actionLabel: ruleDefaults.actionLabel ?? "AI reply",
        appsScope: "all",
        priority: 0,
        timesRun: 0,
        lastRunAt: null,
        createdAt: new Date().toISOString(),
      };
      setRules((prev) => [tempRule, ...prev]);
    }
  }

  async function handleSaveRule(rule: Partial<AutomationRule>, editId?: string) {
    if (editId) {
      // Edit existing rule
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
          // Optimistic update
          setRules((prev) =>
            prev.map((r) =>
              r.id === editId
                ? { ...r, ...rule, actionLabel: rule.actionLabel ?? r.actionLabel }
                : r,
            ),
          );
        }
      } catch {
        setRules((prev) =>
          prev.map((r) =>
            r.id === editId
              ? { ...r, ...rule, actionLabel: rule.actionLabel ?? r.actionLabel }
              : r,
          ),
        );
      }
    } else {
      // Create new rule
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
          const tempRule: AutomationRule = {
            id: `temp-${Date.now()}`,
            name: rule.name ?? "Untitled rule",
            description: rule.description ?? "",
            enabled: true,
            conditions: rule.conditions ?? [],
            action: rule.action ?? "ai_reply",
            actionLabel: rule.actionLabel ?? "Custom AI reply",
            appsScope: rule.appsScope ?? "all",
            priority: rule.priority ?? 0,
            timesRun: 0,
            lastRunAt: null,
            createdAt: new Date().toISOString(),
          };
          setRules((prev) => [tempRule, ...prev]);
        }
      } catch {
        const tempRule: AutomationRule = {
          id: `temp-${Date.now()}`,
          name: rule.name ?? "Untitled rule",
          description: rule.description ?? "",
          enabled: true,
          conditions: rule.conditions ?? [],
          action: rule.action ?? "ai_reply",
          actionLabel: rule.actionLabel ?? "Custom AI reply",
          appsScope: rule.appsScope ?? "all",
          priority: rule.priority ?? 0,
          timesRun: 0,
          lastRunAt: null,
          createdAt: new Date().toISOString(),
        };
        setRules((prev) => [tempRule, ...prev]);
      }
    }

    handleCloseBuilder();
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            { id: "rules", label: "Added rules" },
            { id: "presets", label: "Presets" },
          ] as { id: ActiveTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Added rules tab */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Added rules</h2>
            <Button
              size="sm"
              className="h-8 bg-[#5B5BD6] hover:bg-[#4a4ac4] text-white"
              onClick={() => { setEditingRule(null); setShowBuilder(true); }}
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              Add rule
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-sm text-gray-400 py-4 text-center">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
                <Workflow className="size-12 text-gray-200" strokeWidth={1.5} />
                <h3 className="mt-4 text-sm font-semibold text-gray-900">No automation rules yet</h3>
                <p className="mt-1 max-w-xs text-xs text-gray-400">
                  Create rules to auto-reply to common reviews, tag issues, and escalate crashes.
                </p>
                <button
                  type="button"
                  onClick={() => { setEditingRule(null); setShowBuilder(true); }}
                  className="mt-4 rounded-lg bg-[#5B5BD6] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#4a4ac4]"
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
      )}

      {/* Presets tab */}
      {activeTab === "presets" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Featured presets</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredPresets.map((preset) => (
                <PresetCard key={preset.id} preset={preset} onInstall={handleInstallPreset} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-gray-900 mb-3">Automation presets</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {automationPresets.map((preset) => (
                <PresetCard key={preset.id} preset={preset} onInstall={handleInstallPreset} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Rule builder modal */}
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
