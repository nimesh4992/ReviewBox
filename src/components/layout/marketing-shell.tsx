import React from "react";

/**
 * Wrapper for every marketing page.
 *
 * LIGHT-ONLY. This used to own a light/dark context plus a `localStorage`
 * preference read by a Sun/Moon toggle in the nav. Both are gone: the
 * SassTech-derived design is a single committed visual world — a pastel mesh
 * hero, gold CTAs, deep-indigo ink — and there is no dark counterpart tuned
 * for it. Leaving the toggle in place would have rendered a design nobody
 * designed, on all 17 marketing pages.
 *
 * Consequences worth knowing before adding anything here:
 *   - No `dark:` variants on marketing sections. Nothing sets the `dark`
 *     class on this subtree any more, so they are dead code that reads as
 *     live intent.
 *   - The `.rb-marketing` class is load-bearing: `globals.css` hangs the
 *     entire --rb-mk-* palette off it, including the --rb-fg-* remap that
 *     re-inks the marketing pages without touching the app's own ramp.
 *   - `data-theme="light"` is set explicitly rather than left to inherit,
 *     so a visitor whose OS is dark still gets the light token values even
 *     if a future `prefers-color-scheme` rule lands in globals.css.
 *
 * This is not a server/client boundary any more — with the context gone
 * there is no state, so it renders on the server.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="light"
      className="rb-marketing min-h-screen bg-[var(--rb-mk-ground)] text-[var(--rb-fg-1)] antialiased [font-family:var(--rb-font-text)]"
    >
      {children}
    </div>
  );
}
