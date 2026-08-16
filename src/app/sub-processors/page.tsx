import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";
import { COMPANY } from "@/lib/legal/company";

export const metadata = {
  title: "Sub-processors",
  description:
    "The third-party services ReviewBox uses to run the product, what each one receives, and how we notify you of changes.",
};

const SECTIONS = [
  { id: "list", title: "Current sub-processors" },
  { id: "ai", title: "How review text is used by AI providers" },
  { id: "transfers", title: "International transfers" },
  { id: "changes", title: "Notice of changes" },
];

/**
 * This list must match what the application actually calls. Two entries here —
 * Vercel and Sentry — were in production but had never been disclosed; a
 * sub-processor list that omits the host and the error tracker is worse than
 * none, because customers rely on it for their own compliance.
 *
 * If a service is added to the stack, it is added here in the same PR.
 */
const SUB_PROCESSORS = [
  {
    name: "Vercel",
    purpose: "Application hosting and content delivery",
    data: "All data in transit through the application, including review content and account data",
    location: "United States (global edge network)",
  },
  {
    name: "Supabase",
    purpose: "Primary database and file storage",
    data: "Review content and metadata, workspace and app records, reply drafts and published replies",
    location: "United States / EU, depending on project region",
  },
  {
    name: "Clerk",
    purpose: "Authentication and user session management",
    data: "Account email, name, authentication identifiers and session metadata",
    location: "United States",
  },
  {
    name: "Stripe",
    purpose: "Subscription billing and payment processing",
    data: "Billing name, billing address, email and payment method details (card data is handled by Stripe; we never receive full card numbers)",
    location: "United States, with local processing entities",
  },
  {
    name: "Groq",
    purpose: "AI inference for reply drafting",
    data: "Review text and your reply templates and knowledge-base entries, at the moment a draft is generated",
    location: "United States",
  },
  {
    name: "Google (Gemini API)",
    purpose: "AI inference for sentiment analysis and keyword suggestions",
    data: "Review text submitted for classification",
    location: "United States",
  },
  {
    name: "Upstash",
    purpose: "Redis cache and rate limiting",
    data: "Cached AI drafts keyed by content hash, rate-limit counters",
    location: "United States / EU, depending on database region",
  },
  {
    name: "Resend",
    purpose: "Transactional and notification email",
    data: "Recipient email address and the content of the email, which may summarise review activity",
    location: "United States",
  },
  {
    name: "Sentry",
    purpose: "Error monitoring and diagnostics",
    data: "Diagnostic data: stack traces, request paths, browser and device information, IP address and a user identifier",
    location: "United States",
  },
  {
    name: "PostHog",
    purpose: "Product analytics",
    data: "Usage events, page views, a user identifier and device information",
    location: "United States / EU, depending on instance region",
  },
];

export default function SubProcessorsPage() {
  return (
    <LegalPageLayout
      title="Sub-processors"
      breadcrumbLabel="Sub-processors"
      currentHref="/sub-processors"
      effectiveDate="2026-08-15"
      jurisdiction="India"
      version="1.0"
      plainLanguage={[
        "These are the outside services we use to run ReviewBox, and what each one receives.",
        "Review text is sent to AI providers only when a draft, sentiment score, or keyword suggestion is generated.",
        "Most of these providers are in the United States, so your data crosses borders.",
        "We publish changes here before a new sub-processor starts handling customer data.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="list" number={1} title="Current sub-processors">
        <p>
          {COMPANY.tradingAs} uses the third parties below to provide the service. Each has access
          only to the data needed for its function, and each is bound by a data processing
          agreement with us.
        </p>

        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-500">
                <th className="border-b border-gray-200 px-2 py-2 font-semibold">Provider</th>
                <th className="border-b border-gray-200 px-2 py-2 font-semibold">Purpose</th>
                <th className="border-b border-gray-200 px-2 py-2 font-semibold">Data it receives</th>
                <th className="border-b border-gray-200 px-2 py-2 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody>
              {SUB_PROCESSORS.map((s) => (
                <tr key={s.name} className="align-top">
                  <td className="border-b border-gray-100 px-2 py-3 font-medium text-gray-900">
                    {s.name}
                  </td>
                  <td className="border-b border-gray-100 px-2 py-3 text-gray-600">{s.purpose}</td>
                  <td className="border-b border-gray-100 px-2 py-3 text-gray-600">{s.data}</td>
                  <td className="border-b border-gray-100 px-2 py-3 text-gray-600">{s.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection id="ai" number={2} title="How review text is used by AI providers">
        <p>
          When you generate a reply draft, ReviewBox sends the review text — together with the
          templates and knowledge-base entries you have configured — to an AI provider so a draft
          can be written. Sentiment analysis and keyword suggestions work the same way. No review
          text is sent to an AI provider except to perform one of these actions.
        </p>
        <p>
          Reviews published on an app store are public, but they may still contain personal data
          about the person who wrote them. Treat this section as a description of where that text
          travels.
        </p>
        <p>
          We do not use your data to train our own models. Whether a given AI provider may use
          submitted content to improve its own services depends on that provider&rsquo;s terms and
          the plan we are on; where a provider offers a no-training or zero-retention configuration
          for the tier we use, we enable it.
        </p>
      </LegalSection>

      <LegalSection id="transfers" number={3} title="International transfers">
        <p>
          {COMPANY.legalName} is registered in {COMPANY.country}, and most of the providers listed
          above operate from the United States. Using ReviewBox therefore involves transferring
          data across borders.
        </p>
        <p>
          Where personal data protected by the GDPR or UK GDPR is transferred, we rely on Standard
          Contractual Clauses with the relevant provider. Our{" "}
          <a href="/dpa" className="text-[#0A84FF] hover:underline">
            Data Processing Addendum
          </a>{" "}
          sets out the terms that apply between us and customers.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={4} title="Notice of changes">
        <p>
          Before a new sub-processor begins handling customer personal data, we update this page.
          Customers with an executed DPA can ask to be notified by email of changes by writing to{" "}
          <a href={`mailto:${COMPANY.emails.privacy}`} className="text-[#0A84FF] hover:underline">
            {COMPANY.emails.privacy}
          </a>
          .
        </p>
        <p>
          If you object to a new sub-processor on reasonable data-protection grounds, contact us at
          the same address and we will discuss alternatives; if none is workable, you may cancel
          your subscription under the{" "}
          <a href="/refund-policy" className="text-[#0A84FF] hover:underline">
            Refund &amp; Cancellation Policy
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
