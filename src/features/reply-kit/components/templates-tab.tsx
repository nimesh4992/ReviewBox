"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Shape returned from the API (snake_case from Supabase)
interface ApiTemplate {
  id: string;
  name: string;
  content: string;
  tags: string[];
  rating_min: number;
  rating_max: number;
  language: string;
  usage_count: number;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ISSUE_TAGS = [
  "crash",
  "billing",
  "login",
  "performance",
  "release-regression",
  "feature-request",
  "support-delay",
  "localization",
] as const;

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Japanese"];

const CHAR_LIMIT = 350; // Google Play reply limit

// ── Sub-components ────────────────────────────────────────────────────────────

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
      {tag}
    </span>
  );
}

// ── Tag pill multi-select ─────────────────────────────────────────────────────

interface TagPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

function TagPicker({ selected, onChange }: TagPickerProps) {
  function toggle(tag: string) {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag],
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {ISSUE_TAGS.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => toggle(tag)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              active
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            )}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

// ── Char counter ──────────────────────────────────────────────────────────────

function CharCounter({ count }: { count: number }) {
  const colorClass =
    count >= 340
      ? "text-red-500"
      : count >= 300
        ? "text-amber-500"
        : "text-gray-400";
  return (
    <span className={cn("text-xs transition-colors", colorClass)}>
      {count}/{CHAR_LIMIT} chars
    </span>
  );
}

// ── Inline template form (shared between create + edit) ───────────────────────

interface TemplateFormState {
  name: string;
  content: string;
  tags: string[];
  ratingMin: number;
  ratingMax: number;
  language: string;
}

const EMPTY_FORM: TemplateFormState = {
  name: "",
  content: "",
  tags: [],
  ratingMin: 1,
  ratingMax: 5,
  language: "English",
};

interface TemplateFormProps {
  initial: TemplateFormState;
  saving: boolean;
  submitLabel: string;
  onSubmit: (form: TemplateFormState) => void;
  onCancel: () => void;
}

function TemplateForm({ initial, saving, submitLabel, onSubmit, onCancel }: TemplateFormProps) {
  const [form, setForm] = useState<TemplateFormState>(initial);

  function set<K extends keyof TemplateFormState>(key: K, val: TemplateFormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-2xl border border-[#5B5BD6]/30 bg-[#5B5BD6]/5 p-5 space-y-3"
    >
      {/* Name */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Template name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Thank you — 5 star"
          required
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30"
        />
      </div>

      {/* Content */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">Content</label>
        <textarea
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Write your reply template…"
          required
          rows={4}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30 resize-none"
        />
        <div className="flex items-center justify-between">
          <CharCounter count={form.content.length} />
          <span className="text-[11px] italic text-gray-400">
            Placeholders: {"{appName}"} · {"{supportEmail}"} · {"{teamName}"}
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-600">Issue tags</label>
        <TagPicker selected={form.tags} onChange={(t) => set("tags", t)} />
      </div>

      {/* Rating range */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-gray-600">Min rating</label>
          <select
            value={form.ratingMin}
            onChange={(e) => set("ratingMin", Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6]"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>★{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-gray-600">Max rating</label>
          <select
            value={form.ratingMax}
            onChange={(e) => set("ratingMax", Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6]"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>★{n}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-medium text-gray-600">Language</label>
          <select
            value={form.language}
            onChange={(e) => set("language", e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6]"
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={saving}
          className="bg-[#5B5BD6] text-white hover:bg-[#4f4fbf] disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-gray-500"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── TemplateCard ──────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: ApiTemplate;
  onEdit: (t: ApiTemplate) => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/reply-kit/templates/${template.id}`, { method: "DELETE" });
      onDelete(template.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{template.name}</span>
        {template.tags.map((tag) => (
          <TagChip key={tag} tag={tag} />
        ))}
        <span className="ml-auto shrink-0 text-xs text-gray-400">
          Used {template.usage_count ?? 0} times
        </span>
      </div>

      {/* Content preview */}
      <p className="mt-2 line-clamp-2 text-sm text-gray-500">{template.content}</p>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
          {template.language}
        </span>
        <span className="text-[11px] text-gray-400">
          ★{template.rating_min}–★{template.rating_max}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(template)}
            className="text-gray-400 hover:text-[#5B5BD6]"
          >
            <Pencil strokeWidth={1.5} className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500"
          >
            <Trash2 strokeWidth={1.5} className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── TemplatesTab ──────────────────────────────────────────────────────────────

export function TemplatesTab() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Exactly one of these is non-null at a time
  const [showCreate, setShowCreate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApiTemplate | null>(null);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/reply-kit/templates")
      .then((r) => r.json())
      .then((data: { templates: ApiTemplate[] }) => {
        setTemplates(data.templates ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase()),
  );

  function handleDelete(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingTemplate?.id === id) setEditingTemplate(null);
  }

  function openCreate() {
    setEditingTemplate(null);
    setShowCreate(true);
  }

  function openEdit(template: ApiTemplate) {
    setShowCreate(false);
    setEditingTemplate(template);
  }

  async function handleCreate(form: TemplateFormState) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reply-kit/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          content: form.content,
          tags: form.tags,
          ratingMin: form.ratingMin,
          ratingMax: form.ratingMax,
          language: form.language,
        }),
      });
      const data = (await res.json()) as { template: ApiTemplate };
      setTemplates((prev) => [data.template, ...prev]);
      setShowCreate(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(form: TemplateFormState) {
    if (!editingTemplate) return;
    setSubmitting(true);
    try {
      await fetch(`/api/reply-kit/templates/${editingTemplate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          content: form.content,
          tags: form.tags,
          ratingMin: form.ratingMin,
          ratingMax: form.ratingMax,
          language: form.language,
        }),
      });
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === editingTemplate.id
            ? {
                ...t,
                name: form.name,
                content: form.content,
                tags: form.tags,
                rating_min: form.ratingMin,
                rating_max: form.ratingMax,
                language: form.language,
              }
            : t,
        ),
      );
      setEditingTemplate(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Reply templates</h2>
        <Button
          size="sm"
          className="bg-[#5B5BD6] text-white hover:bg-[#4f4fbf]"
          onClick={openCreate}
        >
          <Plus strokeWidth={1.5} className="size-4" />
          New template
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <TemplateForm
          initial={EMPTY_FORM}
          saving={submitting}
          submitLabel="Save template"
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Edit form */}
      {editingTemplate && (
        <TemplateForm
          initial={{
            name: editingTemplate.name,
            content: editingTemplate.content,
            tags: editingTemplate.tags ?? [],
            ratingMin: editingTemplate.rating_min,
            ratingMax: editingTemplate.rating_max,
            language: editingTemplate.language,
          }}
          saving={submitting}
          submitLabel="Save changes"
          onSubmit={handleEdit}
          onCancel={() => setEditingTemplate(null)}
        />
      )}

      {/* Search */}
      <div className="relative">
        <Search
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="h-9 w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30"
        />
      </div>

      {/* Template list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-gray-100"
              />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            {templates.length === 0
              ? "No templates yet. Create your first one above."
              : "No templates match your search."}
          </p>
        )}
      </div>
    </div>
  );
}
