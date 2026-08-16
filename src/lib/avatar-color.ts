/**
 * Picking a reviewer avatar's colour.
 *
 * The inbox used to render one flat tile per row with the platform's letter in
 * it, so twenty rows looked like twenty copies of the same thing. Tinting each
 * avatar by the reviewer's name gives the list texture and makes a returning
 * reviewer recognisable at a glance.
 *
 * "Random" here means *varied*, not *unpredictable*: the colour is a pure
 * function of the name. Math.random() would repaint every avatar on each
 * render and change the same person's colour between the list and the detail
 * pane — which reads as a rendering bug, not as personality.
 *
 * The palette lives in globals.css as --rb-avatar-1..8 (D-tokens, not raw hex)
 * and is chosen for white text at >= 4.5:1.
 */

/** Number of colours in the --rb-avatar-* palette. */
export const AVATAR_COLOR_COUNT = 8;

/**
 * Stable 1-based palette index for a name.
 *
 * FNV-1a, because it spreads short similar strings ("Ravi" / "Ravindra") into
 * different buckets far better than summing char codes, which clusters them.
 * An empty or whitespace-only name always lands on bucket 1 rather than
 * throwing — Google Play returns blank authors.
 */
export function avatarColorIndex(seed: string): number {
  const key = (seed ?? "").trim().toLowerCase();
  if (!key) return 1;

  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    // FNV prime, via shifts so it stays inside 32-bit int math.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return (hash % AVATAR_COLOR_COUNT) + 1;
}

/** CSS custom property holding this name's avatar colour. */
export function avatarColorVar(seed: string): string {
  return `var(--rb-avatar-${avatarColorIndex(seed)})`;
}
