"use client";

import { useState } from "react";
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
        "cursor-pointer rounded-2xl border-2 p-5 transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#5B5BD6]/40",
        isActive
          ? "border-[#5B5BD6] bg-[#5B5BD6]/5"
          : "border-gray-200 bg-white hover:border-gray-300"
      )}
    >
      {/* Top row */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{style.name}</span>
        {style.isDefault && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            Default
          </span>
        )}
        {isActive && (
          <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-[#5B5BD6]">
            <Check strokeWidth={2.5} className="size-3 text-white" />
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mt-1 text-xs text-gray-400">{style.description}</p>

      {/* Example box */}
      <div className="mt-4 rounded-xl bg-gray-50 p-3 space-y-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Input:
          </span>
          <p className="mt-0.5 text-xs italic text-gray-400">{style.exampleInput}</p>
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Reply:
          </span>
          <p className="mt-0.5 text-xs text-gray-700">{style.exampleOutput}</p>
        </div>
      </div>
    </div>
  );
}

export function AIStylesTab() {
  const [selectedId, setSelectedId] = useState("professional");

  return (
    <div>
      {/* Header */}
      <div className="mb-1">
        <h2 className="text-base font-semibold text-gray-900">AI Reply styles</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose the tone Revi uses when generating AI replies.
        </p>
      </div>

      {/* Style cards grid */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mockAIStyles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            isActive={selectedId === style.id}
            onSelect={() => setSelectedId(style.id)}
          />
        ))}
      </div>
    </div>
  );
}
