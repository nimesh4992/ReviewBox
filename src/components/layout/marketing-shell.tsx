"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function useMarketingTheme() {
  return useContext(Ctx);
}

export function MarketingShell({ children }: { children: React.ReactNode }) {
  // Marketing is light by default — SSR and first paint included. The bright
  // SaaS design is the product's face; visitors with a dark OS were being
  // greeted by a dark canvas the design was never tuned for. Dark remains an
  // explicit choice via the nav toggle (persisted), never an OS inference.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = localStorage.getItem("rb-marketing-theme") as Theme | null;
    if (stored === "dark" || stored === "light") setTheme(stored);
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
        className={`rb-marketing ${theme === "dark" ? "dark" : ""}`}
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
