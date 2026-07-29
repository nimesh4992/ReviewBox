"use client";

import { useEffect, useState } from "react";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KbCategory = "product" | "known_issue" | "faq" | "roadmap";

// Shape returned from the API (snake_case from Supabase)
interface ApiKbEntry {
  id: string;
  title: string;
  content: string;
  category: KbCategory;
  created_at: string;
}

const CATEGORY_CONFIG: Record<KbCategory, { label: string; className: string }> = {
  product: { label: "Product", className: "bg-[#0A84FF]/10 text-[#0A84FF]" },
  known_issue: { label: "Known issue", className: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)]" },
  faq: { label: "FAQ", className: "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)]" },
  roadmap: { label: "Roadmap", className: "bg-[var(--rb-purple-100)] text-[var(--rb-purple-600)]" },
};

const CATEGORIES: KbCategory[] = ["product", "known_issue", "faq", "roadmap"];

// ── EntryForm ─────────────────────────────────────────────────────────────────

interface EntryFormState {
  title: string;
  content: string;
  category: KbCategory;
}

const EMPTY_ENTRY_FORM: EntryFormState = { title: "", content: "", category: "product" };

interface EntryFormProps {
  initial: EntryFormState;
  saving: boolean;
  submitLabel: string;
  onSubmit: (form: EntryFormState) => void;
  onCancel: () => void;
}

function EntryForm({ initial, saving, submitLabel, onSubmit, onCancel }: EntryFormProps) {
  const [form, setForm] = useState<EntryFormState>(initial);

  function set<K extends keyof EntryFormState>(key: K, val: EntryFormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) return;
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-2xl border border-[var(--rb-blue-500)]/30 bg-[var(--rb-blue-500)]/5 p-5 space-y-3"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-fg-2">Title</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Current known issues"
          required
          className="rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 py-2 text-sm text-fg-1 outline-none focus:border-[var(--rb-blue-500)] focus:ring-1 focus:ring-[var(--rb-blue-500)]/30"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-fg-2">Content</label>
        <textarea
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Describe the product info, known issue, FAQ, or roadmap item…"
          required
          rows={4}
          className="rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 py-2 text-sm text-fg-1 outline-none focus:border-[var(--rb-blue-500)] focus:ring-1 focus:ring-[var(--rb-blue-500)]/30 resize-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-fg-2">Category</label>
        <select
          value={form.category}
          onChange={(e) => set("category", e.target.value as KbCategory)}
          className="rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 py-2 text-sm text-fg-1 outline-none focus:border-[var(--rb-blue-500)] focus:ring-1 focus:ring-[var(--rb-blue-500)]/30"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={saving}
          className="bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)] disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-fg-3"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── EntryCard ─────────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: ApiKbEntry;
  onEdit: (e: ApiKbEntry) => void;
  onDelete: (id: string) => void;
}) {
  const config = CATEGORY_CONFIG[entry.category];
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Same as templates: the entry vanished from the list even when the request
  // failed, so the deletion looked done until a refresh brought it back.
  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/reply-kit/knowledge-base/${entry.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDelete(entry.id);
    } catch {
      setDeleteError("Couldn't delete — try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-sm">
      {/* Top row: title + category badge */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-fg-1">{entry.title}</span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            config.className,
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Content */}
      <p className="mt-2 text-sm text-fg-3">{entry.content}</p>

      {/* Footer */}
      <div className="mt-3 flex items-center">
        <span className="text-[11px] text-fg-3">
          Added {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(entry)}
            className="text-fg-3 hover:text-[var(--rb-blue-500)]"
          >
            <Pencil strokeWidth={1.5} className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={deleting}
            onClick={handleDelete}
            className="text-fg-3 hover:text-[var(--rb-red-500)]"
            aria-label="Delete entry"
          >
            <Trash2 strokeWidth={1.5} className="size-3.5" />
          </Button>
        </div>
      </div>
      {deleteError && (
        <p className="mt-2 text-right text-[12px] text-[var(--rb-red-500)]">{deleteError}</p>
      )}
    </div>
  );
}

// ── KnowledgeBaseTab ──────────────────────────────────────────────────────────

export function KnowledgeBaseTab() {
  const [entries, setEntries] = useState<ApiKbEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ApiKbEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/reply-kit/knowledge-base")
      .then((r) => r.json())
      .then((data: { entries: ApiKbEntry[] }) => {
        setEntries(data.entries ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (editingEntry?.id === id) setEditingEntry(null);
  }

  function openEdit(entry: ApiKbEntry) {
    setShowAdd(false);
    setEditingEntry(entry);
  }

  async function handleCreate(form: EntryFormState) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/reply-kit/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, content: form.content, category: form.category }),
      });
      // Guard: on a failed POST, data.entry is undefined — pushing it would
      // crash EntryCard on entry.category/entry.title. Throw to the catch.
      if (!res.ok) throw new Error(`create failed: ${res.status}`);
      const data = (await res.json()) as { entry?: ApiKbEntry };
      if (!data.entry) throw new Error("create returned no entry");
      setEntries((prev) => [data.entry as ApiKbEntry, ...prev]);
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave(form: EntryFormState) {
    if (!editingEntry) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reply-kit/knowledge-base/${editingEntry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, content: form.content, category: form.category }),
      });
      // Same as templates: a rejected save still looked applied.
      if (!res.ok) throw new Error("save failed");
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingEntry.id
            ? { ...e, title: form.title, content: form.content, category: form.category }
            : e,
        ),
      );
      setEditingEntry(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-fg-1">Knowledge base</h2>
          <p className="mt-1 text-sm text-fg-3">
            Add context about your product so AI replies are accurate and specific.
          </p>
        </div>
        <Button
          size="sm"
          className="shrink-0 bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)]"
          onClick={() => { setEditingEntry(null); setShowAdd((v) => !v); }}
        >
          <Plus strokeWidth={1.5} className="size-4" />
          Add entry
        </Button>
      </div>

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--rb-blue-500)]/20 bg-[var(--rb-blue-500)]/5 p-4 text-sm text-[var(--rb-blue-500)]">
        <Info strokeWidth={1.5} className="mt-0.5 size-4 shrink-0" />
        <span>
          Matched KB entries are injected into AI replies when the review topic overlaps. Keep entries factual and concise.
        </span>
      </div>

      {/* Create form */}
      {showAdd && (
        <EntryForm
          initial={EMPTY_ENTRY_FORM}
          saving={submitting}
          submitLabel="Save entry"
          onSubmit={handleCreate}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Edit form */}
      {editingEntry && (
        <EntryForm
          initial={{ title: editingEntry.title, content: editingEntry.content, category: editingEntry.category }}
          saving={submitting}
          submitLabel="Save changes"
          onSubmit={handleEditSave}
          onCancel={() => setEditingEntry(null)}
        />
      )}

      {/* Entries */}
      <div className="space-y-3">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]"
              />
            ))}
          </>
        ) : entries.length > 0 ? (
          entries.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} />
          ))
        ) : (
          <p className="py-8 text-center text-sm text-fg-3">
            No entries yet. Add your first one above.
          </p>
        )}
      </div>
    </div>
  );
}
