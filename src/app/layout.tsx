import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

import { QueryProvider } from "@/components/providers/query-provider";
import { CookieBanner } from "@/components/layout/cookie-banner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://revi.app";

export const metadata: Metadata = {
  title: {
    default: "Revi — App Review Intelligence",
    template: "%s | Revi",
  },
  description:
    "AI-powered review management for Google Play and App Store. Reply faster, spot crashes earlier, keep ratings high.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "Revi",
    title: "Revi — App Review Intelligence",
    description:
      "AI-powered review management for Google Play and App Store. Reply faster, spot crashes earlier, keep ratings high.",
    images: [
      {
        url: "/og.png", // add og.png to /public when ready
        width: 1200,
        height: 630,
        alt: "Revi — App Review Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Revi — App Review Intelligence",
    description:
      "AI-powered review management for Google Play and App Store.",
    images: ["/og.png"],
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
          <QueryProvider>{children}</QueryProvider>
          <CookieBanner />
        </body>
      </html>
    </ClerkProvider>
  );
}
