"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";

// ── Init ─────────────────────────────────────────────────────────────────────

function PostHogInit() {
  useEffect(() => {
    const key  = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

    if (!key || typeof window === "undefined") return;

    posthog.init(key, {
      api_host:          host,
      person_profiles:   "identified_only",
      capture_pageview:  false, // handled manually below (App Router)
      capture_pageleave: true,
    });
  }, []);

  return null;
}

// ── Page view tracker (App Router) ───────────────────────────────────────────

function PostHogPageView() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const ph           = usePostHog();

  useEffect(() => {
    if (!pathname || !ph) return;
    const url = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, ph]);

  return null;
}

// ── User identity sync (Clerk → PostHog) ─────────────────────────────────────

function PostHogIdentify() {
  const { user, isSignedIn } = useUser();
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    if (isSignedIn && user) {
      ph.identify(user.id, {
        email:      user.primaryEmailAddress?.emailAddress,
        name:       user.fullName,
        created_at: user.createdAt,
      });
    } else {
      ph.reset();
    }
  }, [isSignedIn, user, ph]);

  return null;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogInit />
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify />
      {children}
    </PHProvider>
  );
}
