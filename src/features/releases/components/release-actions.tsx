"use client";

import { PauseCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ReleaseActions() {
  return (
    <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5">
      <h2 className="text-sm font-semibold text-fg-1 mb-4">Actions</h2>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 border-[var(--rb-border-1)] text-fg-3 cursor-not-allowed"
              >
                <PauseCircle className="size-3.5" strokeWidth={1.5} />
                Pause rollout
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Connect Google Play to enable</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
