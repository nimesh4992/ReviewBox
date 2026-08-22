/**
 * "What changed" — per-tag complaint movement between this release and the one
 * before it. The reasoning behind every number is in `@/lib/release-regression`;
 * this file only decides how to say it.
 *
 * Two display rules carry product weight:
 *
 *  - A movement the engine is not confident in is shown, greyed, and labelled
 *    "too few to judge". Hiding it would be a quieter lie than showing it.
 *  - When the comparison cannot be made at all, the card says why in a sentence
 *    a non-technical founder can act on — never an empty state that reads as
 *    "nothing is wrong".
 */

import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { tagLabel, type TagLabelMap } from "@/lib/tag-labels";
import type { MovementSeverity, ReleaseComparison, TagMovement } from "@/lib/release-regression";

const SEVERITY_STYLE: Record<MovementSeverity, { row: string; chip: string; label: string }> = {
  critical: {
    row: "border-l-2 border-l-[var(--rb-red-500)]",
    chip: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)]",
    label: "Regression",
  },
  elevated: {
    row: "border-l-2 border-l-[var(--rb-amber-500)]",
    chip: "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)]",
    label: "Watch",
  },
  stable: { row: "border-l-2 border-l-transparent", chip: "bg-[var(--rb-bg-sunken)] text-fg-3", label: "Steady" },
  improved: {
    row: "border-l-2 border-l-[var(--rb-green-500)]",
    chip: "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)]",
    label: "Improved",
  },
  "low-n": { row: "border-l-2 border-l-transparent", chip: "bg-[var(--rb-bg-sunken)] text-fg-3", label: "Too few to judge" },
};

function changeText(m: TagMovement): string {
  if (m.direction === "new") return "New in this release";
  if (m.direction === "gone") return "No longer reported";
  if (m.changePct === null) return "—";
  return `${m.changePct > 0 ? "+" : ""}${m.changePct}%`;
}

function ChangeIcon({ m }: { m: TagMovement }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (m.direction === "new") return <Sparkles className={cls} aria-hidden />;
  if (m.direction === "up") return <ArrowUpRight className={cls} aria-hidden />;
  if (m.direction === "down" || m.direction === "gone") return <ArrowDownRight className={cls} aria-hidden />;
  return <Minus className={cls} aria-hidden />;
}

interface Props {
  comparison: ReleaseComparison;
  labels?: TagLabelMap;
  /** True when the underlying query hit its row cap — disclosed, never hidden. */
  truncated?: boolean;
}

export function ReleaseRegressionCard({ comparison, labels, truncated }: Props) {
  const { comparable, reason, previousVersion, reviewCount, previousReviewCount, movements, regressions } =
    comparison;

  return (
    <section className="rounded-xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
        <h2 className="text-sm font-semibold text-fg-1">
          What changed{previousVersion ? ` vs ${previousVersion}` : ""}
        </h2>
        {comparable && (
          <p className="text-xs text-fg-3">
            {reviewCount} reviews now · {previousReviewCount} in {previousVersion}
          </p>
        )}
      </header>

      {!comparable ? (
        <p className="px-5 py-6 text-sm text-fg-2">
          {reason === "no_previous_version"
            ? "This is the earliest release we have reviews for, so there is nothing to compare it against yet. The next release will show what changed."
            : `Not enough reviews to compare yet — a release needs at least 10 on each side before a percentage means anything. ${previousVersion ? `${previousVersion} has ${previousReviewCount}; this one has ${reviewCount}.` : ""}`}
        </p>
      ) : (
        <>
          {regressions.length > 0 && (
            <div className="flex items-start gap-2 border-b border-[var(--rb-border-1)] bg-[var(--rb-red-500)]/5 px-5 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rb-red-500)]" aria-hidden />
              <p className="text-sm text-fg-1">
                <span className="font-medium">Probable regression:</span>{" "}
                {regressions.map((m) => tagLabel(m.tag, labels)).join(", ")} — complaints grew faster than
                review volume in this release.
              </p>
            </div>
          )}

          <ul className="divide-y divide-[var(--rb-border-1)]">
            {movements.map((m) => {
              const style = SEVERITY_STYLE[m.severity];
              const muted = m.severity === "low-n";
              return (
                <li key={m.tag} className={cn("flex items-center gap-3 px-5 py-3", style.row)}>
                  <span className={cn("min-w-0 flex-1 truncate text-sm", muted ? "text-fg-3" : "text-fg-1")}>
                    {tagLabel(m.tag, labels)}
                  </span>

                  <span
                    className={cn(
                      "flex items-center gap-1 text-sm tabular-nums",
                      muted ? "text-fg-3" : "text-fg-1",
                    )}
                  >
                    <ChangeIcon m={m} />
                    {changeText(m)}
                  </span>

                  <span className="hidden w-40 text-right text-xs tabular-nums text-fg-3 sm:block">
                    {m.previousRate} → {m.currentRate} per 100
                  </span>

                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", style.chip)}>
                    {style.label}
                  </span>
                </li>
              );
            })}
          </ul>

          <footer className="border-t border-[var(--rb-border-1)] px-5 py-3 text-xs text-fg-3">
            Complaints are compared per 100 reviews, so a release that simply got more reviews is not
            reported as worse.
            {truncated ? " Based on this app's most recent 5,000 reviews." : ""}
          </footer>
        </>
      )}
    </section>
  );
}
