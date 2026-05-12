import { Bell, CheckCircle2, Database, Globe, MessageSquareReply, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertPreferences } from "./alert-preferences";
import { DataPrivacySection } from "./data-privacy-section";

const settingsSections = [
  {
    title: "Google Play connection",
    description: "Service account, package name, country coverage, and sync cadence.",
    icon: Smartphone,
    status: "Connected",
    statusVariant: "healthy" as const,
  },
  {
    title: "App Store Connect",
    description: "API key, issuer ID, private key, and review fetch schedule.",
    icon: Globe,
    status: "Not configured",
    statusVariant: "warning" as const,
  },
  {
    title: "Reply workflow",
    description: "Public response ownership, approvals, templates, and SLA policy.",
    icon: MessageSquareReply,
    status: "Needs owner",
    statusVariant: "warning" as const,
  },
  {
    title: "Alert routing",
    description: "Release damage, crash complaint spikes, billing risks, and daily digests.",
    icon: Bell,
    status: "Active",
    statusVariant: "healthy" as const,
  },
  {
    title: "Data retention",
    description: "Review archiving, export schedule, and data residency settings.",
    icon: Database,
    status: "Default",
    statusVariant: "neutral" as const,
  },
];

const statusConfig = {
  healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  neutral: "bg-gray-50 text-gray-600 border-gray-200",
};

export function SettingsSections() {
  return (
    <div className="flex flex-col gap-4">
    <AlertPreferences />
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Integrations</h2>
        <p className="mt-0.5 text-xs text-gray-400">
          Connect your review data sources and workflow tools
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <div
              key={section.title}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                  <Icon className="size-4 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 rounded-full border px-2 text-[10px] font-semibold",
                    statusConfig[section.statusVariant],
                  )}
                >
                  {section.statusVariant === "healthy" && (
                    <CheckCircle2 className="mr-1 size-2.5" />
                  )}
                  {section.status}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Configure
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
    <DataPrivacySection />
    </div>
  );
}

export function WorkspaceDefaults() {
  return (
    <aside className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Workspace defaults</h2>
        <p className="mt-0.5 text-xs text-gray-400">Applied across all connected apps</p>
        <div className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Default package</span>
            <Input
              defaultValue="com.reviewiq.mobile"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Reply SLA</span>
            <Input
              defaultValue="4 business hours"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Critical rating floor</span>
            <Input
              defaultValue="2 stars"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
        </div>
        <Button className="mt-4 h-8 w-full" size="sm">
          Save defaults
        </Button>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <h3 className="text-sm font-semibold text-indigo-900">AI settings</h3>
        <p className="mt-0.5 text-xs text-indigo-600/70">
          Configure tone, language, and suggestion behavior
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 h-7 w-full border-indigo-200 bg-white text-xs text-indigo-700 hover:bg-indigo-50"
        >
          Configure AI preferences
        </Button>
      </div>
    </aside>
  );
}
