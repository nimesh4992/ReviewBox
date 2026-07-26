import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";

export const metadata = {
  title: "Privacy Policy",
  description: "ReviewBox Privacy Policy — how we collect, use, and protect your data.",
};

const SECTIONS = [
  { id: "collection",   title: "Information we collect" },
  { id: "use",          title: "How we use your information" },
  { id: "data-sharing", title: "Data sharing" },
  { id: "retention",    title: "Data retention" },
  { id: "rights",       title: "Your rights" },
  { id: "security",     title: "Security" },
  { id: "cookies",      title: "Cookies" },
  { id: "children",     title: "Children's privacy" },
  { id: "changes",      title: "Changes to this policy" },
  { id: "contact",      title: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      breadcrumbLabel="Privacy Policy"
      currentHref="/privacy"
      effectiveDate="2026-05-10"
      jurisdiction="Global"
      version="2.0"
      plainLanguage={[
        "We collect your account info, review data, and usage events. Nothing more.",
        "We don't sell your data. Ever.",
        "GDPR rights apply: export or delete your data any time.",
        "AES-256 at rest. TLS in transit. Row-level security per workspace.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="collection" number={1} title="Information we collect">
        <p>We collect the following categories of information:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Account information:</strong> Name, email address, and authentication data
            collected via Clerk when you register or sign in.
          </li>
          <li>
            <strong>App review data:</strong> Reviews, ratings, author names, device metadata,
            and version information imported from your connected Google Play or Apple App Store
            accounts via their respective APIs.
          </li>
          <li>
            <strong>Usage data:</strong> Pages visited, features used, session duration, and
            interactions within the Service, collected via PostHog.
          </li>
          <li>
            <strong>Payment information:</strong> Billing details processed and stored by Stripe.
            We do not store raw card numbers.
          </li>
          <li>
            <strong>Communication data:</strong> Emails or messages you send to our support
            address.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" number={2} title="How we use your information">
        <p>We use collected information to:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            Provide, operate, and maintain the Service, including syncing reviews, generating AI
            reply drafts, and detecting incidents.
          </li>
          <li>
            Improve and fine-tune our AI models using aggregated, anonymized review data. We do
            not use personally identifiable information for model training without explicit consent.
          </li>
          <li>
            Send operational alerts (email, Slack) based on your configured notification
            preferences.
          </li>
          <li>Process payments and manage your subscription via Stripe.</li>
          <li>Detect, prevent, and respond to security incidents or abuse.</li>
          <li>Comply with legal obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection id="data-sharing" number={3} title="Data sharing">
        <p>
          We do not sell your personal data. We share data only with the following trusted
          sub-processors to operate the Service:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Supabase</strong> — PostgreSQL database and file storage (EU region). Your
            review data and account data are stored here.
          </li>
          <li>
            <strong>Clerk</strong> — Authentication and user management. Handles sign-up,
            sign-in, and session tokens.
          </li>
          <li>
            <strong>Stripe</strong> — Payment processing. Receives billing details to manage
            subscriptions.
          </li>
          <li>
            <strong>Groq / Google (Gemini)</strong> — AI inference for generating reply drafts
            and sentiment analysis. Review text is sent for processing and is not retained beyond
            the request lifecycle.
          </li>
          <li>
            <strong>PostHog</strong> — Product analytics. Receives anonymized usage events.
          </li>
          <li>
            <strong>Resend</strong> — Transactional email delivery.
          </li>
          <li>
            <strong>Upstash</strong> — Redis rate limiting and caching.
          </li>
        </ul>
        <p>
          We may also disclose data if required by law, court order, or to protect the rights and
          safety of AT Work Inc. (ReviewBox) or its users.
        </p>
      </LegalSection>

      <LegalSection id="retention" number={4} title="Data retention">
        <p>
          App store reviews and associated metadata are retained for up to <strong>2 years</strong>{" "}
          from the date they are imported. Upon account cancellation or deletion, all personal
          data and review data associated with your account will be permanently deleted within
          30 days. Aggregated, anonymized statistics may be retained indefinitely for product
          improvement purposes.
        </p>
      </LegalSection>

      <LegalSection id="rights" number={5} title="Your rights">
        <p>
          If you are located in the European Economic Area (EEA) or United Kingdom, you have the
          following rights under GDPR:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Access:</strong> Request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong>Export:</strong> Download your data in a portable format via{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
              Settings → Privacy → Export data
            </code>
            .
          </li>
          <li>
            <strong>Deletion:</strong> Request erasure of your data via{" "}
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
              Settings → Privacy → Delete account
            </code>{" "}
            or by emailing us.
          </li>
          <li>
            <strong>Correction:</strong> Request correction of inaccurate personal data.
          </li>
          <li>
            <strong>Objection:</strong> Object to processing of your data for direct marketing
            purposes.
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
          . We will respond within 30 days.
        </p>
      </LegalSection>

      <LegalSection id="security" number={6} title="Security">
        <p>We implement industry-standard security measures to protect your data:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>All data is encrypted at rest using AES-256 and in transit using TLS 1.3.</li>
          <li>
            Database access is enforced with Row-Level Security (RLS) policies so that each
            workspace can only access its own data.
          </li>
          <li>
            Production access requires MFA, is logged, and is restricted to authorised personnel.
          </li>
          <li>Quarterly penetration tests and annual security training for all engineers.</li>
        </ul>
        <p>
          Despite these measures, no system is completely secure. Please notify us immediately at{" "}
          <a href="mailto:security@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            security@tryreviewbox.com
          </a>{" "}
          if you believe your account has been compromised.
        </p>
      </LegalSection>

      <LegalSection id="cookies" number={7} title="Cookies">
        <p>
          We use essential cookies (Clerk auth), functional cookies (preference storage), and
          optional analytics cookies (PostHog). We do not use advertising or tracking cookies.
          For the full list see our{" "}
          <a href="/cookies" className="text-[#0A84FF] hover:underline">
            Cookie Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="children" number={8} title="Children's privacy">
        <p>
          The Service is not directed to individuals under the age of 16. We do not knowingly
          collect personal data from children under 16. If you believe we have inadvertently
          collected data from a child, please contact us at{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>{" "}
          and we will delete it promptly.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={9} title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will notify you by email or by displaying a prominent notice within the Service at least
          14 days before the changes take effect. Your continued use of the Service after the
          effective date constitutes acceptance of the updated policy.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={10} title="Contact">
        <p>
          If you have questions about this Privacy Policy or our data practices, please contact
          us at{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
