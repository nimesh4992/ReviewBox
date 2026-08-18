/**
 * Vertical rhythm for marketing sections.
 *
 * ── Why this is its own file, and must stay that way ─────────────────────────
 *
 * This lived in `components/primitives.tsx`, which carries `"use client"`.
 * Next.js turns every export of a client module into a client *reference* at
 * the server boundary, so a Server Component importing `RHYTHM` from there got
 * a proxy, not the object — and `RHYTHM.md` evaluated to `undefined`.
 *
 * It failed silently. `<Section className={undefined}>` is valid, so the class
 * was simply absent: all nine server-rendered marketing pages shipped with no
 * section padding at all, while the landing page (a Client Component, so no
 * boundary to cross) rendered correctly. The rendered HTML told the story —
 * one `py-16 sm:py-24` per server page, from the one section that happens to
 * live inside the client module, versus every section on the homepage.
 *
 * The rule this encodes: a plain value shared between Server and Client
 * Components must not be exported from a `"use client"` module. Keep constants
 * like this in a module with no directive, and let both sides import it.
 *
 * Three steps only. Sections are `md`; the first section under a hero is `sm`;
 * a closing band is `lg`. Hand-picked `mt-20`s scattered through a page are
 * what produced the flat, evenly-spaced, generated feel this replaces.
 */
export const RHYTHM = {
  sm: "py-14 sm:py-16",
  md: "py-16 sm:py-24",
  lg: "py-20 sm:py-28",
} as const;

export type RhythmStep = keyof typeof RHYTHM;
