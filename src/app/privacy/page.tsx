import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Revi",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <div className="mx-auto max-w-3xl">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
        >
          ← Back to Revi
        </Link>

        <div className="mt-8 rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-gray-200 sm:px-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: May 10, 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-gray-700">
            {/* 1 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                1. Information We Collect
              </h2>
              <p className="mt-3">We collect the following categories of information:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Account information:</strong> Name, email address, and
                  authentication data collected via Clerk when you register or sign
                  in.
                </li>
                <li>
                  <strong>App review data:</strong> Reviews, ratings, author names,
                  device metadata, and version information imported from your
                  connected Google Play or Apple App Store accounts via their
                  respective APIs.
                </li>
                <li>
                  <strong>Usage data:</strong> Pages visited, features used,
                  session duration, and interactions within the Service, collected
                  via PostHog.
                </li>
                <li>
                  <strong>Payment information:</strong> Billing details processed
                  and stored by Stripe. We do not store raw card numbers.
                </li>
                <li>
                  <strong>Communication data:</strong> Emails or messages you send
                  to our support address.
                </li>
              </ul>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                2. How We Use Your Information
              </h2>
              <p className="mt-3">We use collected information to:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  Provide, operate, and maintain the Service, including syncing
                  reviews, generating AI reply drafts, and detecting incidents.
                </li>
                <li>
                  Improve and fine-tune our AI models using aggregated, anonymized
                  review data. We do not use personally identifiable information for
                  model training without explicit consent.
                </li>
                <li>
                  Send operational alerts (email, Slack) based on your configured
                  notification preferences.
                </li>
                <li>
                  Process payments and manage your subscription via Stripe.
                </li>
                <li>
                  Detect, prevent, and respond to security incidents or abuse.
                </li>
                <li>
                  Comply with legal obligations.
                </li>
              </ul>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                3. Data Sharing
              </h2>
              <p className="mt-3">
                We do not sell your personal data. We share data only with the
                following trusted sub-processors to operate the Service:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Supabase</strong> — PostgreSQL database and file
                  storage (hosted on AWS). Your review data and account data are
                  stored here.
                </li>
                <li>
                  <strong>Clerk</strong> — Authentication and user management.
                  Handles sign-up, sign-in, and session tokens.
                </li>
                <li>
                  <strong>Stripe</strong> — Payment processing. Receives billing
                  details to manage subscriptions.
                </li>
                <li>
                  <strong>Groq / Anthropic</strong> — AI inference for generating
                  reply drafts. Review text is sent to these providers for
                  processing and is not stored by them beyond the request lifecycle.
                </li>
                <li>
                  <strong>PostHog</strong> — Product analytics. Receives anonymized
                  usage events.
                </li>
                <li>
                  <strong>Resend</strong> — Transactional email delivery.
                </li>
              </ul>
              <p className="mt-3">
                We may also disclose data if required by law, court order, or to
                protect the rights and safety of Revi or its users.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                4. Data Retention
              </h2>
              <p className="mt-3">
                App store reviews and associated metadata are retained for up to{" "}
                <strong>2 years</strong> from the date they are imported. Upon
                account cancellation or deletion, all personal data and review data
                associated with your account will be permanently deleted within 30
                days. Aggregated, anonymized statistics may be retained indefinitely
                for product improvement purposes.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                5. Your Rights
              </h2>
              <p className="mt-3">
                If you are located in the European Economic Area (EEA) or United
                Kingdom, you have the following rights under GDPR:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Access:</strong> Request a copy of the personal data we
                  hold about you.
                </li>
                <li>
                  <strong>Export:</strong> Download your data in a portable format
                  via{" "}
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                    /api/gdpr/export
                  </code>
                  .
                </li>
                <li>
                  <strong>Deletion:</strong> Request erasure of your data via{" "}
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                    /api/gdpr/delete
                  </code>{" "}
                  or by emailing us.
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate
                  personal data.
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing of your data for
                  direct marketing purposes.
                </li>
              </ul>
              <p className="mt-3">
                To exercise any of these rights, email{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>
                . We will respond within 30 days.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                6. Security
              </h2>
              <p className="mt-3">
                We implement industry-standard security measures to protect your
                data:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  All data is encrypted at rest using AES-256 and in transit using
                  TLS 1.2+.
                </li>
                <li>
                  Database access is enforced with Row-Level Security (RLS) policies
                  so that each account can only access its own data.
                </li>
                <li>
                  API keys and secrets are stored as environment variables and never
                  exposed to the client.
                </li>
              </ul>
              <p className="mt-3">
                Despite these measures, no system is completely secure. Please
                notify us immediately at{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>{" "}
                if you believe your account has been compromised.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                7. Cookies
              </h2>
              <p className="mt-3">We use the following types of cookies:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Session cookies (Clerk):</strong> Required for
                  authentication. These are set when you sign in and cleared when
                  you sign out or your session expires.
                </li>
                <li>
                  <strong>Analytics cookies (PostHog):</strong> Used to understand
                  how users interact with the product so we can improve it. You can
                  opt out via PostHog&apos;s opt-out mechanism.
                </li>
              </ul>
              <p className="mt-3">
                We do not use advertising or tracking cookies. We do not share
                cookie data with third-party advertisers.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                8. Children&apos;s Privacy
              </h2>
              <p className="mt-3">
                The Service is not directed to individuals under the age of 16. We
                do not knowingly collect personal data from children under 16. If
                you believe we have inadvertently collected data from a child, please
                contact us immediately at{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>{" "}
                and we will delete it promptly.
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                9. Changes to This Policy
              </h2>
              <p className="mt-3">
                We may update this Privacy Policy from time to time. When we make
                material changes, we will notify you by email or by displaying a
                prominent notice within the Service at least 14 days before the
                changes take effect. Your continued use of the Service after the
                effective date constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                10. Contact
              </h2>
              <p className="mt-3">
                If you have questions about this Privacy Policy or our data
                practices, please contact us at{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
