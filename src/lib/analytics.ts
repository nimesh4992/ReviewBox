"use client";

import posthog from "posthog-js";

/**
 * Typed wrapper around PostHog `capture` for the events we actually
 * care about in the conversion funnel. Add new events here so the
 * funnel surface stays auditable in one file.
 */

export type AnalyticsEvent =
  // Acquisition
  | { name: "signup_completed"; properties: { method: "email" | "google" | "unknown" } }
  // Onboarding funnel
  | { name: "onboarding_step_viewed"; properties: { step: 1 | 2 | 3 | 4 | 5 } }
  | { name: "onboarding_setup";      properties: { platform: "google-play" | "app-store" } }
  | { name: "onboarding_completed";  properties: { platform: "google-play" | "app-store" } }
  // Trial → paid funnel
  | { name: "billing_viewed"; properties: { reason?: "trial-expired" | "required" | "payment-failed" | "direct" } }
  | { name: "upgrade_clicked"; properties: { plan: "starter" | "pro" | "team" } }
  | { name: "upgrade_completed"; properties: { plan: "starter" | "pro" | "team" } }
  // Core product engagement
  | { name: "reply_drafted"; properties: { source: "template" | "cache" | "groq" | "unknown" } }
  // method distinguishes the connected one-click post ("api") from Draft
  // Mode's copy-paste-then-confirm ("manual") — activation looks different
  // in each, so the funnel needs to see both.
  | { name: "reply_sent"; properties: { app_platform: "google_play" | "app_store"; method: "api" | "manual" } }
  | { name: "competitor_added"; properties: { platform: "google_play" | "app_store" } }
  // Power features
  | { name: "automation_rule_created"; properties: { action: string } }
  | { name: "template_created"; properties: Record<string, never> }
  | { name: "kb_entry_created"; properties: { category: string } };

export function track<E extends AnalyticsEvent>(event: E) {
  if (typeof window === "undefined") return;
  posthog.capture(event.name, event.properties);
}
