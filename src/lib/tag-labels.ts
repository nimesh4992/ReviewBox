/**
 * Issue tags: what they are called, and which ones a review actually has.
 *
 * The vocabulary is fixed (`ReviewIssueTag`) because the rules engine, the
 * automation conditions and every stored row all match on the token. What a
 * workspace *calls* a token is theirs to decide, and which tokens sit on a
 * given review is theirs to correct. Neither of those changes the vocabulary.
 */

import { humanizeToken } from "@/utils/format";
import type { ReviewIssueTag } from "@/types/review";

/** The full vocabulary, in the order it should be offered in a picker. */
export const ISSUE_TAGS: readonly ReviewIssueTag[] = [
  "crash",
  "performance",
  "login",
  "billing",
  "release-regression",
  "support-delay",
  "feature-request",
  "localization",
] as const;

const TAG_SET: ReadonlySet<string> = new Set(ISSUE_TAGS);

export type TagLabelMap = Readonly<Record<string, string>>;

export const MAX_TAG_LABEL_LENGTH = 32;

/** Is this a tag we know how to store? */
export function isIssueTag(value: unknown): value is ReviewIssueTag {
  return typeof value === "string" && TAG_SET.has(value);
}

/**
 * Display name for one tag: the workspace's own name if they set one, else the
 * default derived from the token.
 */
export function tagLabel(tag: string, labels?: TagLabelMap | null): string {
  const custom = labels?.[tag];
  if (typeof custom === "string" && custom.trim().length > 0) return custom.trim();
  return humanizeToken(tag);
}

/**
 * The tags to show for a review.
 *
 * A null override means nobody has touched this review, so the engine's answer
 * stands. An EMPTY override is a person saying "none of these apply" and must
 * be honoured — collapsing it back to the engine's tags would silently undo
 * their correction every time they looked away.
 */
export function effectiveTags(
  autoTags: readonly string[] | null | undefined,
  override: readonly string[] | null | undefined,
): string[] {
  if (override != null) return [...override];
  return [...(autoTags ?? [])];
}

/**
 * Clean a client-supplied tag list before it is stored.
 *
 * Unknown tokens are dropped rather than rejected: the picker can only offer
 * valid ones, so an unknown value means a stale client, and silently ignoring
 * it is kinder than failing the whole edit. Order follows ISSUE_TAGS so two
 * reviews with the same tags always render them the same way.
 */
export function normalizeTagSelection(input: unknown): ReviewIssueTag[] {
  if (!Array.isArray(input)) return [];
  const chosen = new Set(input.filter(isIssueTag));
  return ISSUE_TAGS.filter((t) => chosen.has(t));
}

/**
 * Validate a custom label. Returns the trimmed label, or an error string.
 *
 * An empty label is not an error — it means "go back to the default" and the
 * caller deletes the row. That is the only way to undo a rename without
 * guessing what the original was.
 */
export function validateTagLabel(raw: unknown): { label: string | null } | { error: string } {
  if (typeof raw !== "string") return { error: "Label must be text." };

  const label = raw.trim().replace(/\s+/g, " ");
  if (label.length === 0) return { label: null };
  if (label.length > MAX_TAG_LABEL_LENGTH) {
    return { error: `Label must be ${MAX_TAG_LABEL_LENGTH} characters or fewer.` };
  }
  // Tags render inline in HTML email digests as well as the app. Refusing
  // angle brackets here is cheaper than trusting every future render site to
  // escape them.
  if (/[<>]/.test(label)) return { error: "Label cannot contain < or >." };

  return { label };
}
