"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "revi_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (SSR guard, private browsing restrictions)
    }
  }, []);

  function accept(value: "accepted" | "essential") {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // fail silently
    }
    setVisible(false);
  }

  if (!visible) return null;

  // Tokens, not hardcoded colors: the old banner was a fixed dark slab with an
  // indigo accent no matter the page theme. This one follows the surrounding
  // theme and uses the one interactive accent the design system allows.
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rb-border-2)] bg-surface shadow-[var(--rb-shadow-lg)]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-[13px] leading-relaxed text-fg-2">
          We use cookies for authentication and analytics. See our{" "}
          <Link
            href="/privacy"
            className="text-[var(--rb-blue-500)] underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => accept("essential")}
            className="rounded-lg border border-[var(--rb-border-2)] bg-transparent px-3.5 py-1.5 text-[13px] text-fg-2 transition-colors hover:bg-[var(--rb-bg-hover)] hover:text-fg-1"
          >
            Essential only
          </button>
          <button
            onClick={() => accept("accepted")}
            className="rounded-lg bg-[var(--rb-blue-500)] px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--rb-blue-600)]"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
