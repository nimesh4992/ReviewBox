import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";
import {
  COMPANY,
  companyLine,
  formatRegisteredOffice,
  orPending,
} from "@/lib/legal/company";

export const metadata = {
  alternates: { canonical: "/grievance" },
  title: "Grievance Redressal",
  description:
    "How to raise a complaint with ReviewBox, who handles it, and the timelines we commit to.",
};

const SECTIONS = [
  { id: "how-to-complain", title: "How to raise a complaint" },
  { id: "officer", title: "Grievance Officer" },
  { id: "timelines", title: "Our timelines" },
  { id: "what-to-include", title: "What to include" },
  { id: "scope", title: "What this covers" },
  { id: "escalation", title: "If you are still not satisfied" },
];

/**
 * Publishing a named Grievance Officer with contact details and resolution
 * timelines is a statutory obligation for an entity operating a digital service
 * in India, not a customer-service nicety — and it is separately expected by
 * payment processors reviewing an Indian business. The named officer and the
 * postal address come from src/lib/legal/company.ts; until the founder fills
 * those in, this page states plainly that they are pending rather than
 * inventing a person.
 */
export default function GrievancePage() {
  const officer = COMPANY.grievanceOfficer;

  return (
    <LegalPageLayout
      title="Grievance Redressal"
      breadcrumbLabel="Grievance Redressal"
      currentHref="/grievance"
      effectiveDate="2026-08-15"
      jurisdiction="India"
      version="1.0"
      plainLanguage={[
        "If something has gone wrong, email us and a named person is responsible for resolving it.",
        "We acknowledge every complaint within 48 hours.",
        "We aim to resolve complaints within 7 days, and will tell you if something needs longer.",
        "This process is in addition to your legal rights, not a replacement for them.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="how-to-complain" number={1} title="How to raise a complaint">
        <p>
          If you have a complaint about {COMPANY.tradingAs} — the service, a charge, how we handle
          your data, or content on the platform — email{" "}
          <a
            href={`mailto:${COMPANY.emails.grievance}`}
            className="text-[#0A84FF] hover:underline"
          >
            {COMPANY.emails.grievance}
          </a>
          . Every message to that address reaches the Grievance Officer named below.
        </p>
        <p>
          You do not need to use any particular form of words, and you do not need an account to
          complain.
        </p>
      </LegalSection>

      <LegalSection id="officer" number={2} title="Grievance Officer">
        {officer ? (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900">{officer.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Designation</dt>
                <dd className="text-gray-900">{officer.designation}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Email</dt>
                <dd>
                  <a href={`mailto:${officer.email}`} className="text-[#0A84FF] hover:underline">
                    {officer.email}
                  </a>
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-gray-500">Address</dt>
                <dd className="text-gray-900">{officer.address}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            <p className="font-medium">The Grievance Officer&rsquo;s details are being published.</p>
            <p className="mt-2">
              In the meantime, complaints sent to{" "}
              <a
                href={`mailto:${COMPANY.emails.grievance}`}
                className="font-medium underline"
              >
                {COMPANY.emails.grievance}
              </a>{" "}
              are monitored and follow the same timelines set out below.
            </p>
          </div>
        )}

        <p>
          Complaints are handled by {companyLine()}, whose principal place of business is at{" "}
          {formatRegisteredOffice()}.
        </p>
      </LegalSection>

      <LegalSection id="timelines" number={3} title="Our timelines">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Acknowledgement within 48 hours.</strong> You receive confirmation that your
            complaint has been received, with a reference you can quote.
          </li>
          <li>
            <strong>Resolution within 7 days.</strong> We aim to resolve every complaint within
            seven days of receiving it.
          </li>
          <li>
            <strong>If it takes longer.</strong> Some issues need more time — for example where a
            third-party app store is involved. If so, we tell you before the seven days are up, say
            why, and give you a revised date.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="what-to-include" number={4} title="What to include">
        <p>You will get a faster answer if your email includes:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>The email address on your ReviewBox account, if you have one.</li>
          <li>What happened, and what you expected to happen instead.</li>
          <li>For billing complaints: the charge date and amount.</li>
          <li>For data complaints: which data you are asking about.</li>
          <li>Screenshots, if they help show the problem.</li>
        </ul>
      </LegalSection>

      <LegalSection id="scope" number={5} title="What this covers">
        <p>
          This process covers complaints about the service and about how we handle your personal
          data, including requests to access, correct, or erase it, and complaints about how we
          responded to such a request.
        </p>
        <p>
          Requests about your personal data are also covered by our{" "}
          <a href="/privacy" className="text-[#0A84FF] hover:underline">
            Privacy Policy
          </a>
          , billing complaints by our{" "}
          <a href="/refund-policy" className="text-[#0A84FF] hover:underline">
            Refund &amp; Cancellation Policy
          </a>
          , and reports of misuse of the platform by our{" "}
          <a href="/acceptable-use" className="text-[#0A84FF] hover:underline">
            Acceptable Use Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection id="escalation" number={6} title="If you are still not satisfied">
        <p>
          If we have not resolved your complaint within the timelines above, or you are unhappy with
          the outcome, reply to the acknowledgement asking for it to be escalated and it will be
          reviewed again at a senior level.
        </p>
        <p>
          This process does not take away any right you have to approach a consumer forum, a data
          protection authority, or any other body with jurisdiction over your complaint.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
