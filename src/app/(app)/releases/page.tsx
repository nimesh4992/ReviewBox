import { PauseCircle, Rocket } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { releaseHealth } from "@/features/dashboard/data/operations";
import { ReleaseHealthTable } from "@/features/releases/components/release-health-table";

export default function ReleasesPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Release monitor"
        title="Releases"
        description="Connect review movement to staged rollouts, rating shifts, complaint spikes, and regression language."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-8 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            >
              <PauseCircle className="size-3.5" />
              Pause rollout
            </Button>
            <Button size="sm" className="h-8">
              <Rocket className="size-3.5" />
              New release
            </Button>
          </>
        }
      />

      <div className="p-4 md:p-6">
        <ReleaseHealthTable releases={releaseHealth} />
      </div>
    </div>
  );
}
