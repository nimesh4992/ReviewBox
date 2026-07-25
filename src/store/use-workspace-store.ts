"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  /**
   * Workspace app the UI is scoped to — the app's UUID, or "" for "all apps".
   *
   * This used to hold the app's display NAME, which could not be handed to the
   * API as a filter and collides between apps sharing a name. A persisted name
   * from an older session won't match any app id, and the sidebar resets it to
   * "" (all apps) on load.
   */
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
      selectedApp: "",
      environment: "production",
      theme: "light",
      setSelectedApp: (selectedApp) => set({ selectedApp }),
      setEnvironment: (environment) => set({ environment }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
    }),
    { name: "reviewbox-workspace" },
  ),
);
