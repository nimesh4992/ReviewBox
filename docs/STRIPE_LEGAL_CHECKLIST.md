# Stripe application & legal readiness

What the site now says, what only you can supply, and what has to happen before
you submit a Stripe application. Written for a non-lawyer.

**None of this is legal advice.** The pages were drafted against research into
Indian and EU requirements, but an Indian lawyer should read them before launch.
The clauses most worth paying for an hour of review on are listed at the end.

---

## 1. The entity: a partnership firm named "AT WORK Inc"

You've confirmed AT WORK Inc is a **partnership firm**, not a Private Limited.
That changes several things, and one of them is still a risk.

**"Inc" still doesn't fit.** "Inc" is short for "Incorporated". A partnership
firm is the one Indian business form that is explicitly *not* incorporated — in
law the firm has no separate legal personality; it is the partners. So the name
tells customers and Stripe that they are dealing with a corporate body when they
are dealing with individuals. Stripe verifies the business name against your
registration papers, and this is a common reason India applications stall.

**Action:** transcribe the name exactly as it appears on the partnership deed /
Registrar of Firms certificate into `src/lib/legal/company.ts`. If the deed
really does say "AT WORK Inc", it is worth asking your CA whether to keep
trading under it, because the mismatch between the name and the form is the part
that invites questions.

**Two consequences of being a partnership that are worth knowing:**

- **Unlimited personal liability.** A partnership firm gives its partners no
  liability shield. The limitation-of-liability clause in the Terms caps what
  customers can claim from the *business*, but partners remain personally liable
  for the firm's debts and obligations. A Private Limited or LLP is the usual fix
  and is worth discussing with your CA before you take paying customers.
- **Registration is optional but matters.** An unregistered partnership firm
  generally cannot sue to enforce a contract against a third party. For a
  business whose entire revenue is contracts with customers, that is a real
  exposure — if the firm is not registered with the Registrar of Firms, ask your
  CA what it takes.

**No CIN.** That identifier belongs to companies under the Companies Act. The
site now asks for a Registrar of Firms registration number instead, and the
footer publishes it only if you have one.

---

## 2. Facts only you can supply

Fill these into **one file** — `src/lib/legal/company.ts` — and every page,
footer and invoice updates. `npm run test:unit` prints what is still outstanding.

| Fact | Where to get it | Status |
|---|---|---|
| Exact firm name | Partnership deed / Registrar of Firms certificate | ⚠️ Needs confirming (see above) |
| Firm registration number | Registrar of Firms — or confirm the firm is unregistered | ❌ Missing |
| GSTIN | GST registration | ❌ Missing — you said you have this |
| Principal place of business | Full postal address. Legal notices are delivered there, so not a PO box | ❌ Missing |
| Grievance Officer: name, designation, email, postal address | You appoint them. Must be a named human, not just a mailbox | ❌ Missing |
| City whose courts have jurisdiction | Normally where the firm operates | ❌ Missing |

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

- [ ] **Confirm the firm name** against the partnership deed and fill in `company.ts` (section 1).
- [ ] **Fill every fact in section 2** into `src/lib/legal/company.ts` — until
      then the footer of every page shows "[to be published]" placeholders,
      which a reviewer will read as an unfinished site.
- [ ] **Verify production is serving this repo's master.** A 2026-08-16
      production screenshot showed hero copy that exists at no commit in this
      repository — if tryreviewbox.com is deploying an old or foreign build,
      none of the legal work is visible to the reviewer. Check the footer of
      the live site shows the "AT WORK Inc, trading as ReviewBox" line.
- [ ] **Check every page loads logged out** — refund policy, terms, privacy,
      contact, pricing, grievance, sub-processors.
- [ ] **Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel.**
      Stripe checkout success/cancel URLs are built from it — unset, a paying
      customer is redirected to localhost after paying.
- [ ] **Request an India invite.** Stripe India is not self-serve signup — you
      have to request access. Do this early; it gates everything else.
- [ ] **Tick the export/international opt-in** in the application if you intend
      to charge customers outside India. Without it, export charges only work in
      test mode.
- [x] **Show the currency on pricing.** Done in code — `/pricing` and the
      in-app Billing page now label prices "USD / month" explicitly (the ₹
      line names its own currency).
- [ ] **Have KYC documents ready:** partnership deed, firm PAN, GSTIN, bank
      proof, and identity documents for the partners. Stripe India accepts
      partnership firms, but the deed is the document it will want.
- [ ] **Decide annual + INR billing** before wiring prices: `/pricing`
      advertises annual per-month prices and ₹ prices, but checkout sells
      monthly USD only (see `docs/STRIPE_SETUP.md`). Either create those
      prices when setting up Stripe, or trim the display — the site must not
      advertise a price that can't be bought once billing is live. RBI's
      e-mandate cap is the reason annual-on-Indian-cards needs a decision.

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

1. **The firm name, the entity form, and whether to convert to an LLP or Private Limited** before taking paying customers — the unlimited-liability point above is the single most consequential item on this page.
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
