import Link from "next/link";

export const metadata = {
  title: "Refund & Cancellation Policy â€” ReviewBox",
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
        >
          â† Back to ReviewBox
        </Link>

        <div className="mt-8 rounded-2xl bg-white px-8 py-10 shadow-sm ring-1 ring-gray-200 sm:px-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Refund & Cancellation Policy
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Last updated: May 15, 2026. ReviewBox is operated by AT Work Inc.
          </p>

          <div className="mt-10 space-y-10 text-sm leading-relaxed text-gray-700">
            <section>
              <h2 className="text-base font-semibold text-gray-900">
                1. Free Trial
              </h2>
              <p className="mt-3">
                ReviewBox offers a 14-day free trial for all new accounts. No credit card is required to start the trial. You can explore all features during this period.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">
                2. Subscription Cancellation
              </h2>
              <p className="mt-3">
                You may cancel your subscription at any time through your dashboard settings or by contacting us at nssatikunvar@gmail.com. Upon cancellation, your subscription will remain active until the end of the current billing cycle. No further charges will be made after cancellation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">
                3. Refunds
              </h2>
              <p className="mt-3">
                Since we offer a fully featured 14-day free trial, we generally do not issue refunds for subscription payments once they have been processed. However, if you believe there has been a billing error or have exceptional circumstances, please reach out to our support team.
              </p>
            </section>

            <section>
              <h2 className="text-base font-semibold text-gray-900">
                4. Contact Us
              </h2>
              <p className="mt-3">
                For any questions regarding billing, cancellations, or refunds, please email us at nssatikunvar@gmail.com.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
