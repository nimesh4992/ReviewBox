import { Sparkles } from "lucide-react";
import type { ReviewIssueTag, TagCategory } from "@/types/review";

const CATEGORY_LABEL: Record<TagCategory, string> = {
  bugs: "Bugs",
  user_feedback: "User Feedback",
  monetization: "Monetization",
};

const CATEGORY_ORDER: TagCategory[] = ["bugs", "user_feedback", "monetization"];

/**
 * The REAL tag vocabulary — the eight ReviewIssueTags the zero-cost rules
 * engine (src/lib/rules-engine.ts) applies to every synced review. This list
 * previously showed 18 invented tags from mock data; now it shows exactly
 * what the product does. Custom user-defined tags are a future feature — the
 * "Add tag" / "Import" buttons that pretended otherwise are gone.
 */
const TAG_VOCABULARY: { tag: ReviewIssueTag; label: string; color: string; category: TagCategory }[] = [
  { tag: "crash",              label: "Crash",              color: "#ef4444", category: "bugs" },
  { tag: "performance",        label: "Performance",        color: "#ef4444", category: "bugs" },
  { tag: "release-regression", label: "Release regression", color: "#ef4444", category: "bugs" },
  { tag: "login",              label: "Login issues",       color: "#ef4444", category: "bugs" },
  { tag: "feature-request",    label: "Feature request",    color: "#6366f1", category: "user_feedback" },
  { tag: "support-delay",      label: "Support delay",      color: "#6366f1", category: "user_feedback" },
  { tag: "localization",       label: "Localization",       color: "#6366f1", category: "user_feedback" },
  { tag: "billing",            label: "Billing",            color: "#f59e0b", category: "monetization" },
];

export function TagsTab() {
  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-rb-lg font-semibold text-fg-1">Tags</h2>
        <p className="mt-1 text-rb-sm text-fg-3">
          Every synced review is auto-tagged against this vocabulary. Filter the inbox by any of
          them.
        </p>
      </div>

      {/* Table */}
      <div className="w-full overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
        {CATEGORY_ORDER.map((category) => {
          const tags = TAG_VOCABULARY.filter((t) => t.category === category);
          if (!tags.length) return null;
          return (
            <div key={category}>
              <div className="flex items-baseline gap-2 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-1.5">
                <span className="text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">
                  {CATEGORY_LABEL[category]}
                </span>
                <span className="text-rb-xs tabular-nums text-fg-4">{tags.length}</span>
              </div>
              {tags.map((t) => (
                <div
                  key={t.tag}
                  className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-4 py-2 last:border-b-0 hover:bg-[var(--rb-bg-hover)]"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="text-rb-base text-fg-1">{t.label}</span>
                  <span className="ml-auto font-mono text-rb-xs text-fg-4">{t.tag}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Honest capability note — the rules engine really does this, at zero AI cost */}
      <p className="mt-3 flex items-center gap-1.5 text-rb-sm text-fg-3">
        <Sparkles strokeWidth={1.5} className="size-3.5" />
        Tagging runs automatically on every sync — no setup, no AI cost. Custom tags are on the
        roadmap.
      </p>
    </div>
  );
}
