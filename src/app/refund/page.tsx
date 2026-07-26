import { LegalPageLayout, LegalSection } from "@/components/layout/legal-page-layout";

export const metadata = {
  title: "Refund Policy — ReviewBox",
  description: "ReviewBox refund policy — 30-day refunds for monthly and annual plans.",
};

const SECTIONS = [
  { id: "refund-window",       title: "Refund window" },
  { id: "monthly",             title: "30 days — monthly" },
  { id: "annual",              title: "30 days — annual" },
  { id: "accidental-charges",  title: "Accidental charges" },
  { id: "chargebacks",         title: "Chargebacks" },
  { id: "request",             title: "How to request a refund" },
];

export default function RefundPage() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      breadcrumbLabel="Refund Policy"
      currentHref="/refund"
      effectiveDate="2026-05-01"
      jurisdiction="Global"
      version="2.0"
      plainLanguage={[
        "Monthly plans: full refund within 30 days of each billing cycle start.",
        "Annual plans: full refund within 30 days of purchase or renewal.",
        "Accidental duplicate charges are refunded same day.",
        "Refund requests are processed within 5–10 business days via Stripe.",
      ]}
      sections={SECTIONS}
    >
      <LegalSection id="refund-window" number={1} title="Refund window">
        <p>
          AT Work Inc., trading as ReviewBox (&ldquo;ReviewBox&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) offers a
          30-day refund window on all paid subscription plans. The window begins on the date the
          charge is processed by Stripe and closes at 11:59 PM UTC on the 30th calendar day
          thereafter.
        </p>
        <p>
          Refunds are issued to the original payment method. We do not offer store credit or plan
          transfers in lieu of refunds.
        </p>
      </LegalSection>

      <LegalSection id="monthly" number={2} title="30 days — monthly">
        <p>
          If you are on a monthly billing cycle, you may request a full refund of the most recent
          charge within 30 days of when that charge was made. Prior billing periods are not
          eligible for refund.
        </p>
        <p>
          Upon processing a monthly refund, your subscription will be cancelled and your workspace
          will revert to the free tier at the end of the current billing period. You will retain
          access to paid features until the period ends.
        </p>
      </LegalSection>

      <LegalSection id="annual" number={3} title="30 days — annual">
        <p>
          If you are on an annual billing cycle, you may request a full refund of the annual charge
          within 30 days of the original purchase date or the most recent annual renewal date.
        </p>
        <p>
          After the 30-day window closes, annual plan charges are non-refundable. You may cancel
          your annual plan at any time to prevent future renewals; cancellation takes effect at the
          end of the current annual period.
        </p>
      </LegalSection>

      <LegalSection id="accidental-charges" number={4} title="Accidental charges">
        <p>
          If you were charged for a plan upgrade or renewal that you did not intend — for example,
          because of an accidental click or a team member acting without authorisation — contact us
          within <strong>7 days</strong> of the charge and we will issue a full refund and, where
          applicable, reverse the plan change.
        </p>
        <p>
          To qualify, the workspace must not have meaningfully used the upgraded features between
          the charge date and the refund request. We define &ldquo;meaningfully used&rdquo; as
          generating more than 10 AI reply drafts or syncing more than 500 reviews under the
          upgraded quota.
        </p>
      </LegalSection>

      <LegalSection id="chargebacks" number={5} title="Chargebacks">
        <p>
          We ask that you contact us before initiating a chargeback with your bank or card issuer.
          Chargebacks impose significant administrative costs and may result in your account being
          suspended while the dispute is resolved.
        </p>
        <p>
          If a chargeback is filed for a charge that is covered by this Refund Policy, we will
          provide the card network with documentation demonstrating that you were eligible for a
          direct refund. Filing a chargeback does not guarantee a refund and may delay resolution
          by 30–90 days.
        </p>
      </LegalSection>

      <LegalSection id="request" number={6} title="How to request a refund">
        <p>To request a refund, please email{" "}
          <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
            legal@tryreviewbox.com
          </a>{" "}
          with:
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>The email address associated with your ReviewBox account.</li>
          <li>The approximate date and amount of the charge.</li>
          <li>A brief reason for the request (helps us improve the product).</li>
        </ul>
        <p className="mt-3">
          We typically respond within one business day and process approved refunds within
          5–10 business days. Stripe&apos;s processing time means the credit may take an
          additional 3–7 days to appear on your statement.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
