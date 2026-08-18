import { CheckCircle, ExternalLink } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Breadcrumb,
  Card,
  CtaBand,
  PageHero,
  Reveal,
  RHYTHM,
  Section,
  SectionHeading,
} from "@/features/marketing/components/primitives";

export const metadata = {
  title: "System Status",
  description:
    "Where to find live service status for ReviewBox — review sync, AI reply generation, store connections, and the dashboard.",
};

/**
 * ── Why this page no longer shows numbers ────────────────────────────────────
 *
 * Everything on it was invented. The headline said "Live health of all
 * ReviewBox services" above:
 *
 *   - hardcoded latencies ("98ms", "112ms", "340ms") measured from nothing;
 *   - a 90-day uptime grid built by `generateUptimeBar()`, whose own comment
 *     read "90-day uptime simulation", with percentages (99.8%, 99.9%) chosen
 *     to look plausible;
 *   - two incident reports — dates, durations, root causes — for outages that
 *     never happened;
 *   - "Webhooks" listed as an operational service, which is unbuilt.
 *
 * A status page is a trust instrument. It is read precisely when a customer
 * already suspects something is wrong, and it is the one page where being
 * wrong costs the most. Publishing a simulation of one is worse than not
 * having one, and it is the same class of claim as the invented testimonials
 * removed from /compare and the blog posts that 404'd.
 *
 * So this page now does the only honest thing available today: it names the
 * services, says plainly that live monitoring is not published yet, and points
 * at the status host and the support address. When BetterStack is wired up
 * (LAUNCH_CHECKLIST / S3.4), replace this with real data — or redirect here to
 * status.tryreviewbox.com and delete the page.
 *
 * Note: /status is already flagged for removal in the founder-approved page cut
 * (see the comment in marketing-nav.tsx), which is why it is not in the nav.
 * It stays reachable because /contact and the footer still link to it.
 */

const STATUS_HOST = "https://status.tryreviewbox.com";

const SERVICES = [
  { name: "Dashboard & web app", detail: "The app at app.tryreviewbox.com." },
  { name: "API", detail: "The routes the dashboard and crons call." },
  { name: "AI reply generation", detail: "Templates, reply cache, and the model fallback." },
  { name: "Google Play sync", detail: "Daily scheduled sync plus sync on demand." },
  { name: "Apple App Store sync", detail: "Daily scheduled sync plus sync on demand." },
  { name: "Email notifications", detail: "Alerts, digests, and transactional mail." },
];

export default function StatusPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="Status" />

      <main>
        <PageHero
          eyebrow="Status"
          title="Service status"
          lede="What ReviewBox runs, and where to look when something isn't working."
        />

        <Section className="pb-4">
          <Reveal>
            <Card className="mx-auto max-w-3xl p-7 sm:p-8">
              <div className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--rb-green-100)]">
                  <CheckCircle
                    className="size-5 text-[var(--rb-green-600)]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </span>
                <div className="min-w-0">
                  <h2 className="rb-h3 text-fg-1">No known incidents</h2>
                  <p className="rb-body mt-2 text-fg-2">
                    We are not currently aware of any service disruption. Continuous
                    uptime monitoring is not published yet — until it is, this page
                    is maintained by hand, so treat it as a notice board rather than
                    a live instrument.
                  </p>
                  <p className="rb-body mt-4 text-fg-2">
                    If something is broken for you right now, email{" "}
                    <a
                      href="mailto:hello@tryreviewbox.com"
                      className="font-medium text-[var(--rb-blue-500)] hover:underline"
                    >
                      hello@tryreviewbox.com
                    </a>{" "}
                    and a person will answer — that is faster than waiting for a
                    dashboard to notice.
                  </p>
                </div>
              </div>
            </Card>
          </Reveal>
        </Section>

        <Section className={RHYTHM.md}>
          <Reveal>
            <SectionHeading
              eyebrow="Coverage"
              title="What we monitor"
              lede="These are the moving parts. When live monitoring goes up, each of them gets its own uptime history."
            />
          </Reveal>
          <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
            {SERVICES.map((svc, i) => (
              <Reveal key={svc.name} delay={i * 60}>
                <Card className="h-full">
                  <h3 className="rb-h4 text-fg-1">{svc.name}</h3>
                  <p className="rb-body-sm mt-2 text-fg-2">{svc.detail}</p>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <p className="rb-body mx-auto mt-10 max-w-2xl text-center text-fg-3">
              Live uptime and incident history will be published at{" "}
              <a
                href={STATUS_HOST}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-[var(--rb-blue-500)] hover:underline"
              >
                status.tryreviewbox.com
                <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </a>
              .
            </p>
          </Reveal>
        </Section>

        <CtaBand
          title="Something not working?"
          lede="Email us and a person answers — usually within one business day, often sooner."
          primary={{ href: "/contact", label: "Contact support" }}
          secondary={{ href: "/help", label: "Browse the help centre" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
