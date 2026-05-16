import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";

export const metadata = {
  title: "Acceptable Use Policy — ReviewBox",
  description: "ReviewBox Acceptable Use Policy — rules for using the platform responsibly.",
};

const SECTIONS = [
  { id: "prohibited",   title: "Prohibited activities" },
  { id: "replying",     title: "Replying on behalf of others" },
  { id: "ai-drafting",  title: "AI drafting" },
  { id: "security",     title: "Security testing" },
  { id: "rate-limits",  title: "Rate limits" },
  { id: "enforcement",  title: "Enforcement" },
  { id: "appeals",      title: "Appeals" },
];

export default function AcceptableUsePage() {
  return (
    <LegalPageLayout
      title="Acceptable Use Policy"
      breadcrumbLabel="Acceptable Use"
      currentHref="/acceptable-use"
      effectiveDate="2026-05-01"
      jurisdiction="Global"
      version="3.0"
      plainLanguage={[
        "Don't break the law with our product. Don't break our product.",
        "No spam, no malware, no impersonation, no harassment.",
        "Reasonable API rate limits apply — see section 5.",
        "Violations can suspend your workspace within 24 hours.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="prohibited" number={1} title="Prohibited activities">
        <p>
          You may not use ReviewBox to violate any law, infringe intellectual property, transmit
          malware or spam, harass, threaten, or impersonate; circumvent platform policies of Apple
          or Google; or scrape data we haven&apos;t authorised you to access.
        </p>
        <p>
          You may not resell or sublicense access to ReviewBox without a written reseller agreement.
          You may not use the service to build a competing product or to benchmark it publicly
          without our written consent.
        </p>
      </LegalSection>

      <LegalSection id="replying" number={2} title="Replying on behalf of others">
        <p>
          You must have authority to reply to the reviews of the apps you connect. Replying to
          reviews of an app you don&apos;t own — even if you have the credentials — violates this
          policy.
        </p>
        <p>
          All replies published through ReviewBox are attributed to your developer account. You are
          solely responsible for the content of replies submitted through the platform.
        </p>
      </LegalSection>

      <LegalSection id="ai-drafting" number={3} title="AI drafting">
        <p>
          Always review AI-generated drafts before posting. We are not responsible for content you
          publish. Do not use AI drafts to mislead reviewers about facts.
        </p>
        <p>
          AI-generated replies must comply with Apple App Store and Google Play developer response
          policies. You must not use AI drafts to post replies that are off-topic, contain
          promotional content not related to the review, or make claims that are factually
          inaccurate.
        </p>
      </LegalSection>

      <LegalSection id="security" number={4} title="Security testing">
        <p>
          Vulnerability research is welcome under the bug-bounty program at{" "}
          <a href="mailto:security@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            security@tryreviewbox.com
          </a>
          . Outside of that, do not probe, attack, or stress-test the service.
        </p>
        <p>
          Automated vulnerability scanning, penetration testing, or load testing against ReviewBox
          infrastructure without prior written permission is prohibited and may result in immediate
          account suspension and legal action.
        </p>
      </LegalSection>

      <LegalSection id="rate-limits" number={5} title="Rate limits">
        <p>
          API: 1,000 requests per workspace per minute. WebSocket delivery: 100/s. Burst is
          allowed; sustained abuse is not. Need more? Email{" "}
          <a href="mailto:hello@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            hello@tryreviewbox.com
          </a>{" "}
          and we&apos;ll work something out.
        </p>
        <p>
          Programmatic reply submission is limited to 50 replies per hour per app to comply with
          Google Play and App Store Connect API quotas. Exceeding these limits may cause sync
          failures and temporary disabling of the reply feature.
        </p>
      </LegalSection>

      <LegalSection id="enforcement" number={6} title="Enforcement">
        <p>
          On detection of a violation, we may suspend the workspace within 24 hours and notify you
          at the registered email address. Severe violations (legal threats, malware distribution,
          deliberate API abuse) may result in immediate permanent termination without notice.
        </p>
        <p>
          We will always attempt to contact you before taking action unless the violation poses an
          immediate risk to other users or our infrastructure. Suspension does not affect your right
          to export your data.
        </p>
      </LegalSection>

      <LegalSection id="appeals" number={7} title="Appeals">
        <p>
          To appeal a suspension, email{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>{" "}
          with subject line &ldquo;AUP Appeal&rdquo;. We respond within one business day.
        </p>
        <p>
          Appeals are reviewed by a member of the leadership team who was not involved in the
          original enforcement decision. If your appeal is successful, your workspace will be
          reinstated within 4 business hours.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
