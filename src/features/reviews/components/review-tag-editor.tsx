"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { ISSUE_TAGS, tagLabel } from "@/lib/tag-labels";
import { useTagLabels } from "@/hooks/use-tag-labels";
import { apiErrorMessage } from "@/lib/api-error-message";

/**
 * Tags on a review, editable in place.
 *
 * The vocabulary is fixed, so this is a set of toggles rather than a free-text
 * field: a typed tag would not match any automation rule or filter, which makes
 * it worse than no tag at all. Renaming lives in Settings because a name is a
 * property of the workspace, not of one review.
 *
 * Saves the whole set on close rather than per-toggle. Fixing three wrong tags
 * is one correction in the user's head; three PATCHes and three chances for a
 * half-applied state is not.
 */
export function ReviewTagEditor({
  reviewId,
  tags,
  autoTags,
  edited,
  onSaved,
}: {
  reviewId: string;
  tags: string[];
  /** What the rules engine assigned, for the reset affordance. */
  autoTags?: string[];
  edited?: boolean;
  onSaved?: (tags: string[]) => void;
}) {
  const qc = useQueryClient();
  const { labels } = useTagLabels();

  const [open, setOpen]         = useState(false);
  const [draft, setDraft]       = useState<string[]>(tags);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const containerRef            = useRef<HTMLDivElement>(null);

  // A different review in the same pane must not inherit the last one's draft.
  useEffect(() => {
    setDraft(tags);
    setOpen(false);
    setError(null);
  }, [reviewId, tags]);

  // Close on an outside click or Escape. Without this the panel stays open
  // behind whatever the user does next and the edit silently never saves.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) void commit();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDraft(tags); setOpen(false); }
      if (e.key === "Enter")  void commit();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit closes over draft, which is the point
  }, [open, draft, tags]);

  const changed =
    draft.length !== tags.length || draft.some((t) => !tags.includes(t));

  async function save(next: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) {
        setError(apiErrorMessage(await res.json().catch(() => null), "Could not save these tags."));
        return false;
      }
      const data = (await res.json()) as { tags: string[] };
      onSaved?.(data.tags);
      // The list behind the pane shows the same tags.
      void qc.invalidateQueries({ queryKey: ["reviews"] });
      return true;
    } catch {
      setError("Could not save. Check your connection and try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function commit() {
    if (!changed) { setOpen(false); return; }
    if (await save(draft)) setOpen(false);
  }

  function toggle(tag: string) {
    setDraft((d) => (d.includes(tag) ? d.filter((t) => t !== tag) : [...d, tag]));
  }

  async function resetToAuto() {
    if (!autoTags) return;
    setDraft(autoTags);
    if (await save(autoTags)) setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative inline-flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Edit tags"
          className="inline-flex items-center rounded-full bg-[var(--rb-bg-accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rb-blue-500)] transition-opacity hover:opacity-80"
        >
          {tagLabel(tag, labels)}
        </button>
      ))}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={tags.length ? "Edit tags" : "Add a tag"}
        aria-label={tags.length ? "Edit tags" : "Add a tag"}
        className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[var(--rb-border-3)] px-2 py-0.5 text-[11px] font-semibold text-[var(--rb-fg-3)] transition-colors hover:border-[var(--rb-blue-500)] hover:text-[var(--rb-blue-500)]"
      >
        {saving ? <Loader2 className="size-2.5 animate-spin" /> : <Plus className="size-2.5" strokeWidth={2.5} />}
        {tags.length ? "Edit" : "Add tag"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-[248px] rounded-xl border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] p-2 shadow-lg">
          <p className="px-1.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-fg-3)]">
            Tags on this review
          </p>

          <div className="max-h-[220px] overflow-y-auto">
            {ISSUE_TAGS.map((tag) => {
              const on = draft.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-[12px] transition-colors",
                    on ? "text-[var(--rb-fg-1)]" : "text-[var(--rb-fg-2)]",
                    "hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-[var(--rb-blue-500)] bg-[var(--rb-blue-500)] text-white"
                        : "border-[var(--rb-border-3)]",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {tagLabel(tag, labels)}
                </button>
              );
            })}
          </div>

          {error && <p className="px-1.5 pt-1.5 text-[11px] text-[var(--rb-red-500)]">{error}</p>}

          <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-[var(--rb-border-1)] pt-1.5">
            {edited && autoTags ? (
              <button
                type="button"
                onClick={resetToAuto}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-1)]"
              >
                <RotateCcw className="size-3" strokeWidth={1.75} />
                Reset
              </button>
            ) : (
              <span className="px-1.5 text-[10px] text-[var(--rb-fg-3)]">Rename tags in Settings</span>
            )}

            <button
              type="button"
              onClick={() => void commit()}
              disabled={saving}
              className="rounded-md bg-[var(--rb-blue-500)] px-2.5 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : changed ? "Save" : "Done"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
