import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { CookieBanner } from "@/components/layout/cookie-banner";
import { PostHogProvider } from "@/components/providers/posthog-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const RAW_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";
const BASE_URL = RAW_URL.startsWith("http") ? RAW_URL : `https://${RAW_URL}`;

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
        <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
          <QueryProvider>
            <PostHogProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </PostHogProvider>
          </QueryProvider>
          <CookieBanner />
          <Analytics />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
