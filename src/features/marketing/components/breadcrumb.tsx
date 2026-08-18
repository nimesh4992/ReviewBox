import React from "react";
import Link from "next/link";

/**
 * The trail under a page hero.
 *
 * Every marketing page had its own copy of this, each with raw `text-gray-400`
 * / `hover:text-gray-600` and a bare `<span>/</span>` separator that screen
 * readers announced as content. This is one implementation, on tokens, with
 * the separators hidden from the accessibility tree and the current page
 * marked `aria-current`.
 */
export function Breadcrumb({
  trail,
}: {
  /** Ordered, excluding Home — that is always prepended. The last entry is the current page and needs no href. */
  trail: { label: string; href?: string }[];
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto w-full max-w-[1160px] px-5 pt-6 sm:px-6"
    >
      <ol className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--rb-fg-3)]">
        <li>
          <Link href="/" className="transition-colors hover:text-[var(--rb-fg-1)]">
            Home
          </Link>
        </li>
        {trail.map((item, i) => {
          const last = i === trail.length - 1;
          return (
            <React.Fragment key={item.label}>
              <li aria-hidden="true" className="text-[var(--rb-mk-ink-4)]">
                /
              </li>
              <li>
                {last || !item.href ? (
                  <span aria-current="page" className="text-[var(--rb-fg-1)]">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="transition-colors hover:text-[var(--rb-fg-1)]"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
