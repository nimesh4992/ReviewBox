import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";

export const metadata = {
  title: "Data Processing Agreement â€” ReviewBox",
  description: "ReviewBox DPA â€” GDPR-compliant data processing agreement for EEA and UK customers.",
};

const SECTIONS = [
  { id: "scope",          title: "Parties and scope" },
  { id: "roles",          title: "Roles and responsibilities" },
  { id: "confidentiality", title: "Confidentiality" },
  { id: "subprocessors",  title: "Sub-processors" },
  { id: "security",       title: "Security measures" },
  { id: "audit",          title: "Audit rights" },
  { id: "transfers",      title: "International transfers" },
  { id: "breach",         title: "Personal-data breach notification" },
  { id: "deletion",       title: "Data return and deletion" },
  { id: "liability",      title: "Liability" },
];

export default function DpaPage() {
  return (
    <LegalPageLayout
      title="Data Processing Agreement"
      breadcrumbLabel="DPA"
      currentHref="/dpa"
      effectiveDate="2026-05-01"
      jurisdiction="EEA / UK"
      version="4.0"
      plainLanguage={[
        "You're the Controller. We're the Processor. We process Customer Data on your written instructions.",
        "Sub-processors are listed in section 4. 14-day notice before any new one.",
        "Security measures and audit rights are in sections 5 and 6.",
        "This DPA is incorporated by reference into the main Terms of Service.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="scope" number={1} title="Parties and scope">
        <p>
          This Data Processing Agreement (the &ldquo;DPA&rdquo;) supplements the ReviewBox Terms
          of Service between AT Work Inc., trading as ReviewBox (the &ldquo;Processor&rdquo;) and the customer (the
          &ldquo;Controller&rdquo;).
        </p>
        <p>
          It applies whenever the Processor processes personal data on behalf of the Controller in
          the EEA, UK, or Switzerland.
        </p>
        <p>
          Categories of data subjects: end users of Controller&apos;s mobile applications (review
          authors). Categories of personal data: review content, author handles, device/locale
          metadata, ratings.
        </p>
      </LegalSection>

      <LegalSection id="roles" number={2} title="Roles and responsibilities">
        <p>
          Controller determines the purposes and means of processing. Processor processes Customer
          Data only on documented instructions from Controller, except as required by law.
        </p>
        <p>
          Processor shall promptly inform Controller if, in its opinion, an instruction infringes
          applicable data protection law.
        </p>
      </LegalSection>

      <LegalSection id="confidentiality" number={3} title="Confidentiality">
        <p>
          Processor ensures persons authorised to process Customer Data are bound by
          confidentiality (employment contract, NDA) and are limited to those who need access to
          perform the services.
        </p>
      </LegalSection>

      <LegalSection id="subprocessors" number={4} title="Sub-processors">
        <p>
          Controller grants general authorisation for the sub-processors listed at{" "}
          <a href="/privacy#data-sharing" className="text-[#0A84FF] hover:underline">
            /sub-processors
          </a>
          . Processor notifies Controller of any intended new sub-processor at least 14 days in
          advance; Controller may object on reasonable grounds.
        </p>
        <p>
          Current authorised sub-processors: Supabase (database, EU region), Clerk
          (authentication), Stripe (billing), Groq (AI inference, no data retention), Google
          (AI inference), Resend (email), PostHog (analytics), Upstash (rate limiting).
        </p>
      </LegalSection>

      <LegalSection id="security" number={5} title="Security measures">
        <p>
          AES-256 at rest. TLS 1.3 in transit. Workspace isolation enforced via row-level
          security in the database. Quarterly penetration tests. Key rotation every 90 days.
          SOC 2 Type II in progress.
        </p>
        <p>
          Access to production systems is restricted to authorised personnel, requires MFA, and is
          logged. Processor conducts annual security training for all employees with access to
          Customer Data.
        </p>
      </LegalSection>

      <LegalSection id="audit" number={6} title="Audit rights">
        <p>
          Processor provides Controller with current SOC 2 report on request, under NDA. Controller
          may conduct an audit no more than once per calendar year, with 30 days&apos; notice,
          during business hours, and at Controller&apos;s expense.
        </p>
        <p>
          Processor may satisfy audit requests by providing its most recent third-party audit report
          or security questionnaire responses where these reasonably address the Controller&apos;s
          concerns.
        </p>
      </LegalSection>

      <LegalSection id="transfers" number={7} title="International transfers">
        <p>
          Where Processor transfers Customer Data outside the EEA/UK, the Standard Contractual
          Clauses (Decision 2021/914) apply, attached as Annex II.
        </p>
        <p>
          For transfers to the United Kingdom, the International Data Transfer Agreement (IDTA)
          applies. Controller&apos;s execution of this DPA constitutes execution of the applicable
          transfer mechanism.
        </p>
      </LegalSection>

      <LegalSection id="breach" number={8} title="Personal-data breach notification">
        <p>
          Processor notifies Controller without undue delay (and in any event within 72 hours of
          becoming aware) of a personal data breach, including the nature of the breach, affected
          data subjects, likely consequences, and mitigation steps.
        </p>
        <p>
          Processor maintains a register of all personal data breaches, whether or not notification
          is required, and makes it available to Controller on request.
        </p>
      </LegalSection>

      <LegalSection id="deletion" number={9} title="Data return and deletion">
        <p>
          Upon termination of the agreement or Controller&apos;s written request, Processor will
          delete or return all Customer Data within 30 days, at Controller&apos;s choice, and
          provide written certification of deletion.
        </p>
        <p>
          Processor may retain Customer Data where required by applicable law, for the minimum
          period required, and will inform Controller of any such retention.
        </p>
      </LegalSection>

      <LegalSection id="liability" number={10} title="Liability">
        <p>
          Each party&apos;s liability under this DPA is subject to the limitations set out in the
          main Terms of Service, except to the extent that applicable law prohibits such
          limitations in the context of data protection obligations.
        </p>
        <p>
          Questions about this DPA?{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
