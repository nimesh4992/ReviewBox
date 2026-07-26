import { Sparkles, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mockTags } from "../data/mock-reply-kit";
import type { TagCategory, TagDefinition } from "@/types/review";

const CATEGORY_LABEL: Record<TagCategory, string> = {
  bugs: "Bugs",
  user_feedback: "User Feedback",
  monetization: "Monetization",
};

const CATEGORY_ORDER: TagCategory[] = ["bugs", "user_feedback", "monetization"];

function groupByCategory(tags: TagDefinition[]): Record<TagCategory, TagDefinition[]> {
  return {
    bugs: tags.filter((t) => t.category === "bugs"),
    user_feedback: tags.filter((t) => t.category === "user_feedback"),
    monetization: tags.filter((t) => t.category === "monetization"),
  };
}

/**
 * Tags list.
 *
 * Deliberate removals from the previous version, both redundancy:
 * - the "#" row-number column — numbers carried no meaning and no ordering
 *   control, they just made the table look machine-generated;
 * - the per-row "Category" column — rows are already grouped under category
 *   headers, so every row restated what the header above it said.
 *
 * The solid-indigo "Smarter tags, powered by AI" banner became a one-line
 * muted hint. A promo panel inside a settings table is noise; the capability
 * is still discoverable, it just no longer shouts over the content.
 */
export function TagsTab() {
  const grouped = groupByCategory(mockTags);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-rb-lg font-semibold text-fg-1">Tags</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-fg-3">
            <Upload strokeWidth={1.5} className="size-4" />
            Import
          </Button>
          <Button size="sm">
            <Plus strokeWidth={1.5} className="size-4" />
            Add tag
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
        {CATEGORY_ORDER.map((category) => {
          const tags = grouped[category];
          if (!tags.length) return null;
          return (
            <div key={category}>
              <div className="flex items-baseline gap-2 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-1.5">
                <span className="text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">
                  {CATEGORY_LABEL[category]}
                </span>
                <span className="text-rb-xs tabular-nums text-fg-4">{tags.length}</span>
              </div>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-4 py-2 last:border-b-0 hover:bg-[var(--rb-bg-hover)]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-rb-base text-fg-1">{tag.name}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* AI hint — quiet, not a banner */}
      <p className="mt-3 flex items-center gap-1.5 text-rb-sm text-fg-3">
        <Sparkles strokeWidth={1.5} className="size-3.5" />
        Semantic analysis can auto-tag incoming reviews against this list.
        <button type="button" className="font-medium text-[var(--rb-blue-500)] hover:underline">
          Try it
        </button>
      </p>
    </div>
  );
}
