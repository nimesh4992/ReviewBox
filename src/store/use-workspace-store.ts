"use client";

import { create } from "zustand";

interface WorkspaceState {
  selectedApp: string;
  environment: "production" | "staging";
  setSelectedApp: (selectedApp: string) => void;
  setEnvironment: (environment: WorkspaceState["environment"]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedApp: "ReviewIQ Mobile",
  environment: "production",
  setSelectedApp: (selectedApp) => set({ selectedApp }),
  setEnvironment: (environment) => set({ environment }),
}));
