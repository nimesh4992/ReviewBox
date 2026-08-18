import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";
import { COMPANY, companyLine, entityDescription } from "@/lib/legal/company";

export const metadata = {
  alternates: { canonical: "/dpa" },
  title: "Data Processing Agreement",
  description: "ReviewBox DPA — GDPR-compliant data processing agreement for EEA and UK customers.",
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
        "For your review and reply data you are the Controller and we are the Processor, acting on your instructions.",
        "For your own account, billing and product-usage data we are an independent Controller — see the Privacy Policy.",
        "Sub-processors are listed in section 4. 14-day notice before any new one.",
        "Security measures and audit rights are in sections 5 and 6.",
        "This DPA is incorporated by reference into the main Terms of Service.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="scope" number={1} title="Parties and scope">
        <p>
          This Data Processing Agreement (the &ldquo;DPA&rdquo;) supplements the ReviewBox Terms
          of Service between {companyLine()}, {entityDescription()} (the
          &ldquo;Processor&rdquo;), and the customer (the
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
          The authoritative list is the /sub-processors page. It currently includes Supabase (database), Clerk
          (authentication), Stripe (billing), Groq (AI inference, no data retention), Google
          (AI inference), Resend (email), PostHog (analytics), Upstash (rate limiting).
        </p>
      </LegalSection>

      <LegalSection id="security" number={5} title="Security measures">
        <p>
          Processor implements and maintains the following technical and organisational measures:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Encryption of Customer Data in transit using TLS, and at rest by the database provider.</li>
          <li>
            Tenant isolation enforced by row-level security policies in the database, so a workspace
            can access only its own records.
          </li>
          <li>
            Access to production systems limited to personnel who require it, protected by
            multi-factor authentication.
          </li>
          <li>Credentials held in environment configuration and not committed to source control.</li>
          <li>Audit logging of privileged mutations within the application.</li>
        </ul>
        <p>
          Processor does not currently hold SOC 2, ISO 27001 or an equivalent certification and
          makes no representation that it does. Where a certification is obtained, this Addendum
          will be updated to identify it and the issuing auditor.
        </p>
      </LegalSection>

      <LegalSection id="audit" number={6} title="Audit rights">
        <p>
          Processor makes available to Controller the information reasonably necessary to
          demonstrate compliance with this Addendum, and responds to reasonable security
          questionnaires. Processor holds no third-party audit report at present, so none is
          offered; if one is obtained it will be made available on request under NDA.
        </p>
        <p>
          Controller may conduct an audit no more than once per calendar year, on 30 days&apos;
          notice, during business hours and at Controller&apos;s expense, subject to
          confidentiality obligations.
        </p>
      </LegalSection>

      <LegalSection id="transfers" number={7} title="International transfers">
        <p>
          Processor is established in {COMPANY.country}, which is not the subject of a European
          Commission adequacy decision, and engages sub-processors established outside the EEA.
          Customer Data protected by the GDPR is therefore transferred internationally.
        </p>
        <p>
          Where Customer Data protected by the GDPR is transferred to Processor, the Standard
          Contractual Clauses adopted by Commission Implementing Decision (EU) 2021/914 apply, with
          Module Two (controller to processor) governing the transfer between Controller and
          Processor, and Module Three (processor to processor) governing onward transfers to
          Processor&apos;s sub-processors. For transfers from the United Kingdom, the ICO&apos;s
          International Data Transfer Addendum to those Clauses applies; for Switzerland, the
          Clauses apply with the amendments required by Swiss law.
        </p>
        <p>
          Controller&apos;s acceptance of this Addendum constitutes execution of the applicable
          Clauses. The details required by their annexes — the parties, the categories of data
          subjects and personal data, the purposes of processing, the retention period, the
          technical and organisational measures, and the list of sub-processors — are those set out
          in this Addendum and on our{" "}
          <a href="/sub-processors" className="text-[#0A84FF] hover:underline">
            Sub-processors
          </a>{" "}
          page. A countersigned copy of the Clauses is available on request from{" "}
          <a href={`mailto:${COMPANY.emails.privacy}`} className="text-[#0A84FF] hover:underline">
            {COMPANY.emails.privacy}
          </a>
          .
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
