import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { incidentAlerts } from "@/features/dashboard/data/operations";
import { IncidentList } from "@/features/incidents/components/incident-list";

export default function IncidentsPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Operations"
        title="Incidents"
        description="Review-driven issues that need product, support, or engineering ownership."
        actions={
          <Button size="sm" className="h-8">
            <ShieldAlert className="size-3.5" />
            Declare incident
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        <IncidentList incidents={incidentAlerts} />
      </div>
    </div>
  );
}
