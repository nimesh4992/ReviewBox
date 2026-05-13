"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  selectedApp: string;
  environment: "production" | "staging";
  theme: "light" | "dark";
  setSelectedApp: (selectedApp: string) => void;
  setEnvironment: (environment: WorkspaceState["environment"]) => void;
  setTheme: (theme: WorkspaceState["theme"]) => void;
  toggleTheme: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      selectedApp: "ReviewIQ Mobile",
      environment: "production",
      theme: "light",
      setSelectedApp: (selectedApp) => set({ selectedApp }),
      setEnvironment: (environment) => set({ environment }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
    }),
    { name: "revi-workspace" },
  ),
);
