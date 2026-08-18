import Link from "next/link";
import { CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Connect the App Store — Help",
  description:
    "Step-by-step guide to connecting your iOS app to ReviewBox using an App Store Connect API key.",
};

const STEPS = [
  {
    id: "open-asc",
    title: "Open App Store Connect",
    content: (
      <>
        <p>
          Go to{" "}
          <a href="https://appstoreconnect.apple.com" target="_blank" rel="noopener noreferrer" className="text-[#0A84FF] hover:underline">
            appstoreconnect.apple.com
          </a>{" "}
          and sign in with your Apple ID. You must have an Account Holder or Admin role.
        </p>
      </>
    ),
  },
  {
    id: "generate-key",
    title: "Generate an App Store Connect API key",
    content: (
      <>
        <p>
          Go to <strong>Users and Access → Integrations → App Store Connect API</strong>.
        </p>
        <ol className="mt-3 space-y-2 text-sm list-decimal list-inside text-gray-600">
          <li>Click the <strong>+</strong> button to generate a new key</li>
          <li>Give it a name like <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">ReviewBox</code></li>
          <li>Set <strong>Access</strong> to <strong>Customer Support</strong> — this grants read + reply access without billing permissions</li>
          <li>Click <strong>Generate</strong></li>
        </ol>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 p-4">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Download the <code className="rounded bg-amber-100 px-1 text-xs">.p8</code> key file immediately — Apple only lets you download it once. If you lose it, you&apos;ll need to revoke and generate a new key.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "collect-credentials",
    title: "Collect your three credentials",
    content: (
      <>
        <p>You need three things from App Store Connect. Find them on the same API keys page:</p>
        <div className="mt-3 space-y-2">
          {[
            { label: "Key ID", desc: "Shown in the table next to your key name. Format: A1B2C3D4E5" },
            { label: "Issuer ID", desc: "Shown at the top of the API keys page. Format: a UUID like 12ab3cd4-..." },
            { label: ".p8 file", desc: "The private key file you downloaded when generating the key" },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-start gap-3 rounded-lg bg-gray-50 border border-gray-100 p-3">
              <code className="rounded bg-white border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-800 shrink-0 mt-0.5">{label}</code>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
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
          In ReviewBox, go to <strong>Settings → Integrations → Add app → App Store</strong>.
        </p>
        <ol className="mt-3 space-y-2 text-sm list-decimal list-inside text-gray-600">
          <li>Enter your <strong>Bundle ID</strong> (e.g. <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">com.yourcompany.yourapp</code>)</li>
          <li>Enter your <strong>Key ID</strong></li>
          <li>Enter your <strong>Issuer ID</strong></li>
          <li>Paste the full contents of your <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">.p8</code> file (including the <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">-----BEGIN/END-----</code> header lines)</li>
          <li>Click <strong>Verify connection</strong></li>
        </ol>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-100 p-4">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-800">
            ReviewBox will immediately fetch your most recent reviews. Your first batch (up to 500) appears within 2 minutes. Subsequent syncs run every 4 hours automatically.
          </p>
        </div>
      </>
    ),
  },
];

const RELATED = [
  { title: "Connect Google Play", href: "/help/connect-google-play" },
  { title: "How AI replies work", href: "/help/ai-replies" },
  { title: "How often do reviews sync?", href: "/faq" },
  { title: "Reply to a review", href: "#" },
];

export default function ConnectAppStorePage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-gray-600">Help Center</Link>
          <span>/</span>
          <span className="text-gray-600">Connect App Store</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        <div className="pt-10 pb-8 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Getting started · 5 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Connect the App Store
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed">
            ReviewBox uses an App Store Connect API key to read and reply to your iOS reviews. Unlike the Google Play setup, there&apos;s no service account — just three credentials from App Store Connect.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          {/* Steps */}
          <div className="space-y-6">
            {STEPS.map((step, i) => (
              <div key={step.id} id={step.id} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6">
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
                  Reviews will sync every 4 hours. Trigger a manual sync any time from <strong>Settings → Integrations</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">On this page</p>
              <ul className="space-y-1">
                {STEPS.map((step, i) => (
                  <li key={step.id}>
                    <a href={`#${step.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                      <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                      {step.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Related articles</p>
              <ul className="space-y-1">
                {RELATED.map((r) => (
                  <li key={r.title}>
                    <Link href={r.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                      {r.title}
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Still stuck?</p>
              <p className="mt-1 text-xs text-gray-500">We respond within one business day.</p>
              <Link href="/contact" className="mt-4 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0070e0]">
                Email us
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
