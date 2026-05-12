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

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#1a1d27]">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-sm text-white/60 leading-relaxed">
          We use cookies for authentication and analytics. See our{" "}
          <Link
            href="/privacy"
            className="text-[#5B5BD6] underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => accept("essential")}
            className="rounded-lg border border-white/[0.12] bg-transparent px-3.5 py-1.5 text-sm text-white/60 transition-colors hover:border-white/20 hover:text-white/80"
          >
            Essential only
          </button>
          <button
            onClick={() => accept("accepted")}
            className="rounded-lg bg-[#5B5BD6] px-3.5 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
