import type { Metadata } from "next";

import { LandingPage } from "@/features/marketing/components/landing-page";

/**
 * The landing page itself is a client component (theme toggle, the typed reply
 * demo), and a client component cannot export `metadata`. So this route is a
 * thin server component whose only job is to own the SEO metadata and render
 * the client tree.
 *
 * Before this split the homepage had no page-level metadata at all and fell
 * back to the root layout's generic title — the most valuable page on the site
 * was the only marketing page with untuned search metadata.
 */
export const metadata: Metadata = {
  // `absolute` bypasses the root layout's "%s | ReviewBox" template, which
  // would otherwise append the brand twice on the homepage.
  title: {
    absolute: "App Review Management for the App Store & Google Play — ReviewBox",
  },
  description:
    "Pull every App Store and Google Play review into one inbox, draft replies in your own voice, and post them back to the store. 14-day trial, no card required.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "App Review Management for the App Store & Google Play",
    description:
      "Every App Store and Google Play review in one inbox, with replies drafted in your voice and posted back to the store.",
  },
  twitter: {
    card: "summary_large_image",
    title: "App Review Management for the App Store & Google Play",
    description:
      "Every App Store and Google Play review in one inbox, with replies drafted in your voice and posted back to the store.",
  },
};

export default function Page() {
  return <LandingPage />;
}
