# S2.1 — Stripe Billing Setup

> Step-by-step guide to go from no Stripe account to a working checkout →
> webhook → Supabase flow, end-to-end tested. Target: 60–90 minutes.

The code is already in place — `src/lib/stripe.ts`, `/api/stripe/checkout`,
`/api/stripe/portal`, `/api/stripe/webhook` all exist and handle the flows.
This guide is about creating the right products in Stripe, wiring the env
vars, and proving the loop works.

> **India account first:** this is an India-registered business, and Stripe
> India is invite-only with KYC. Work through
> `docs/STRIPE_LEGAL_CHECKLIST.md` (entity name, company facts on the site,
> invite request, KYC documents, export opt-in) **before** this guide —
> everything below assumes the account exists.

---

## The pricing (source of truth: `src/lib/plans.ts`)

`/pricing` and the in-app Billing page both render from `PLAN_PRICING` /
`PLAN_LIMITS`. The Stripe products you create must match them — never retype
prices anywhere else.

| Plan | Monthly (USD) | Apps | AI drafts / mo | Published replies / mo | Seats |
| --- | --- | --- | --- | --- | --- |
| **Starter** | $49 | 2 | 300 | 300 | 1 |
| **Pro** | $129 | 10 | 1,500 | 1,500 | 3 |
| **Enterprise** | Quote-only | — | — | — | — |

- **Enterprise gets NO Stripe product.** It is "Talk to us" on purpose —
  assign the plan by hand after a contract.
- **Create FOUR USD prices — monthly and yearly for each plan:**

  | Env var | Plan | Recurring | Amount |
  |---|---|---|---|
  | `STRIPE_PRICE_STARTER`        | Starter | Monthly | $49 |
  | `STRIPE_PRICE_PRO`            | Pro     | Monthly | $129 |
  | `STRIPE_PRICE_STARTER_ANNUAL` | Starter | Yearly  | **$468** |
  | `STRIPE_PRICE_PRO_ANNUAL`     | Pro     | Yearly  | **$1188** |

  ⚠️ The yearly prices are the **total charged once a year**, not the
  per-month figure the pricing page displays ($39 / $99). Entering $39 as a
  yearly price would sell a year of Starter for $39.

  The two annual vars may be left blank: the Monthly/Yearly toggle is hidden
  unless **every** paid plan has a price for that interval, so a partial
  configuration degrades to monthly-only rather than half-working.

- **USD only.** The INR prices (₹2,999 / ₹6,999) that used to appear on
  `/pricing` were removed on 2026-08-18. They were never purchasable — no INR
  price object existed and checkout only ever created USD sessions. Do not
  re-add a currency to `PLAN_PRICING`: it needs a Stripe price per currency,
  currency selection at checkout, and a rule for which currency an existing
  subscriber is billed in.

  If INR billing is revisited, note that **RBI e-mandate** rules cap
  unattended recurring charges on Indian cards — an annual charge at these
  prices would need re-authentication at every renewal. That is a reason
  annual-on-Indian-cards is a real decision, not a formality.

Trial: **14 days, no card required.** Handled at the app level via Clerk
metadata — Stripe trial settings are not used, and there is no automatic
trial-to-paid conversion (this matches `/refund-policy`).

---

## Step 1 — Create the Stripe account

1. Complete `docs/STRIPE_LEGAL_CHECKLIST.md` §4 first (India invite, KYC,
   business name exactly as on the partnership deed).
2. Activate the account by adding business details under
   **Settings → Business settings**. You can ship checkout in **test mode**
   without activation, but live payouts require activation.
3. Confirm the brand name shows correctly on hosted checkout previews
   (**Settings → Branding** — upload logo, set primary color `#0A84FF`).

---

## Step 2 — Create the two products

For each plan, do this:

1. **Products → Add product**
2. Name: `ReviewBox Starter` (or `ReviewBox Pro`)
3. Description: pull from the table above
4. **Pricing model:** Standard
5. **Price:** $49 (or $129), **USD**
6. **Billing period:** Monthly, recurring
7. Click **Add product**

After creating, open each product and copy the **Price ID** (starts with
`price_...`) — you need two:

- Starter: `price_...`
- Pro: `price_...`

<details>
<summary>CLI alternative (faster if you have the Stripe CLI)</summary>

```bash
stripe products create --name="ReviewBox Starter" --description="2 apps, 300 published replies + 300 AI drafts/mo, 1 seat"
stripe prices create --product=prod_xxx --unit-amount=4900 --currency=usd --recurring[interval]=month

stripe products create --name="ReviewBox Pro" --description="10 apps, 1,500 published replies + 1,500 AI drafts/mo, 3 seats"
stripe prices create --product=prod_yyy --unit-amount=12900 --currency=usd --recurring[interval]=month
```

</details>

---

## Step 3 — Set up the webhook

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:**
   - Production: `https://app.tryreviewbox.com/api/stripe/webhook`
   - Local testing: skip — use the Stripe CLI (see Step 6)
3. **Events to send** — the handler at `src/app/api/stripe/webhook/route.ts`
   listens for all five; missing any of them breaks a real flow (e.g. without
   `invoice.payment_succeeded` a recovered card is never un-flagged, and
   without `customer.subscription.updated` portal plan changes never sync):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. Click **Reveal signing secret** and copy the value (starts with `whsec_...`)

---

## Step 4 — Fill the env vars

Open `.env.local` in the project root and paste:

```bash
STRIPE_SECRET_KEY=sk_test_...        # from Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...      # from Step 3
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

<details>
<summary>Production env vars (Vercel)</summary>

In the Vercel dashboard for the project:
1. **Settings → Environment Variables**
2. Add each of the four above, scoped to **Production**
3. Use **live keys** (`sk_live_...`, `whsec_...` from the live webhook
   endpoint — repeat Step 3 in live mode after activating the account)
4. Also confirm `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` is set —
   checkout success/cancel URLs are built from it (unset, they point at
   localhost)
5. Redeploy after env changes (Vercel doesn't hot-reload them)

</details>

Restart the dev server after editing `.env.local`:

```bash
npm run dev
```

---

## Step 5 — Sanity-check the routes load

Hit each route with the dev server running:

```bash
curl http://localhost:3000/api/health    # should return 200 OK

# Signed in via Clerk — these will 401 if not authed
curl -X POST http://localhost:3000/api/stripe/checkout -H "Content-Type: application/json" -d '{"plan":"pro"}'
```

If you see `STRIPE_SECRET_KEY is not set` in the dev console, you didn't
restart after editing `.env.local`.

---

## Step 6 — End-to-end test (test mode)

You need the [Stripe CLI](https://docs.stripe.com/stripe-cli) for this.

### 6a. Forward webhooks to localhost

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI prints a **webhook signing secret** for forwarded events — paste it
into `.env.local` as `STRIPE_WEBHOOK_SECRET` for the test run (you can swap
back to the production secret after).

### 6b. Trigger a checkout

1. Open `http://localhost:3000/billing` while signed in
2. On the **Pro** card, click **Choose Plan**
3. You're redirected to Stripe Checkout — use test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP. Checkout will
   also ask for a name and billing address — that's intentional (an India
   account must supply both on export charges or the payment is rejected).
4. After payment, you're redirected to `/dashboard?upgraded=1`

### 6c. Verify the side effects

The webhook fires `checkout.session.completed`. Confirm:

- [ ] Clerk dashboard → your user → **Public metadata** now shows
      `{ plan: "pro", paymentFailedAt: null }`
- [ ] Supabase → **workspaces** table → your workspace `plan` column = `pro`
- [ ] Stripe CLI terminal logged
      `--> checkout.session.completed [200]` (200 = handler succeeded)

### 6d. Test failure paths

```bash
# Simulate failed payment
stripe trigger invoice.payment_failed

# Simulate cancellation
stripe trigger customer.subscription.deleted
```

Confirm:
- Failed payment → `paymentFailedAt` set on Clerk user, email sent
- Subscription deleted → plan flips to `canceled` in both Clerk + Supabase

---

## Step 7 — Test the billing portal

1. Open `/billing` while signed in
2. Click **Manage subscription**
3. You should land on Stripe's hosted portal — try **Update payment method**
   and **Cancel subscription**
4. Cancellations fire `customer.subscription.deleted` → already covered above

If the portal 500s, ensure **Settings → Billing → Customer portal** is
**Activated** in the Stripe dashboard and the **return URL** is set to
`http://localhost:3000/billing` (or your prod URL).

---

## Step 8 — Go live

When you're ready for real payments:

1. **Activate** the Stripe account (Settings → Business settings → Activate).
   For India this is the full review: KYC documents, business name matching
   the partnership deed, and your website — the reviewer checks that
   pricing, terms, privacy, refund policy and contact details are publicly
   visible on tryreviewbox.com (see `docs/STRIPE_LEGAL_CHECKLIST.md` §4).
2. Switch to **Live mode** in the dashboard top-right
3. Repeat Steps 2 and 3 in live mode (products + webhook)
4. Update Vercel env vars to use `sk_live_...` and the live `whsec_...`
5. Redeploy
6. Run one real $1 test charge to your own card, then refund it via the
   Stripe dashboard

---

## Common issues

**Webhook signature verification fails**
You're using the wrong `STRIPE_WEBHOOK_SECRET`. Test-mode CLI forwarding
uses a *different* secret than the test-mode dashboard webhook, which is
different again from live mode. Match the source to the secret.

**"Invalid plan." on checkout**
The plan sent isn't in `PAID_PLANS` (`starter`, `pro`), or its
`STRIPE_PRICE_*` env var is empty / doesn't match a Price ID in the Stripe
dashboard. Confirm the keys (`price_...`, not `prod_...`).

**Welcome email didn't fire**
Check `RESEND_API_KEY` is set and the Resend domain (`tryreviewbox.com`)
is verified. Until verification, Resend will reject sends from
`hello@tryreviewbox.com` — temporarily swap to `onboarding@resend.dev` in
`src/lib/email/client.ts` for local testing.

**Subscription not syncing to Supabase**
The webhook handler runs `syncPlanToSupabase()` which looks up the user via
`workspace_members.clerk_user_id`. Confirm that join row exists (it's
created during onboarding) — if you skipped onboarding, the plan won't
attach.

---

## After this is done

Tick S2.1 in `CLAUDE.md`. Move to **S2.2 — Reply submission** (publish
button on review card → Google Play API → update Supabase status).
