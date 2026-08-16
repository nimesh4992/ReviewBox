# Stripe application & legal readiness

What the site now says, what only you can supply, and what has to happen before
you submit a Stripe application. Written for a non-lawyer.

**None of this is legal advice.** The pages were drafted against research into
Indian and EU requirements, but an Indian lawyer should read them before launch.
The clauses most worth paying for an hour of review on are listed at the end.

---

## 1. The blocker: your company name

You told me the incorporation certificate reads **"AT WORK Inc"**, and that is
what the site now says. There is a problem with that.

An Indian company's name has to end in "Private Limited", "Limited", "LLP" or a
similar Indian form. The Companies Act does not allow "Inc." in the name of a
company registered in India. So one of these is true:

1. **The certificate actually says something else** — for example "At Work
   Technologies Private Limited" — and "AT WORK Inc" is how you write the brand.
   In that case the legal name on the site is a company that does not exist.
2. **The entity is not registered in India** — it is a US or other foreign
   company. In that case the whole jurisdiction premise is wrong: governing law,
   the grievance officer requirement, and the GST treatment all change.

This matters commercially, not just legally: **Stripe verifies the business name
against your incorporation documents, and a mismatch is one of the most common
reasons an application is rejected.**

**Action:** open the certificate of incorporation and copy the name character for
character into `src/lib/legal/company.ts`. If it turns out the company is not
Indian, tell me and I will redo the jurisdiction across all the pages.

---

## 2. Facts only you can supply

Fill these into **one file** — `src/lib/legal/company.ts` — and every page,
footer and invoice updates. They are legally required to be published for an
Indian company, and Stripe looks for them.

| Fact | Where to get it | Status |
|---|---|---|
| Exact legal name | Certificate of Incorporation | ⚠️ Needs confirming (see above) |
| CIN | MCA certificate | ❌ Missing |
| GSTIN | GST registration | ❌ Missing — you said you have this |
| Registered office address | MCA record. Must be a real, serviceable address — legal notices are delivered there, so not a PO box | ❌ Missing |
| Grievance Officer: name, designation, email, postal address | You appoint them. Must be a named human, not just a mailbox | ❌ Missing |
| City whose courts have jurisdiction | Normally where the registered office is | ❌ Missing |

Until they are filled in, the pages say the details are "to be published"
rather than inventing them. `npm run test:unit` prints the outstanding list.

---

## 3. What changed on the site

**Contradictions removed.** Your Terms said disputes go to courts in Delaware,
USA. Two refund policies were live at the same time: one promised a 30-day
no-questions-asked refund, the other said the opposite, and `/pricing` and
`/faq` advertised the 30-day promise. Those were binding offers to anyone who
read them. There is now one refund policy, matching what you told me.

**Claims deleted, not softened.** The site claimed quarterly penetration tests,
90-day key rotation, annual security training, and "SOC 2 Type II in progress".
The DPA — a contract customers can execute — offered to hand over a SOC 2 report
on request, and attached Standard Contractual Clauses "as Annex II" that did not
exist. Every legal page carried the line "a real lawyer reads these". All gone.
If a customer had relied on any of them, that is a warranty breach, not marketing.

**Your legal pages were behind the login.** `/cookies`, `/acceptable-use` and
`/refund-policy` were not in the list of public routes, so anonymous visitors —
and a Stripe reviewer, and Google — hit an auth wall. Fixed.

**New pages:** `/grievance` (India requires a published grievance officer and
timelines) and `/sub-processors` (the DPA already linked to it; it never
existed). Vercel and Sentry were handling customer data undisclosed.

**A real privacy leak:** Sentry was configured with `sendDefaultPii: true`,
which sends request contents to the error tracker — on this product that means
reviewer names and review text going to a tool your own policy describes as
receiving diagnostics only. Turned off.

---

## 4. Before you submit to Stripe

- [ ] **Confirm the legal name** and fill in `company.ts` (section 1).
- [ ] **Request an India invite.** Stripe India is not self-serve signup — you
      have to request access. Do this early; it gates everything else.
- [ ] **Tick the export/international opt-in** in the application if you intend
      to charge customers outside India. Without it, export charges only work in
      test mode.
- [ ] **Show the currency on pricing.** "$49" alone is ambiguous to an
      international buyer; Stripe asks for the currency code. Say "USD 49 / month".
- [ ] **Have KYC documents ready:** certificate of incorporation, PAN, GSTIN,
      bank proof, director identity documents.
- [ ] **Check every page loads logged out** — refund policy, terms, privacy,
      contact, pricing, grievance.

Already handled in code: checkout now collects the buyer's name and billing
address and sets a service description, all three of which an India account
needs on international charges or the payment is rejected outright.

---

## 5. Things I could not resolve for you

**Recurring charges on Indian cards.** RBI rules require additional
authentication for recurring card payments, with a cap above which the customer
must authenticate every single renewal. A monthly plan at your prices sits under
it; an annual plan does not and would fail unattended. Decide whether to offer
annual billing to Indian customers before you launch it.

**GST.** Selling to customers outside India is normally an export of services
and can be zero-rated, but that requires an LUT and correct invoicing. You also
owe reverse-charge GST on the foreign services you buy — Stripe, Supabase,
Vercel, Groq, Clerk, Resend, Upstash. That is a real monthly cost the zero-cost
plan does not currently model. Ask your CA.

**EU customers.** If you sell into the EU or UK, you likely need to appoint a
representative there. That is a paid service, so it is a decision, not a code
change.

**AI providers and personal data.** Free API tiers commonly allow the provider to
use submitted content to improve their models, and reviews contain other
people's personal data. Before an EU customer's data flows through, confirm the
tier you are on for each AI provider forbids training, and switch if it does not.
The privacy pages describe what we do, not what a free tier permits.

---

## 6. Worth paying a lawyer to check

1. **The company name and jurisdiction premise** — everything else rests on it.
2. **The no-refund clause** against the Consumer Protection Act. Many of your
   target customers are solo developers, who may count as consumers rather than
   businesses, and a blanket no-refund term can be attacked as unfair. The 14-day
   no-card trial is your best defence and should stay prominent.
3. **The limitation of liability** — caps like this are read narrowly, and this
   one was drafted for US law.
4. **The DPA's controller/processor split**, now that it says you are a processor
   for review data and a controller for account data. Review authors never agreed
   to anything with anyone, which is the genuinely awkward part.
5. **Whether you are an "intermediary"** under Indian IT law, and whether
   AI-generated reply drafts need labelling. Both are unsettled and both change
   your obligations if the answer is yes.
