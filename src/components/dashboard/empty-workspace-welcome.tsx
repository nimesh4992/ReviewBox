"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Plug, Zap, MessageSquare, Bell } from "lucide-react";

/**
 * Empty-state UI shown on /dashboard when the user has zero connected apps.
 *
 * This replaces the old middleware-level redirect to /onboarding. Modern SaaS
 * pattern (Stripe, Linear, Notion): land users on the product, show what they
 * could do, point them to setup with a clear CTA. No forced redirects, no JWT
 * race conditions.
 */
export function EmptyWorkspaceWelcome() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  const features = [
    {
      icon: Plug,
      iconColor: "text-[#0A84FF]",
      title: "Sync reviews automatically",
      desc: "Reviews from Google Play and App Store appear in your inbox within 30 seconds of connecting.",
    },
    {
      icon: Zap,
      iconColor: "text-amber-500",
      title: "AI triage out of the box",
      desc: "Every review gets a sentiment score, priority level, and issue tags — no setup required.",
    },
    {
      icon: MessageSquare,
      iconColor: "text-emerald-500",
      title: "One-click reply drafts",
      desc: "Click a review, get a brand-voice reply you can edit and send back to the store.",
    },
    {
      icon: Bell,
      iconColor: "text-rose-500",
      title: "Catch crashes early",
      desc: "Email + Slack alerts the moment ratings drop unexpectedly. Spot trouble before users do.",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-8 overflow-auto p-8" style={{ maxWidth: 1024, margin: "0 auto" }}>
      {/* Hero */}
      <div className="rounded-[18px] border border-[#0A84FF]/15 bg-gradient-to-br from-[#0A84FF]/[0.06] via-white to-white p-10 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0A84FF]/10">
            <Plug className="size-6 text-[#0A84FF]" strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.022em] text-[#1D1D1F]">
            Welcome, {firstName} 👋
          </h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#48484D]">
            ReviewBox is ready. Connect your first app from Google Play or the App Store, and we&apos;ll start syncing reviews within 30 seconds.
          </p>

          <div className="mt-6 flex items-center gap-3">
            <Link
              href="/onboarding"
              className="flex h-10 items-center gap-2 rounded-xl bg-[#0A84FF] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#006EE0]"
            >
              Connect your first app
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
            <Link
              href="/settings"
              className="flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-[14px] font-medium text-[#48484D] transition-colors hover:bg-gray-50"
            >
              Open Settings
            </Link>
          </div>

          <p className="mt-4 text-[12px] text-[#86868B]">
            Free during your 14-day trial · No credit card required to start
          </p>
        </div>
      </div>

      {/* What you'll get */}
      <div>
        <h2 className="text-[14px] font-semibold uppercase tracking-[0.05em] text-[#86868B]">
          What ReviewBox does for you
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-50">
                <f.icon className={`size-4 ${f.iconColor}`} strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1D1D1F]">{f.title}</div>
                <div className="mt-1 text-[13px] leading-relaxed text-[#48484D]">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nudge */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-6 py-5 text-center">
        <p className="text-[13px] text-[#48484D]">
          Already managed your app on AppFollow or App Radar?{" "}
          <Link href="/onboarding" className="font-semibold text-[#0A84FF] hover:underline">
            Connect it here →
          </Link>
        </p>
      </div>
    </div>
  );
}
