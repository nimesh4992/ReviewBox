import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { CredentialsBanner } from "@/components/layout/credentials-banner";

/**
 * Every signed-in page declares itself unindexable, in its own markup.
 *
 * Middleware already sets `X-Robots-Tag: noindex, nofollow`, but only when the
 * request arrives on app.tryreviewbox.com. That covers production and nothing
 * else: a Vercel preview URL, the apex domain, or any future hostname serves
 * these same routes with no such header. Declaring it here makes the page
 * correct wherever it is served from, which is the property we actually want —
 * the header is an optimisation for crawl budget, not the guarantee.
 *
 * Inherited by every route in the (app) group, so individual pages need no
 * robots key of their own; a page that sets its own `metadata` merges with this
 * rather than replacing it.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <CredentialsBanner />
      {children}
    </AppShell>
  );
}
