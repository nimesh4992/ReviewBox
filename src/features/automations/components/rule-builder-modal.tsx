"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  AutomationRule,
  AutomationCondition,
  AutomationConditionField,
  AutomationAction,
} from "@/types/review";

// ── Constants ─────────────────────────────────────────────────────────────────

const FIELD_OPTIONS: { value: AutomationConditionField; label: string }[] = [
  { value: "rating",    label: "Rating" },
  { value: "sentiment", label: "Sentiment" },
  { value: "tag",       label: "Tag" },
  { value: "keyword",   label: "Keyword" },
  { value: "platform",  label: "Platform" },
  { value: "country",   label: "Country" },
  { value: "version",   label: "Version" },
];

const OPERATOR_OPTIONS_BY_FIELD: Record<
  AutomationConditionField,
  { value: AutomationCondition["operator"]; label: string }[]
> = {
  rating:    [
    { value: "equals",       label: "equals" },
    { value: "less_than",    label: "less than" },
    { value: "greater_than", label: "greater than" },
  ],
  sentiment: [{ value: "equals",   label: "equals" }],
  tag:       [
    { value: "equals", label: "equals" },
    { value: "in",     label: "is one of" },
  ],
  keyword:   [{ value: "contains", label: "contains" }],
  platform:  [{ value: "equals",   label: "equals" }],
  country:   [
    { value: "equals", label: "equals" },
    { value: "in",     label: "is one of" },
  ],
  version:   [
    { value: "equals",   label: "equals" },
    { value: "contains", label: "contains" },
  ],
};

const ACTION_OPTIONS: { value: AutomationAction; label: string; description: string }[] = [
  { value: "ai_reply",       label: "Generate AI reply",    description: "Draft a reply with AI — you review before publishing" },
  { value: "auto_reply",     label: "Auto-reply (AI)",      description: "Generate and publish an AI reply automatically — no review needed" },
  { value: "template_reply", label: "Reply with template",  description: "Use a saved reply template (auto-matched by rating if none chosen)" },
  { value: "apply_tag",      label: "Apply tag",            description: "Add an issue tag to the review for filtering" },
  { value: "escalate",       label: "Escalate to team",     description: "Mark as urgent and set escalation to engineering" },
  { value: "report_spam",    label: "Flag for review",      description: "Mark the review for manual spam review" },
];

const ACTION_LABELS: Record<AutomationAction, string> = {
  ai_reply:       "AI reply",
  auto_reply:     "Auto-reply (AI)",
  template_reply: "Template reply",
  apply_tag:      "Apply tag",
  escalate:       "Escalate",
  report_spam:    "Flag for review",
};

const ISSUE_TAGS = [
  "crash", "billing", "login", "performance",
  "release-regression", "feature-request", "support-delay", "localization",
] as const;

// ── Template type (minimal — fetched for picker) ──────────────────────────────

interface TemplateSummary {
  id: string;
  name: string;
  rating_min: number;
  rating_max: number;
}

// ── ValueInput ────────────────────────────────────────────────────────────────

interface ValueInputProps {
  field: AutomationConditionField;
  value: string;
  onChange: (v: string) => void;
}

function ValueInput({ field, value, onChange }: ValueInputProps) {
  const selectClass =
    "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]";

  if (field === "rating") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Pick rating…</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={String(n)}>{n} star{n !== 1 ? "s" : ""}</option>
        ))}
      </select>
    );
  }
  if (field === "sentiment") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Pick sentiment…</option>
        <option value="critical">Critical</option>
        <option value="negative">Negative</option>
        <option value="mixed">Mixed</option>
        <option value="positive">Positive</option>
      </select>
    );
  }
  if (field === "platform") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Pick platform…</option>
        <option value="Google Play">Google Play</option>
        <option value="App Store">App Store</option>
      </select>
    );
  }
  if (field === "tag") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Pick tag…</option>
        {ISSUE_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={
        field === "keyword" ? "e.g. crash, won't open"
          : field === "country" ? "e.g. DE, US"
          : "e.g. 5.42.0"
      }
    />
  );
}

// ── ConditionRow ──────────────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: AutomationCondition;
  onChange: (c: AutomationCondition) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 transition-[color,box-shadow]";

  const operatorOptions = OPERATOR_OPTIONS_BY_FIELD[condition.field] ?? [];

  function handleFieldChange(field: AutomationConditionField) {
    const newOps = OPERATOR_OPTIONS_BY_FIELD[field];
    onChange({ field, operator: newOps[0]?.value ?? "equals", value: "" });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value as AutomationConditionField)}
        className={cn(selectClass, "min-w-[110px]")}
      >
        {FIELD_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <select
        value={condition.operator}
        onChange={(e) =>
          onChange({ ...condition, operator: e.target.value as AutomationCondition["operator"] })
        }
        className={cn(selectClass, "min-w-[110px]")}
      >
        {operatorOptions.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>

      <div className="flex-1 min-w-[120px]">
        <ValueInput
          field={condition.field}
          value={String(condition.value)}
          onChange={(v) => onChange({ ...condition, value: v })}
        />
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label="Remove condition"
      >
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── ActionConfig sub-forms ────────────────────────────────────────────────────

function ApplyTagConfig({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  return (
    <div className="mt-3 space-y-1">
      <label className="text-xs font-medium text-gray-600">Which tag to apply</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="">Pick tag…</option>
        {ISSUE_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {!value && (
        <p className="text-[11px] text-amber-500">Required — rule won&apos;t fire without a tag.</p>
      )}
    </div>
  );
}

function TemplateReplyConfig({
  value,
  templates,
  loading,
  onChange,
}: {
  value: string;
  templates: TemplateSummary[];
  loading: boolean;
  onChange: (v: string) => void;
}) {
  const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  return (
    <div className="mt-3 space-y-1">
      <label className="text-xs font-medium text-gray-600">Template (optional)</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
        disabled={loading}
      >
        <option value="">Auto-match by star rating</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} (★{t.rating_min}–★{t.rating_max})
          </option>
        ))}
      </select>
      <p className="text-[11px] text-gray-400">
        {loading ? "Loading templates…" : "Leave blank to auto-select by rating."}
      </p>
    </div>
  );
}

// ── RuleBuilderModal ──────────────────────────────────────────────────────────

interface RuleBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (rule: Partial<AutomationRule>, editId?: string) => void;
  initialRule?: Partial<AutomationRule>;
  editId?: string;
}

const DEFAULT_CONDITION: AutomationCondition = {
  field: "rating",
  operator: "less_than",
  value: "",
};

export function RuleBuilderModal({
  open,
  onClose,
  onSave,
  initialRule,
  editId,
}: RuleBuilderModalProps) {
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [conditions, setConditions]   = useState<AutomationCondition[]>([{ ...DEFAULT_CONDITION }]);
  const [action, setAction]           = useState<AutomationAction>("ai_reply");
  const [actionConfig, setActionConfig] = useState("");
  const [appsScope, setAppsScope]     = useState<"all" | "specific">("all");
  const [specificApp, setSpecificApp] = useState("");

  // Template list for template_reply picker
  const [templates, setTemplates]     = useState<TemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Populate from initialRule when it changes (edit mode)
  useEffect(() => {
    if (initialRule) {
      setName(initialRule.name ?? "");
      setDescription(initialRule.description ?? "");
      setConditions(
        initialRule.conditions?.length ? initialRule.conditions : [{ ...DEFAULT_CONDITION }],
      );
      setAction(initialRule.action ?? "ai_reply");
      setActionConfig(initialRule.actionConfig ?? "");
      const scope = initialRule.appsScope;
      if (!scope || scope === "all") {
        setAppsScope("all"); setSpecificApp("");
      } else if (Array.isArray(scope)) {
        setAppsScope("specific"); setSpecificApp(scope[0] ?? "");
      } else {
        setAppsScope("all"); setSpecificApp("");
      }
    } else {
      reset();
    }
  }, [initialRule]);

  // Load templates when action switches to template_reply
  useEffect(() => {
    if (action === "template_reply" && templates.length === 0 && !loadingTemplates) {
      setLoadingTemplates(true);
      fetch("/api/reply-kit/templates")
        .then((r) => r.json())
        .then((d: { templates: TemplateSummary[] }) => setTemplates(d.templates ?? []))
        .catch(() => undefined)
        .finally(() => setLoadingTemplates(false));
    }
  }, [action, templates.length, loadingTemplates]);

  function reset() {
    setName("");
    setDescription("");
    setConditions([{ ...DEFAULT_CONDITION }]);
    setAction("ai_reply");
    setActionConfig("");
    setAppsScope("all");
    setSpecificApp("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSave() {
    const resolvedScope: "all" | string[] =
      appsScope === "all" ? "all" : specificApp ? [specificApp] : "all";

    onSave(
      {
        name,
        description,
        conditions,
        action,
        actionLabel: ACTION_LABELS[action],
        actionConfig: actionConfig || undefined,
        appsScope: resolvedScope,
        priority: initialRule?.priority ?? 0,
      },
      editId,
    );
    reset();
  }

  const isEditing   = Boolean(editId);
  const canSave     = name.trim() && (action !== "apply_tag" || actionConfig);
  const labelClass  = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block";
  const sectionClass = "space-y-3";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-gray-900">
            {isEditing ? "Edit Rule" : "New Automation Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Name */}
          <div className={sectionClass}>
            <label className={labelClass}>Rule name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reply to negative feedback"
            />
          </div>

          {/* Description */}
          <div className={sectionClass}>
            <label className={labelClass}>
              Description{" "}
              <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this rule do?"
            />
          </div>

          {/* Conditions */}
          <div className={sectionClass}>
            <label className={labelClass}>When…</label>
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <ConditionRow
                  key={i}
                  condition={cond}
                  onChange={(updated) =>
                    setConditions((prev) => prev.map((c, idx) => (idx === i ? updated : c)))
                  }
                  onRemove={() =>
                    setConditions((prev) => prev.filter((_, idx) => idx !== i))
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setConditions((prev) => [...prev, { ...DEFAULT_CONDITION }])}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#5B5BD6] hover:text-[#4a4ac4] transition-colors"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              Add condition
            </button>
          </div>

          {/* Action */}
          <div className={sectionClass}>
            <label className={labelClass}>Then…</label>
            <div className="space-y-1.5">
              {ACTION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors",
                    action === opt.value
                      ? "border-[#5B5BD6] bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50",
                  )}
                >
                  <input
                    type="radio"
                    name="action"
                    value={opt.value}
                    checked={action === opt.value}
                    onChange={() => { setAction(opt.value); setActionConfig(""); }}
                    className="accent-[#5B5BD6] mt-0.5"
                  />
                  <div>
                    <span className={cn(
                      "text-sm font-medium",
                      action === opt.value ? "text-[#5B5BD6]" : "text-gray-700",
                    )}>
                      {opt.label}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Action-specific config */}
            {action === "apply_tag" && (
              <ApplyTagConfig value={actionConfig} onChange={setActionConfig} />
            )}
            {action === "template_reply" && (
              <TemplateReplyConfig
                value={actionConfig}
                templates={templates}
                loading={loadingTemplates}
                onChange={setActionConfig}
              />
            )}
          </div>

          {/* Apps scope */}
          <div className={sectionClass}>
            <label className={labelClass}>Apply to</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio" name="appsScope" value="all"
                  checked={appsScope === "all"}
                  onChange={() => setAppsScope("all")}
                  className="accent-[#5B5BD6]"
                />
                All apps
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio" name="appsScope" value="specific"
                  checked={appsScope === "specific"}
                  onChange={() => setAppsScope("specific")}
                  className="accent-[#5B5BD6]"
                />
                Specific app
              </label>
            </div>
            {appsScope === "specific" && (
              <Input
                className="mt-2"
                value={specificApp}
                onChange={(e) => setSpecificApp(e.target.value)}
                placeholder="App name or bundle ID"
              />
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-gray-100">
          <Button variant="outline" onClick={handleClose} className="border-gray-200 text-gray-600">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-[#5B5BD6] hover:bg-[#4a4ac4] text-white"
          >
            {isEditing ? "Update rule" : "Save rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
