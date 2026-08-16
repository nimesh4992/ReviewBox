import type { Metadata, Viewport } from "next";
import { Inter, Schibsted_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { LucideProvider } from "lucide-react";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { SentryIdentify } from "@/components/providers/sentry-identify";
import { marketingUrl } from "@/lib/site-urls";

// Product UI face. latin-ext is free at runtime (next/font emits a per-subset
// @font-face with unicode-range) and stops Polish/Turkish/Czech review bodies
// dropping to Arial mid-sentence.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

// Marketing/brand face. `weight` is deliberately omitted: that ships the full
// wght 400–900 variable axis as ONE woff2, where listing weights would download
// separate static cuts instead.
const brand = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-brand",
  display: "swap",
});

// The PUBLIC origin, not the app's. Canonical URLs and sitemap entries must
// name the marketing domain even when the app sits on a subdomain — see
// lib/site-urls.ts.
const BASE_URL = marketingUrl();

// Tell mobile browsers to render at device width instead of the default
// ~980px desktop width that then gets scaled down to fit. Without this,
// the whole site looks squeezed-to-fit on phones with tiny unreadable text.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0A84FF",
};

export const metadata: Metadata = {
  title: {
    default: "ReviewBox — App Review Intelligence",
    template: "%s | ReviewBox",
  },
  description:
    "AI-powered review management for Google Play and App Store. Reply faster, spot crashes earlier, keep ratings high.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "ReviewBox",
    title: "ReviewBox — App Review Intelligence",
    description:
      "AI-powered review management for Google Play and App Store. Reply faster, spot crashes earlier, keep ratings high.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReviewBox — App Review Intelligence",
    description:
      "AI-powered review management for Google Play and App Store.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${inter.variable} ${brand.variable} antialiased`}
          suppressHydrationWarning
        >
          {/* Default icon stroke lives here, not in CSS. A `.lucide {
              stroke-width }` rule is unlayered author CSS and therefore beats
              the SVG presentation attribute lucide emits, which silently killed
              every strokeWidth prop in the app. Context has the precedence we
              actually want: Icon reads `strokeWidth ?? contextStrokeWidth`, so
              an explicit prop wins and everything else inherits 1.5. */}
          <LucideProvider strokeWidth={1.5}>
            <QueryProvider>
              <PostHogProvider>
                <SentryIdentify />
                <ThemeProvider>{children}</ThemeProvider>
              </PostHogProvider>
            </QueryProvider>
            <CookieBanner />
          </LucideProvider>
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
