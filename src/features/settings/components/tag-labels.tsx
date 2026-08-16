"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, RotateCcw, Tags } from "lucide-react";

import { Input } from "@/components/ui/input";
import { useTagLabels, type TagDefinition } from "@/hooks/use-tag-labels";
import { MAX_TAG_LABEL_LENGTH } from "@/lib/tag-labels";
import { apiErrorMessage } from "@/lib/api-error-message";

/**
 * Rename the issue tags for this workspace.
 *
 * Only the display name changes. "billing" stays "billing" in the database, so
 * automation rules that match on it keep working and historical reviews keep
 * their tags — renaming the token instead would break every rule referencing it
 * with no way back.
 */
function TagRow({ definition }: { definition: TagDefinition }) {
  const qc = useQueryClient();
  const [value, setValue]   = useState(definition.label);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const dirty = value.trim() !== definition.label;

  async function submit(label: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: definition.tag, label }),
      });
      if (!res.ok) {
        setError(apiErrorMessage(await res.json().catch(() => null), "Could not rename this tag."));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["tag-labels"] });
      void qc.invalidateQueries({ queryKey: ["reviews"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Could not rename this tag. Check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2">
      <code className="w-[150px] shrink-0 truncate text-[11px] text-fg-3">{definition.tag}</code>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Input
          value={value}
          maxLength={MAX_TAG_LABEL_LENGTH}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onBlur={() => { if (dirty) void submit(value); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
          aria-label={`Display name for ${definition.tag}`}
          className="h-8 text-[13px]"
        />

        {saving && <Loader2 className="size-3.5 shrink-0 animate-spin text-fg-3" />}
        {!saving && saved && <Check className="size-3.5 shrink-0 text-[var(--rb-green-500)]" strokeWidth={2.5} />}

        {/* Only offered once there is something to undo. There is no other way
            back to the default, since the original name is not shown once
            replaced. */}
        {!saving && definition.customized && (
          <button
            type="button"
            title="Reset to the default name"
            aria-label={`Reset ${definition.tag} to its default name`}
            onClick={() => { setValue(definition.tag.replace(/-/g, " ")); void submit(""); }}
            className="shrink-0 rounded-md p-1 text-fg-3 transition-colors hover:bg-[var(--rb-bg-hover)] hover:text-fg-1"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {error && <p className="shrink-0 text-[11px] text-[var(--rb-red-500)]">{error}</p>}
    </div>
  );
}

export function TagLabelSettings() {
  const { definitions, isLoading } = useTagLabels();

  return (
    <section className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4">
      <div className="mb-1 flex items-center gap-2">
        <Tags className="size-4 text-fg-3" strokeWidth={1.5} />
        <h2 className="text-[14px] font-semibold text-fg-1">Tag names</h2>
      </div>
      <p className="mb-3 text-[12px] text-fg-3">
        Rename the tags ReviewBox puts on reviews so they match the words your team uses.
        This changes what you see everywhere — the inbox, filters and digest emails.
        Automation rules keep working, because only the display name changes.
      </p>

      {isLoading ? (
        <p className="py-2 text-[12px] text-fg-3">Loading…</p>
      ) : (
        <div className="divide-y divide-[var(--rb-border-1)]">
          {definitions.map((d) => (
            <TagRow key={d.tag} definition={d} />
          ))}
        </div>
      )}
    </section>
  );
}
