import Link from "next/link";
import { CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Connect Google Play — Help",
  description:
    "Step-by-step guide to grant ReviewBox access to your Google Play Console so we can sync your reviews and post replies.",
};

// The actual production service account email lives in GOOGLE_CLIENT_EMAIL.
// Surface it server-side at request time — never hardcode.
function getServiceAccountEmail(): string {
  return process.env.GOOGLE_CLIENT_EMAIL ?? "(check Settings → Integrations for your email)";
}

const TROUBLESHOOTING = [
  {
    q: "I added the email but reviews still aren't appearing",
    a: "Permission propagation in Google Play can take 5–60 minutes. Click 'Sync now' in Settings → Integrations after waiting. If you still see the amber error banner after an hour, double-check that 'Reply to reviews' is enabled in the permissions.",
  },
  {
    q: "I see 'Service account not authorized' even after granting access",
    a: "Make sure you scoped the access to the right app (or all apps), and that BOTH permissions are checked: 'View app information & download bulk reports' AND 'Reply to reviews'. View-only is not enough — we need reply permission to draft + send replies.",
  },
  {
    q: "Where do I find my package name?",
    a: "Open your Google Play app listing in a browser. The URL contains it: play.google.com/store/apps/details?id=com.your.app — the part after id= is your package name.",
  },
  {
    q: "Will this give ReviewBox access to my whole Play Console?",
    a: "No. You scope the invite to the apps you choose. Only 'View app information' and 'Reply to reviews' permissions are needed — we cannot upload builds, change pricing, or modify any app metadata.",
  },
];

export default async function ConnectGooglePlayPage() {
  const email = getServiceAccountEmail();

  const STEPS = [
    {
      id: "open-console",
      title: "Open Google Play Console",
      content: (
        <>
          <p>
            Sign in to{" "}
            <a
              href="https://play.google.com/console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A84FF] hover:underline"
            >
              play.google.com/console
            </a>{" "}
            with the account that owns your app.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            You need to be an Admin or have user-management permission. If you&apos;re not, send this guide to whoever does.
          </p>
        </>
      ),
    },
    {
      id: "users-permissions",
      title: "Navigate to Users & Permissions",
      content: (
        <p>
          In the left sidebar, click <strong>Users and permissions</strong>. You&apos;ll see a list of people already on your team. Click the <strong>Invite new users</strong> button at the top right.
        </p>
      ),
    },
    {
      id: "paste-email",
      title: "Invite the ReviewBox service account",
      content: (
        <>
          <p>Paste this email address:</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <code className="flex-1 truncate font-mono text-[12px] text-gray-800">{email}</code>
            <span className="text-[10px] font-medium text-gray-400">Copy from Settings → Integrations in-product</span>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            This is our service account. It&apos;s not a human — Google Play treats it as a teammate so it can read your reviews and post replies through their API.
          </p>
        </>
      ),
    },
    {
      id: "set-permissions",
      title: "Grant exactly two permissions",
      content: (
        <>
          <p>Under <strong>App permissions</strong>, check the box next to:</p>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span><strong>View app information &amp; download bulk reports</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span><strong>Reply to reviews</strong></span>
            </li>
          </ul>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              Don&apos;t grant any other permissions. We don&apos;t need to publish builds, change pricing, or access financial data — and granting more access could be a security risk for you.
            </p>
          </div>
        </>
      ),
    },
    {
      id: "scope-to-app",
      title: "Scope to your app (recommended)",
      content: (
        <>
          <p>
            Choose <strong>Specific apps</strong> and select the app(s) you want ReviewBox to manage. This is safer than granting access to your entire Play Console.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            If you only have one app, you can use <strong>All apps</strong> — same result, slightly less safety if you launch more apps later.
          </p>
        </>
      ),
    },
    {
      id: "send-invite",
      title: "Send the invitation",
      content: (
        <>
          <p>
            Click <strong>Invite user</strong> → <strong>Send invitation</strong>. Service accounts auto-accept — there&apos;s no email back-and-forth.
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Google may take 5–60 minutes to propagate the permission. Most users see it within 5 minutes.
          </p>
        </>
      ),
    },
    {
      id: "verify",
      title: "Verify the connection",
      content: (
        <>
          <p>
            Back in ReviewBox, go to{" "}
            <Link href="/settings?tab=integrations" className="text-[#0A84FF] hover:underline">
              Settings → Integrations
            </Link>{" "}
            and click <strong>Sync now</strong> next to your app.
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            <p className="text-sm text-emerald-800">
              You should see reviews appear within 30 seconds. If the amber error banner says &quot;Service account not authorized&quot;, wait another 5–10 minutes for Google&apos;s propagation and try again.
            </p>
          </div>
        </>
      ),
    },
  ];

  const RELATED = [
    { title: "Connect the App Store", href: "/help/connect-app-store" },
    { title: "How AI replies work", href: "/help/ai-replies" },
    { title: "Help center home", href: "/help" },
  ];

  return (
    <MarketingShell>
      <MarketingNav />

      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-gray-600">Help Center</Link>
          <span>/</span>
          <span className="text-gray-600">Connect Google Play</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        <div className="pt-10 pb-8 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Getting started · 3 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Connect Google Play
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed">
            You don&apos;t need to create any developer accounts or download files. Just invite ReviewBox&apos;s service account email to your Play Console with two permissions. Total time: 3 minutes.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                id={step.id}
                className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0A84FF] text-xs font-bold text-white">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">{step.title}</h2>
                    <div className="mt-3 text-sm text-gray-600 leading-relaxed space-y-2">
                      {step.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-900">You&apos;re connected!</h3>
                <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
                  Reviews sync automatically each day. Click{" "}
                  <strong>Sync now</strong> in{" "}
                  <Link href="/settings?tab=integrations" className="underline">Settings → Integrations</Link>{" "}
                  any time you want fresh data.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h2 className="font-semibold text-gray-900">Troubleshooting</h2>
              <ul className="mt-4 space-y-4">
                {TROUBLESHOOTING.map((t) => (
                  <li key={t.q}>
                    <p className="text-sm font-semibold text-gray-800">{t.q}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{t.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                On this page
              </p>
              <ul className="space-y-1">
                {STEPS.map((step, i) => (
                  <li key={step.id}>
                    <a
                      href={`#${step.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                      {step.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Related
              </p>
              <ul className="space-y-1">
                {RELATED.map((r) => (
                  <li key={r.title}>
                    <Link
                      href={r.href}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      {r.title}
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Still stuck?</p>
              <p className="mt-1 text-xs text-gray-500">We reply within one business day.</p>
              <a
                href="mailto:hello@tryreviewbox.com"
                className="mt-4 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0070e0]"
              >
                Email us
              </a>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
