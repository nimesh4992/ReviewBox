"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/use-workspace-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useWorkspaceStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
      html.setAttribute("data-theme", "dark");
    } else {
      html.classList.remove("dark");
      html.setAttribute("data-theme", "light");
    }
  }, [theme]);

  return <>{children}</>;
}
