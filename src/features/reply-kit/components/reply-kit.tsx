"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TagsTab } from "./tags-tab";
import { TemplatesTab } from "./templates-tab";
import { AIStylesTab } from "./ai-styles-tab";
import { KnowledgeBaseTab } from "./knowledge-base-tab";

const TABS = [
  { id: "tags", label: "Tags" },
  { id: "templates", label: "Templates" },
  { id: "ai_styles", label: "AI Reply styles" },
  { id: "knowledge", label: "Knowledge base" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ReplyKit() {
  const [activeTab, setActiveTab] = useState<TabId>("tags");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "pb-3 pr-6 text-sm font-medium transition-colors duration-150 outline-none",
              activeTab === tab.id
                ? "border-b-2 border-[var(--rb-blue-500)] -mb-px text-[var(--rb-blue-500)]"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "tags" && <TagsTab />}
      {activeTab === "templates" && <TemplatesTab />}
      {activeTab === "ai_styles" && <AIStylesTab />}
      {activeTab === "knowledge" && <KnowledgeBaseTab />}
    </div>
  );
}
