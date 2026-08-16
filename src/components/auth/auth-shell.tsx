import Link from "next/link";
import { CheckCircle2, PenLine, ShieldCheck, Star } from "lucide-react";

/**
 * Shared shell for /sign-in and /sign-up.
 *
 * Desktop: split layout — a quiet product panel on the left, the form on the
 * right. Mobile: form-first with a slim brand header.
 *
 * The previous version was a blue gradient with glow blobs, a dot grid, and a
 * "Trusted by indie studios shipping millions of reviews a year" line over
 * four invented user avatars. The gradient was the stock AI-generated look,
 * and the trust line was fiction — the product has no customers yet. What
 * replaced it is the same honest demonstration the landing page uses: a real
 * review and the reply the product drafts for it. Show, don't claim.
 */

interface AuthShellProps {
  heading: string;
  subheading: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const VALUE_PROPS = [
  {
    icon: CheckCircle2,
    title: "Every review in one inbox",
    body: "Google Play and App Store in one queue you can filter, tag, and work through.",
  },
  {
    icon: PenLine,
    title: "Replies drafted in your voice",
    body: "Grounded in your templates and knowledge base. You edit, you send.",
  },
  {
    icon: ShieldCheck,
    title: "Bad releases caught early",
    body: "A cluster of 1-star reviews on one version raises an alert while a fix can still ship.",
  },
];

function DemoCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-sm)]">
      <div className="border-b border-[var(--rb-border-1)] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rb-eyebrow text-fg-3">
            App Store · v4.2.1
          </span>
          <span
            role="img"
            aria-label="1 out of 5 stars"
            className="inline-flex items-center gap-px"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={i === 0 ? "size-3 text-[var(--rb-amber-500)]" : "size-3 text-fg-3"}
                fill={i === 0 ? "currentColor" : "none"}
                strokeWidth={i === 0 ? 0 : 1.5}
              />
            ))}
          </span>
        </div>
        <p className="mt-2 text-[13px] font-semibold text-fg-1">Crashes on iPad after 4.2.1</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-2">
          Every time I open the budgets tab on iPad it freezes. I use this daily
          for my small business.
        </p>
      </div>
      <div className="bg-[var(--rb-bg-sunken)] p-4">
        <span className="rb-eyebrow text-fg-3">
          Suggested reply
        </span>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-1">
          Thanks for flagging the iPad freeze on 4.2.1. We reproduced it this
          morning and a fix is rolling out this week. I&apos;ll follow up here the
          moment it lands.
        </p>
      </div>
    </div>
  );
}

export function AuthShell({ heading, subheading, children, footer }: AuthShellProps) {
  return (
    // data-theme="light" pins the auth screens to the light palette they were
    // designed for. The shell reads --rb-* tokens, but Clerk's form is styled
    // with fixed light colours on a transparent card (CLERK_APPEARANCE) — so a
    // signed-out user with dark mode on got a dark shell under near-black field
    // labels, i.e. an invisible "Email address" / "Password" on the first
    // screen of the product. Re-declaring the tokens here keeps the two halves
    // in agreement without touching Clerk's own styling.
    <div data-theme="light" className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      {/* ── Left: product panel ─────────────────────────────────────────────── */}
      <aside className="hidden flex-col justify-between border-r border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-12 lg:flex lg:w-[52%] xl:p-16">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--rb-blue-500)]">
            <span className="text-[13px] font-bold tracking-tight text-white">R</span>
          </div>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg-1">
            ReviewBox
          </span>
        </Link>

        <div className="max-w-[440px]">
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.022em] text-fg-1 xl:text-[32px]">
            Stop managing app reviews in a spreadsheet.
          </h2>
          <div className="mt-8">
            <DemoCard />
          </div>
          <ul className="mt-9 space-y-4">
            {VALUE_PROPS.map((vp) => (
              <li key={vp.title} className="flex gap-3">
                <vp.icon className="mt-0.5 size-4 shrink-0 text-fg-3" strokeWidth={1.5} />
                <div>
                  <span className="text-[13.5px] font-medium text-fg-1">{vp.title}</span>
                  <span className="ml-1.5 text-[13px] text-fg-3">{vp.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] text-fg-3">
          14-day trial · no credit card · cancel from one screen
        </p>
      </aside>

      {/* ── Right: form ─────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col bg-[var(--rb-bg-canvas)]">
        {/* Mobile-only brand bar */}
        <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] bg-surface px-5 py-3.5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--rb-blue-500)]">
              <span className="text-[12px] font-bold text-white">R</span>
            </div>
            <span className="text-[14px] font-semibold text-fg-1">ReviewBox</span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[400px]">
            <div className="mb-7">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg-1">
                {heading}
              </h1>
              <p className="mt-1.5 text-[14px] text-fg-3">{subheading}</p>
            </div>

            {children}

            {footer && (
              <div className="mt-6 text-center text-[13px] text-fg-3">{footer}</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-[var(--rb-border-1)] bg-surface px-5 py-3.5 text-[12px] text-fg-3">
          <Link href="https://tryreviewbox.com/terms" className="hover:text-fg-1">
            Terms
          </Link>
          <Link href="https://tryreviewbox.com/privacy" className="hover:text-fg-1">
            Privacy
          </Link>
          <Link href="https://tryreviewbox.com/help" className="hover:text-fg-1">
            Help
          </Link>
          <span className="text-fg-3">&copy; {new Date().getFullYear()} ReviewBox</span>
        </div>
      </main>
    </div>
  );
}
