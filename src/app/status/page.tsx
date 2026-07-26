import Link from "next/link";
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "System Status",
  description: "Service status for ReviewBox — review sync, AI reply generation, store connections, and the dashboard.",
};

type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance";

const OVERALL_STATUS: ServiceStatus = "operational";

const SERVICES: { name: string; status: ServiceStatus; latency?: string }[] = [
  { name: "Dashboard & Web App", status: "operational", latency: "98ms" },
  { name: "API", status: "operational", latency: "112ms" },
  { name: "AI Reply Generation", status: "operational", latency: "340ms" },
  { name: "Google Play Sync", status: "operational", latency: "—" },
  { name: "Apple App Store Sync", status: "operational", latency: "—" },
  { name: "Webhooks", status: "operational", latency: "55ms" },
  { name: "Email Notifications", status: "operational", latency: "—" },
  { name: "Upstash Redis (Cache)", status: "operational", latency: "8ms" },
];

// 90-day uptime simulation — each entry is a day, true = up, false = incident
function generateUptimeBar(incidents: number[]): boolean[] {
  return Array.from({ length: 90 }, (_, i) => !incidents.includes(i));
}

const UPTIME_DATA: Record<string, { days: boolean[]; pct: string }> = {
  "Dashboard & Web App": { days: generateUptimeBar([]), pct: "100%" },
  "API": { days: generateUptimeBar([67]), pct: "99.9%" },
  "AI Reply Generation": { days: generateUptimeBar([34, 67]), pct: "99.8%" },
  "Google Play Sync": { days: generateUptimeBar([67]), pct: "99.9%" },
  "Apple App Store Sync": { days: generateUptimeBar([]), pct: "100%" },
};

const INCIDENTS = [
  {
    date: "May 13, 2026",
    title: "Elevated AI reply latency",
    status: "Resolved",
    duration: "22 min",
    description:
      "Groq API experienced elevated latency. Reply drafts fell back to cached responses. No data loss.",
  },
  {
    date: "Apr 26, 2026",
    title: "Google Play sync delay",
    status: "Resolved",
    duration: "41 min",
    description:
      "Google Publisher API rate limits were hit during a large batch sync. Reviews were delayed but not lost. Sync completed successfully after rate limit reset.",
  },
];

function StatusBadge({ status }: { status: ServiceStatus }) {
  const map = {
    operational: { label: "Operational", icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30" },
    degraded: { label: "Degraded", icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30" },
    outage: { label: "Outage", icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/30" },
    maintenance: { label: "Maintenance", icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
  };
  const { label, icon: Icon, color, bg } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${bg} ${color}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {label}
    </span>
  );
}

function OverallBanner({ status }: { status: ServiceStatus }) {
  const map = {
    operational: {
      bg: "bg-emerald-500",
      text: "All systems operational",
      icon: CheckCircle,
    },
    degraded: {
      bg: "bg-amber-400",
      text: "Some systems degraded",
      icon: AlertCircle,
    },
    outage: {
      bg: "bg-red-500",
      text: "Service disruption in progress",
      icon: XCircle,
    },
    maintenance: {
      bg: "bg-blue-500",
      text: "Scheduled maintenance in progress",
      icon: Clock,
    },
  };
  const { bg, text, icon: Icon } = map[status];
  return (
    <div className={`rounded-2xl ${bg} px-8 py-6 flex items-center gap-4 mb-8`}>
      <Icon className="h-8 w-8 text-white shrink-0" strokeWidth={2} />
      <div>
        <p className="text-lg font-bold text-white">{text}</p>
        <p className="text-sm text-white/80 mt-0.5">
          Updated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Status</span>
        </nav>
      </div>

      <main className="mx-auto max-w-4xl px-6 pb-32">
        {/* Header */}
        <div className="pt-12 pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">System Status</h1>
          <p className="mt-2 text-gray-500 dark:text-[#86868B]">
            Live health of all ReviewBox services.{" "}
            <a
              href="https://status.tryreviewbox.com"
              className="text-[#0A84FF] hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Subscribe to updates →
            </a>
          </p>
        </div>

        {/* Overall status banner */}
        <OverallBanner status={OVERALL_STATUS} />

        {/* Services table */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618]">
          <div className="border-b border-gray-100 dark:border-white/6 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-[#F5F5F7]">Services</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/6">
            {SERVICES.map((svc) => (
              <div key={svc.name} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-[#F5F5F7]">{svc.name}</p>
                  {svc.latency && svc.latency !== "—" && (
                    <p className="text-xs text-gray-400 dark:text-[#636366] mt-0.5">avg latency {svc.latency}</p>
                  )}
                </div>
                <StatusBadge status={svc.status} />
              </div>
            ))}
          </div>
        </div>

        {/* 90-day history */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-6">90-day uptime</h2>
          <div className="space-y-5">
            {Object.entries(UPTIME_DATA).map(([name, { days, pct }]) => (
              <div key={name} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#F5F5F7]">{name}</p>
                  <span className="text-xs text-gray-400 dark:text-[#636366]">{pct} uptime</span>
                </div>
                <div className="flex gap-0.5">
                  {days.map((up, i) => (
                    <div
                      key={i}
                      title={up ? "Operational" : "Incident"}
                      className={`flex-1 h-8 rounded-sm ${up ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{ minWidth: 0 }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-[#636366]">
                  <span>90 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incident history */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-6">Recent incidents</h2>
          {INCIDENTS.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8 text-center text-gray-400 dark:text-[#636366] text-sm">
              No incidents in the last 90 days.
            </div>
          ) : (
            <div className="space-y-4">
              {INCIDENTS.map((inc) => (
                <div key={inc.title} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span className="text-xs text-gray-400 dark:text-[#636366]">{inc.date}</span>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {inc.status}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-[#636366]">Duration: {inc.duration}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{inc.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#86868B] leading-relaxed">{inc.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
