import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Revi",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: May 10, 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-gray-700">
            {/* 1 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                1. Acceptance of Terms
              </h2>
              <p className="mt-3">
                By accessing or using Revi (&ldquo;the Service&rdquo;), you agree to be
                bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not
                agree to these Terms, you may not access or use the Service. These
                Terms constitute a legally binding agreement between you and Revi
                (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;).
              </p>
            </section>

            {/* 2 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                2. Description of Service
              </h2>
              <p className="mt-3">
                Revi is an AI-powered review management platform that aggregates,
                analyzes, and helps teams respond to app store reviews from Google
                Play and the Apple App Store. Features include a unified review
                feed, AI-generated reply drafts, crash detection, release health
                monitoring, and incident alerting.
              </p>
            </section>

            {/* 3 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                3. Account Registration
              </h2>
              <p className="mt-3">
                To use the Service you must create an account and provide accurate,
                complete information. You are responsible for maintaining the
                confidentiality of your credentials and for all activity that occurs
                under your account. You must promptly notify us of any unauthorized
                use by emailing{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>
                . You must be at least 16 years old to create an account.
              </p>
            </section>

            {/* 4 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                4. Subscription and Payment
              </h2>
              <p className="mt-3">
                Revi offers three paid subscription tiers billed monthly:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <strong>Starter — $49/month:</strong> Up to 2 apps, 5,000
                  reviews/month, email alerts, 50 AI drafts/day.
                </li>
                <li>
                  <strong>Pro — $99/month:</strong> Up to 10 apps, 50,000
                  reviews/month, Slack alerts, 200 AI drafts/day.
                </li>
                <li>
                  <strong>Team — $199/month:</strong> Unlimited apps, reviews, AI
                  drafts, and priority support.
                </li>
              </ul>
              <p className="mt-3">
                All new accounts include a 14-day free trial with full Pro-tier
                access. No credit card is required to begin a trial. After the trial
                period, a subscription is required to continue using the Service.
                Payments are processed securely via Stripe. Subscriptions renew
                automatically and you may cancel at any time from your billing
                settings; cancellation takes effect at the end of the current billing
                period. We do not issue pro-rated refunds for partial months.
              </p>
            </section>

            {/* 5 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                5. Acceptable Use
              </h2>
              <p className="mt-3">You agree not to:</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  Use the AI draft feature to generate spam, misleading content, or
                  reviews that violate Google Play or Apple App Store policies.
                </li>
                <li>
                  Resell, sublicense, or redistribute access to the Service or its
                  API without our prior written consent.
                </li>
                <li>
                  Attempt to reverse-engineer, decompile, or extract the underlying
                  AI models or proprietary algorithms.
                </li>
                <li>
                  Use automated scripts to exceed normal usage limits or circumvent
                  rate limiting.
                </li>
                <li>
                  Upload or process data that you do not have the legal right to
                  access or share.
                </li>
              </ul>
              <p className="mt-3">
                We reserve the right to suspend or terminate accounts that violate
                these rules without prior notice.
              </p>
            </section>

            {/* 6 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                6. Data and Privacy
              </h2>
              <p className="mt-3">
                Our collection and use of your personal data is governed by our{" "}
                <Link href="/privacy" className="text-[#5B5BD6] hover:underline">
                  Privacy Policy
                </Link>
                , which is incorporated into these Terms by reference. By using the
                Service, you consent to the data practices described in the Privacy
                Policy.
              </p>
            </section>

            {/* 7 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                7. Intellectual Property
              </h2>
              <p className="mt-3">
                Revi and its licensors retain all right, title, and interest in the
                Service, including all software, designs, trademarks, and AI models.
                You retain ownership of the review data imported from your connected
                app store accounts. You grant us a limited, non-exclusive license to
                process that data solely to provide and improve the Service. You may
                not use our name, logo, or trademarks without written permission.
              </p>
            </section>

            {/* 8 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                8. Termination
              </h2>
              <p className="mt-3">
                Either party may terminate the agreement at any time. We may suspend
                or terminate your access immediately and without notice if we
                determine that you have violated these Terms, engaged in fraudulent
                activity, or pose a risk to the security or integrity of the Service.
                Upon termination, your right to access the Service ceases immediately.
                You may request an export of your data within 30 days of termination
                via{" "}
                <a
                  href="mailto:nssatikunvar@gmail.com"
                  className="text-[#5B5BD6] hover:underline"
                >
                  nssatikunvar@gmail.com
                </a>
                .
              </p>
            </section>

            {/* 9 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                9. Disclaimer of Warranties
              </h2>
              <p className="mt-3">
                THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
                AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
                INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
                THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
                HARMFUL COMPONENTS.
              </p>
            </section>

            {/* 10 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                10. Limitation of Liability
              </h2>
              <p className="mt-3">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, REVI AND ITS
                OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
                ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
                DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL, ARISING
                OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF ADVISED
                OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR
                ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL
                NOT EXCEED THE AMOUNTS YOU PAID US IN THE TWELVE (12) MONTHS
                PRECEDING THE CLAIM.
              </p>
            </section>

            {/* 11 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                11. Governing Law
              </h2>
              <p className="mt-3">
                These Terms are governed by and construed in accordance with the laws
                of the State of Delaware, United States, without regard to its
                conflict-of-law provisions. Any disputes arising from these Terms
                shall be resolved exclusively in the state or federal courts located
                in Delaware, and you consent to the personal jurisdiction of those
                courts.
              </p>
            </section>

            {/* 12 */}
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                12. Contact
              </h2>
              <p className="mt-3">
                If you have any questions about these Terms, please contact us at{" "}
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
