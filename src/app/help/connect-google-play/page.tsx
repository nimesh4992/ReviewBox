import Link from "next/link";
import { CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Connect Google Play â€” ReviewBox Help",
  description:
    "Step-by-step guide to connecting your Google Play app to ReviewBox using a Google Cloud service account.",
};

const STEPS = [
  {
    id: "create-project",
    title: "Open Google Cloud Console",
    content: (
      <>
        <p>
          Go to{" "}
          <a
            href="https://console.cloud.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0A84FF] hover:underline"
          >
            console.cloud.google.com
          </a>{" "}
          and sign in with the Google account that owns your Google Play Console.
        </p>
        <p className="mt-3">
          If you don&apos;t have a project yet, click <strong>Select a project â†’ New Project</strong>. Name it something like <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">reviewbox-integration</code>.
        </p>
      </>
    ),
  },
  {
    id: "enable-api",
    title: "Enable the Google Play Android Developer API",
    content: (
      <>
        <p>
          In the Google Cloud Console, go to <strong>APIs &amp; Services â†’ Library</strong>. Search for{" "}
          <strong>Google Play Android Developer API</strong> and click <strong>Enable</strong>.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            This is a different API from the Play Console. Make sure you enable the <em>Android Developer</em> API, not the Play Games API.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "create-service-account",
    title: "Create a service account",
    content: (
      <>
        <p>
          Go to <strong>IAM &amp; Admin â†’ Service Accounts â†’ Create Service Account</strong>.
        </p>
        <ol className="mt-3 space-y-2 text-sm list-decimal list-inside text-gray-600">
          <li>Name it <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">reviewbox</code> (or any name you prefer)</li>
          <li>Click <strong>Create and continue</strong></li>
          <li>Skip the optional role and user access steps â€” click <strong>Done</strong></li>
        </ol>
        <p className="mt-3">
          You&apos;ll see your new service account in the list. Click it, then go to the <strong>Keys</strong> tab.
        </p>
        <p className="mt-2">
          Click <strong>Add Key â†’ Create new key â†’ JSON â†’ Create</strong>. A <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.json</code> file will download. Keep it safe â€” you&apos;ll need it in step 5.
        </p>
      </>
    ),
  },
  {
    id: "grant-play-access",
    title: "Grant the service account access in Google Play Console",
    content: (
      <>
        <p>
          Open{" "}
          <a
            href="https://play.google.com/console"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0A84FF] hover:underline"
          >
            play.google.com/console
          </a>{" "}
          and go to <strong>Setup â†’ API access</strong>.
        </p>
        <ol className="mt-3 space-y-3 text-sm list-decimal list-inside text-gray-600">
          <li>
            If prompted, link your Play Console account to your Google Cloud project â€” select the project you created in step 1.
          </li>
          <li>
            Under <strong>Service accounts</strong>, find the account you created and click <strong>Manage Play Console permissions</strong>.
          </li>
          <li>
            Under <strong>Account permissions</strong>, enable <strong>Reply to reviews</strong>.
          </li>
          <li>
            Click <strong>Invite user â†’ Send invitation</strong>.
          </li>
        </ol>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
          <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Permissions can take up to 24 hours to propagate from Google Play Console. If the first sync fails with a permission error, wait an hour and try again.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "add-to-reviewbox",
    title: "Add the credentials to ReviewBox",
    content: (
      <>
        <p>
          In ReviewBox, go to <strong>Settings â†’ Apps â†’ Add app â†’ Google Play</strong>.
        </p>
        <ol className="mt-3 space-y-2 text-sm list-decimal list-inside text-gray-600">
          <li>Enter your <strong>Package name</strong> (e.g. <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">com.yourcompany.yourapp</code>)</li>
          <li>Paste the full contents of the <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.json</code> key file you downloaded</li>
          <li>Click <strong>Verify connection</strong></li>
        </ol>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            ReviewBox will immediately try to fetch your most recent reviews. If verification succeeds, your first batch (up to 500 reviews) will appear within 2 minutes.
          </p>
        </div>
      </>
    ),
  },
];

const RELATED = [
  { title: "Connect the App Store", href: "/help/connect-app-store" },
  { title: "How AI replies work", href: "/help/ai-replies" },
  { title: "How often do reviews sync?", href: "/faq" },
  { title: "Reply to a review", href: "#" },
];

export default function ConnectGooglePlayPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <MarketingNav />

      {/* Breadcrumb */}
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
            Getting started Â· 5 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Connect Google Play
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed">
            ReviewBox uses a Google Cloud service account to read and reply to your Play Store reviews. This guide walks through the complete setup â€” from creating the service account to verifying the connection in ReviewBox.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          {/* Steps */}
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

            {/* Done */}
            <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-emerald-900">You&apos;re connected!</h3>
                <p className="mt-1 text-sm text-emerald-800 leading-relaxed">
                  Reviews will sync automatically every 4 hours. You can also trigger a manual sync from{" "}
                  <strong>Settings â†’ Apps</strong> at any time.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* On this page */}
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

            {/* Related */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                Related articles
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

            {/* Still stuck */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Still stuck?</p>
              <p className="mt-1 text-xs text-gray-500">We respond within one business day.</p>
              <Link
                href="/contact"
                className="mt-4 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0070e0]"
              >
                Email us
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
