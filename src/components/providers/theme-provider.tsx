"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/use-workspace-store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useWorkspaceStore((s) => s.theme);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme]);

  return <>{children}</>;
}
