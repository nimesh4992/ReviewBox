"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { mockAIStyles } from "../data/mock-reply-kit";
import type { AIReplyStyle } from "@/types/review";

function StyleCard({
  style,
  isActive,
  onSelect,
}: {
  style: AIReplyStyle;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "cursor-pointer rounded-2xl border-2 p-5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-blue-500)]/40",
        isActive
          ? "border-[var(--rb-blue-500)] bg-[var(--rb-blue-500)]/5"
          : "border-[var(--rb-border-1)] bg-surface hover:border-[var(--rb-border-3)]"
      )}
    >
      {/* Top row */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-fg-1">{style.name}</span>
        {isActive && (
          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-[var(--rb-blue-500)]">
            <Check className="size-3 text-white" />
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-1 text-xs text-fg-3">{style.description}</p>

      {/* Example box */}
      <div className="mt-4 rounded-xl bg-[var(--rb-bg-sunken)] p-3 space-y-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-3">
            Input:
          </span>
          <p className="mt-0.5 text-xs italic text-fg-3">{style.exampleInput}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-3">
            Reply:
          </span>
          <p className="mt-0.5 text-xs text-fg-2">{style.exampleOutput}</p>
        </div>
      </div>
    </div>
  );
}

export function AIStylesTab() {
  const [selectedId, setSelectedId] = useState("professional");
  const [saved, setSaved] = useState(false);

  // Load persisted default tone on mount
  useEffect(() => {
    fetch("/api/settings/workspace")
      .then((r) => r.json())
      .then((d: { defaultTone?: string }) => {
        if (d.defaultTone) setSelectedId(d.defaultTone);
      })
      .catch(() => undefined); // silently fall back to default
  }, []);

  async function handleSelect(id: string) {
    setSelectedId(id);
    try {
      await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultTone: id }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // optimistic update already applied — silent fail is acceptable
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg-1">AI Reply styles</h2>
          <p className="mt-1 text-sm text-fg-3">
            Choose the tone ReviewBox uses when generating AI replies.
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--rb-green-500)]/10 px-3 py-1 text-xs font-medium text-[var(--rb-green-500)]">
            <Check className="size-3" />
            Saved
          </span>
        )}
      </div>

      {/* Style cards grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mockAIStyles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            isActive={selectedId === style.id}
            onSelect={() => handleSelect(style.id)}
          />
        ))}
      </div>
    </div>
  );
}
