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

// Precompute a global index map so row numbers are stable across categories
const TAG_INDEX_MAP = new Map(mockTags.map((t, i) => [t.id, i + 1]));

export function TagsTab() {
  const grouped = groupByCategory(mockTags);

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Tags</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-gray-500">
            <Upload strokeWidth={1.5} className="size-4" />
            Import
          </Button>
          <Button
            size="sm"
            className="bg-[#5B5BD6] text-white hover:bg-[#4f4fbf]"
          >
            <Plus strokeWidth={1.5} className="size-4" />
            Add tag
          </Button>
        </div>
      </div>

      {/* AI Banner */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-[#5B5BD6] p-4 text-white">
        <div className="flex items-start gap-3">
          <Sparkles strokeWidth={1.5} className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Smarter tags, powered by AI</p>
            <p className="mt-0.5 text-xs text-white/75">
              Semantic analysis automatically categorizes and auto-tags user feedback.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-4 shrink-0 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          Try Semantic analysis
        </Button>
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {/* Table header */}
        <div className="grid grid-cols-[2rem_1fr_8rem] gap-3 border-b border-gray-100 px-4 py-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">#</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Name</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Category</span>
        </div>

        {CATEGORY_ORDER.map((category) => {
          const tags = grouped[category];
          if (!tags.length) return null;
          return (
            <div key={category}>
              {/* Category sub-header */}
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {CATEGORY_LABEL[category]}
                </span>
              </div>
              {tags.map((tag) => {
                const rowNum = TAG_INDEX_MAP.get(tag.id) ?? 0;
                return (
                  <div
                    key={tag.id}
                    className="grid grid-cols-[2rem_1fr_8rem] items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0"
                  >
                    <span className="text-xs text-gray-400">{rowNum}</span>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-gray-800">{tag.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{CATEGORY_LABEL[tag.category]}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
