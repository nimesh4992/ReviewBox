"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "dark", toggle: () => {} });

export function useMarketingTheme() {
  return useContext(Ctx);
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  // SSR default: dark (matches homepage). Corrected on mount from OS / localStorage.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem("rb-marketing-theme") as Theme | null;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else {
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("rb-marketing-theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("rb-marketing-theme", next);
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, toggle }}>
      {/* data-theme for CSS-var-based components; "dark" class for Tailwind dark: variants */}
      <div
        data-theme={theme}
        className={theme === "dark" ? "dark" : ""}
        style={{
          background: "var(--rb-bg-canvas)",
          color: "var(--rb-fg-1)",
          minHeight: "100vh",
          fontFamily: "var(--rb-font-text)",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}
