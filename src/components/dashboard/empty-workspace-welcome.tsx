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
 *
 * Styling note: everything here goes through the --rb-* tokens and the
 * text-rb-* scale. This file previously carried five border radii, five
 * hard-coded hex values, an inline style object and four different icon
 * colours — which is most of why the screen read as noisy. One radius
 * (rounded-xl), one accent (brand blue, reserved for the primary action).
 */
export function EmptyWorkspaceWelcome() {
  const { user } = useUser();
  const firstName = user?.firstName ?? "there";

  const features = [
    {
      icon: Plug,
      title: "Sync reviews automatically",
      desc: "Reviews from Google Play and the App Store appear in your inbox shortly after you connect.",
    },
    {
      icon: Zap,
      title: "AI triage out of the box",
      desc: "Every review gets a sentiment score, priority level, and issue tags — no setup required.",
    },
    {
      icon: MessageSquare,
      title: "One-click reply drafts",
      desc: "Open a review, get a reply in your own voice that you can edit and send back to the store.",
    },
    {
      icon: Bell,
      title: "Catch crashes early",
      desc: "Alerts the moment a release starts dragging your rating down, so you hear it from us first.",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 overflow-auto p-8">
      {/* Hero */}
      <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-10">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--rb-bg-accent-soft)]">
            <Plug className="size-5 text-[var(--rb-blue-500)]" strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 text-rb-display font-semibold tracking-[-0.022em] text-fg-1">
            Welcome, {firstName}
          </h1>
          <p className="mt-3 max-w-md text-rb-lg leading-relaxed text-fg-2">
            Connect your first app and ReviewBox starts pulling in reviews,
            tagging them, and drafting replies.
          </p>

          <div className="mt-7 flex items-center gap-3">
            <Link
              href="/onboarding"
              className="flex h-10 items-center gap-2 rounded-xl bg-[var(--rb-blue-500)] px-5 text-rb-md font-medium text-white transition-colors hover:bg-[var(--rb-blue-600)]"
            >
              Connect your first app
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
            <Link
              href="/settings"
              className="flex h-10 items-center gap-2 rounded-xl border border-[var(--rb-border-2)] bg-surface px-5 text-rb-md font-medium text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
            >
              Open Settings
            </Link>
          </div>

          <p className="mt-5 text-rb-sm text-fg-3">
            Free during your 14-day trial · No credit card required
          </p>
        </div>
      </div>

      {/* What you'll get */}
      <div>
        <h2 className="text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">
          What ReviewBox does for you
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface p-5"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--rb-bg-sunken)]">
                <f.icon className="size-4 text-fg-3" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-rb-md font-medium text-fg-1">{f.title}</div>
                <div className="mt-1 text-rb-base leading-relaxed text-fg-2">
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nudge */}
      <div className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-6 py-5 text-center">
        <p className="text-rb-base text-fg-2">
          Already managing your app on AppFollow or App Radar?{" "}
          <Link
            href="/onboarding"
            className="font-medium text-[var(--rb-blue-500)] hover:underline"
          >
            Connect it here
          </Link>
        </p>
      </div>
    </div>
  );
}
