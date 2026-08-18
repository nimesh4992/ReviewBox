import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";

export const metadata = {
  alternates: { canonical: "/cookies" },
  title: "Cookie Policy",
  description: "ReviewBox Cookie Policy — what cookies we set, why, and how to manage them.",
};

const SECTIONS = [
  { id: "what-cookies-are",   title: "What cookies are" },
  { id: "categories",         title: "Categories we use" },
  { id: "cookies-we-set",     title: "Cookies we set" },
  { id: "managing",           title: "Managing cookies" },
  { id: "third-party",        title: "Third-party services" },
];

export default function CookiesPage() {
  return (
    <LegalPageLayout
      title="Cookie Policy"
      breadcrumbLabel="Cookie Policy"
      currentHref="/cookies"
      effectiveDate="2026-05-01"
      jurisdiction="Global"
      version="2.3"
      plainLanguage={[
        "We use essential cookies to keep you logged in and run the app.",
        "Analytics cookies (PostHog) help us improve the product — you can opt out.",
        "No advertising or tracking cookies. Full list of cookies in section 3.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="what-cookies-are" number={1} title="What cookies are">
        <p>
          Cookies are small text files placed on your device when you visit a website. They let us
          remember your preferences, keep you signed in, and understand how you use the service.
          ReviewBox also uses similar technologies including localStorage and sessionStorage.
        </p>
        <p>
          Some cookies are strictly necessary for the service to function. Others are optional and
          can be declined without affecting core functionality.
        </p>
      </LegalSection>

      <LegalSection id="categories" number={2} title="Categories we use">
        <p>
          <strong>Essential (necessary)</strong> — always on. These keep you logged in, maintain
          CSRF protection, and handle session data. The app cannot function without them.
        </p>
        <p>
          <strong>Functional</strong> — remember your preferences: dark/light mode, collapsed
          sidebar state, selected workspace. Session-scoped or 1-year expiry.
        </p>
        <p>
          <strong>Analytics</strong> — anonymous usage patterns via PostHog. Font: page
          views, feature usage, session replay (PII masked). 90-day retention. Disable by opting
          out in your account preferences or via our cookie banner.
        </p>
        <p>
          We do not use advertising cookies or sell data to third-party advertisers.
        </p>
      </LegalSection>

      <LegalSection id="cookies-we-set" number={3} title="Cookies we set">
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Purpose</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2">Expiry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { name: "__session", purpose: "Clerk auth session token", type: "Essential", expiry: "Session" },
                { name: "__client_uat", purpose: "Clerk user agent token", type: "Essential", expiry: "1 year" },
                { name: "__clerk_db_jwt", purpose: "Clerk JWT handshake", type: "Essential", expiry: "Session" },
                { name: "rb_theme", purpose: "Dark/light mode preference", type: "Functional", expiry: "1 year" },
                { name: "rb_workspace", purpose: "Last selected workspace", type: "Functional", expiry: "30 days" },
                { name: "ph_*", purpose: "PostHog analytics identifier", type: "Analytics", expiry: "1 year" },
                { name: "ph_session_*", purpose: "PostHog session recording", type: "Analytics", expiry: "Session" },
              ].map((row) => (
                <tr key={row.name}>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-700">{row.name}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.purpose}</td>
                  <td className="py-2 pr-4 text-gray-600">{row.type}</td>
                  <td className="py-2 text-gray-600">{row.expiry}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="managing" number={4} title="Managing cookies">
        <p>
          Decline optional cookies any time via the cookie banner shown on first visit, or via{" "}
          <strong>Settings → Privacy → Cookie preferences</strong> inside the app.
        </p>
        <p>
          You can also block or delete cookies through your browser settings. Note that blocking
          essential cookies will prevent you from signing in. Common browser guides:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <a
              href="https://support.google.com/chrome/answer/95647"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A84FF] hover:underline"
            >
              Chrome
            </a>
          </li>
          <li>
            <a
              href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A84FF] hover:underline"
            >
              Firefox
            </a>
          </li>
          <li>
            <a
              href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0A84FF] hover:underline"
            >
              Safari
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="third-party" number={5} title="Third-party services">
        <p>
          Unrelated third-party services may set their own cookies when you interact with embedded
          content or follow external links. ReviewBox does not control these cookies and they are
          governed by the respective third party&apos;s privacy and cookie policies.
        </p>
        <p>
          Services used: Clerk (authentication), PostHog (analytics), Stripe (billing — cookies
          only set on the checkout flow). Questions?{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
