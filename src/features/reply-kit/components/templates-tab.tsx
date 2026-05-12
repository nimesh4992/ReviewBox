"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
      {tag}
    </span>
  );
}

function TemplateCard({
  template,
  onDelete,
}: {
  template: ApiTemplate;
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

interface NewTemplateForm {
  name: string;
  content: string;
  language: string;
}

const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian", "Japanese"];

export function TemplatesTab() {
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewTemplateForm>({ name: "", content: "", language: "English" });
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reply-kit/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          content: form.content,
          tags: [],
          ratingMin: 1,
          ratingMax: 5,
          language: form.language,
        }),
      });
      const data = (await res.json()) as { template: ApiTemplate };
      setTemplates((prev) => [data.template, ...prev]);
      setForm({ name: "", content: "", language: "English" });
      setShowForm(false);
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
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus strokeWidth={1.5} className="size-4" />
          New template
        </Button>
      </div>

      {/* Inline new-template form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded-2xl border border-[#5B5BD6]/30 bg-[#5B5BD6]/5 p-5 space-y-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Template name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Thank you — 5 star"
              required
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Write your reply template…"
              required
              rows={4}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30 resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Language</label>
            <select
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-[#5B5BD6] focus:ring-1 focus:ring-[#5B5BD6]/30"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-[#5B5BD6] text-white hover:bg-[#4f4fbf] disabled:opacity-50"
            >
              {submitting ? "Saving…" : "Save template"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="text-gray-500"
            >
              Cancel
            </Button>
          </div>
        </form>
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
            <TemplateCard key={template.id} template={template} onDelete={handleDelete} />
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
