"use client";

import { useQuery } from "@tanstack/react-query";
import type { TagLabelMap } from "@/lib/tag-labels";
import { ISSUE_TAGS } from "@/lib/tag-labels";

export interface TagDefinition {
  tag: string;
  label: string;
  customized: boolean;
}

/**
 * The workspace's names for the issue-tag vocabulary.
 *
 * Cached for the session: names change roughly never, and every review card
 * needs them, so refetching per render would be pure waste. A failure resolves
 * to the defaults rather than an error state — a tag rendered under its default
 * name is fine, a tag rendered as nothing is not. **That fallback is the
 * deliberate design and is kept**; this hook is the one place in AU5's sweep
 * where rendering an error would be worse than degrading.
 *
 * What was wrong is narrower. `res.json()` resolves on a 500 (the routes answer
 * with a JSON error envelope), so the query never entered its error state — and
 * `retry: 1` below, sitting there looking like resilience, could never fire.
 * Throwing makes the retry real. The default-name fallback is unchanged,
 * because `query.data` is undefined on a genuine error either way.
 */
export function useTagLabels() {
  const query = useQuery<{ tags: TagDefinition[] }>({
    queryKey: ["tag-labels"],
    queryFn: async () => {
      const r = await fetch("/api/tags");
      if (!r.ok) throw new Error(`tag labels load failed: ${r.status}`);
      return r.json();
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const definitions: TagDefinition[] =
    query.data?.tags?.length
      ? query.data.tags
      : ISSUE_TAGS.map((tag) => ({ tag, label: tag.replace(/-/g, " "), customized: false }));

  const labels: TagLabelMap = Object.fromEntries(definitions.map((d) => [d.tag, d.label]));

  return { definitions, labels, isLoading: query.isLoading };
}
