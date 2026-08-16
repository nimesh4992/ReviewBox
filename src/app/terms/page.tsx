import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";
import { COMPANY, companyLine, entityDescription, formatRegisteredOffice, orPending } from "@/lib/legal/company";

export const metadata = {
  title: "Terms of Service",
  description: "ReviewBox Terms of Service — the rules governing your use of the platform.",
};

const SECTIONS = [
  { id: "acceptance",    title: "Acceptance of terms" },
  { id: "description",   title: "Description of service" },
  { id: "registration",  title: "Account registration" },
  { id: "payment",       title: "Subscription and payment" },
  { id: "acceptable",    title: "Acceptable use" },
  { id: "data",          title: "Data and privacy" },
  { id: "ip",            title: "Intellectual property" },
  { id: "termination",   title: "Termination" },
  { id: "warranties",    title: "Disclaimer of warranties" },
  { id: "liability",     title: "Limitation of liability" },
  { id: "governing-law", title: "Governing law" },
  { id: "contact",       title: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      breadcrumbLabel="Terms of Service"
      currentHref="/terms"
      effectiveDate="2026-05-10"
      jurisdiction="India"
      version="2.0"
      plainLanguage={[
        "By using ReviewBox you agree to these Terms. Read them — they matter.",
        "14-day free trial, no card required. Three paid tiers: Starter, Pro, Team.",
        "You own your review data. We process it only to provide the service.",
        "Questions? Email legal@tryreviewbox.com and we will answer.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="acceptance" number={1} title="Acceptance of terms">
        <p>
          By accessing or using ReviewBox (&ldquo;the Service&rdquo;), you agree to be bound by
          these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you
          may not access or use the Service. These Terms constitute a legally binding agreement
          between you and {companyLine()}, {entityDescription()}, with its principal
          place of business at {formatRegisteredOffice()} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;).
        </p>
      </LegalSection>

      <LegalSection id="description" number={2} title="Description of service">
        <p>
          ReviewBox is an AI-powered review management platform that aggregates, analyzes, and
          helps teams respond to app store reviews from Google Play and the Apple App Store.
          Features include a unified review feed, AI-generated reply drafts, crash detection,
          release health monitoring, and incident alerting.
        </p>
      </LegalSection>

      <LegalSection id="registration" number={3} title="Account registration">
        <p>
          To use the Service you must create an account and provide accurate, complete information.
          You are responsible for maintaining the confidentiality of your credentials and for all
          activity that occurs under your account. You must promptly notify us of any unauthorized
          use by emailing{" "}
          <a href="mailto:hello@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            hello@tryreviewbox.com
          </a>
          . You must be at least 16 years old to create an account.
        </p>
      </LegalSection>

      <LegalSection id="payment" number={4} title="Subscription and payment">
        <p>ReviewBox offers three paid subscription tiers billed monthly:</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>
            <strong>Starter — $49/month:</strong> Up to 2 apps, 5,000 reviews/month, email alerts,
            50 AI drafts/day.
          </li>
          <li>
            <strong>Pro — $99/month:</strong> Up to 10 apps, 50,000 reviews/month, Slack alerts,
            200 AI drafts/day.
          </li>
          <li>
            <strong>Team — $199/month:</strong> Unlimited apps, reviews, AI drafts, and priority
            support.
          </li>
        </ul>
        <p>
          All new accounts include a 14-day free trial with full Pro-tier access. No credit card
          is required to begin a trial. After the trial period, a subscription is required to
          continue using the Service. Payments are processed securely via Stripe. Subscriptions
          renew automatically and you may cancel at any time from your billing settings;
          cancellation takes effect at the end of the current billing period. See our{" "}
          <a href="/refund" className="text-[#0A84FF] hover:underline">
            Refund Policy
          </a>{" "}
          for details on refunds.
        </p>
      </LegalSection>

      <LegalSection id="acceptable" number={5} title="Acceptable use">
        <p>
          You agree not to use the AI draft feature to generate spam, misleading content, or
          replies that violate Google Play or Apple App Store policies; resell or sublicense
          access without our written consent; reverse-engineer our AI models or proprietary
          algorithms; use automated scripts to circumvent rate limiting; or upload data you do not
          have the legal right to access or share.
        </p>
        <p>
          Full details are in our{" "}
          <a href="/acceptable-use" className="text-[#0A84FF] hover:underline">
            Acceptable Use Policy
          </a>
          , incorporated herein by reference. We reserve the right to suspend or terminate
          accounts that violate these rules without prior notice.
        </p>
      </LegalSection>

      <LegalSection id="data" number={6} title="Data and privacy">
        <p>
          Our collection and use of your personal data is governed by our{" "}
          <a href="/privacy" className="text-[#0A84FF] hover:underline">
            Privacy Policy
          </a>
          , which is incorporated into these Terms by reference. By using the Service, you consent
          to the data practices described in the Privacy Policy.
        </p>
        <p>
          Customers subject to the GDPR or UK GDPR should also review our{" "}
          <a href="/dpa" className="text-[#0A84FF] hover:underline">
            Data Processing Agreement
          </a>
          , which governs our role as Processor of Customer Data.
        </p>
      </LegalSection>

      <LegalSection id="ip" number={7} title="Intellectual property">
        <p>
          ReviewBox and its licensors retain all right, title, and interest in the Service,
          including all software, designs, trademarks, and AI models. You retain ownership of the
          review data imported from your connected app store accounts. You grant us a limited,
          non-exclusive license to process that data solely to provide and improve the Service.
          You may not use our name, logo, or trademarks without written permission.
        </p>
      </LegalSection>

      <LegalSection id="termination" number={8} title="Termination">
        <p>
          Either party may terminate the agreement at any time. We may suspend or terminate your
          access immediately and without notice if we determine that you have violated these Terms,
          engaged in fraudulent activity, or pose a risk to the security or integrity of the
          Service. Upon termination, your right to access the Service ceases immediately. You may
          request an export of your data within 30 days of termination via{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="warranties" number={9} title="Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
          WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL
          COMPONENTS.
        </p>
      </LegalSection>

      <LegalSection id="liability" number={10} title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY.legalName.toUpperCase()} AND ITS OFFICERS,
          DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR
          GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE, EVEN IF ADVISED
          OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING
          FROM THESE TERMS OR YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNTS YOU PAID US IN
          THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" number={11} title="Governing law">
        <p>
          These Terms are governed by and construed in accordance with the laws of India, without
          regard to conflict-of-law principles. Subject to the paragraph below, the courts at{" "}
          {orPending(COMPANY.jurisdiction.courts)}, India shall have exclusive jurisdiction over any
          dispute arising out of or in connection with these Terms.
        </p>
        <p>
          Nothing in this clause removes any protection available to you as a consumer under the
          law of the country in which you live, including any right to bring proceedings in your
          local courts where that right cannot be excluded by agreement.
        </p>
        <p>
          Before commencing proceedings, we ask that you raise the matter through our{" "}
          <a href="/grievance" className="text-[#0A84FF] hover:underline">
            grievance redressal process
          </a>
          , which commits us to acknowledge within 48 hours and to aim to resolve within 7 days.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={12} title="Contact">
        <p>
          If you have any questions about these Terms, please contact us at{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
