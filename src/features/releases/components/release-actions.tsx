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
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">Actions</h2>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 border-gray-200 text-gray-400 cursor-not-allowed"
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
