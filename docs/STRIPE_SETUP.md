# S2.1 — Stripe Billing Setup

> Step-by-step guide to go from no Stripe account to a working checkout →
> webhook → Supabase flow, end-to-end tested. Target: 60–90 minutes.

The code is already in place — `src/lib/stripe.ts`, `/api/stripe/checkout`,
`/api/stripe/portal`, `/api/stripe/webhook` all exist and handle the flows.
This guide is about creating the right products in Stripe, wiring the env
vars, and proving the loop works.

---

## Recommended pricing

These align with `docs/FEATURES.md` and `src/lib/stripe.ts` (`starter`,
`pro`, `team` keys). Set in **USD**, monthly. Add yearly later (20% off
is the typical SaaS discount).

| Plan | Monthly | Apps | AI calls / mo | Seats | Headline gates |
| --- | --- | --- | --- | --- | --- |
| **Starter** | $49 | 1 | 250 | 1 | Reviews + replies + alerts |
| **Pro** | $99 | 3 | 2,000 | 3 | + Automations + Knowledge base + Templates |
| **Team** | $199 | 10 | Unlimited | 10 | + Auto-reply + Custom tone + Priority support |

Trial: **14 days, no card required.** Already handled at the app level via
Clerk metadata — Stripe trial settings are not used.

---

## Step 1 — Create the Stripe account

1. Sign up at [dashboard.stripe.com/register](https://dashboard.stripe.com/register)
   with the email you want billed alerts to go to (use a shared inbox if you
   have one).
2. Activate the account by adding business details under
   **Settings → Business settings**. You can ship checkout in **test mode**
   without activation, but live payouts require activation.
3. Confirm the brand name shows correctly on hosted checkout previews
   (**Settings → Branding** — upload logo, set primary color `#0A84FF`).

---

## Step 2 — Create the three products

For each plan, do this:

1. **Products → Add product**
2. Name: `ReviewBox Starter` (or Pro / Team)
3. Description: pull from the table above
4. **Pricing model:** Standard
5. **Price:** $49 (or $99 / $199)
6. **Billing period:** Monthly, recurring
7. Click **Add product**

After creating, open each product and copy the **Price ID** (starts with
`price_...`) — you'll need three:

- Starter: `price_...`
- Pro: `price_...`
- Team: `price_...`

<details>
<summary>CLI alternative (faster if you have the Stripe CLI)</summary>

```bash
stripe products create --name="ReviewBox Starter" --description="1 app, 250 AI calls/mo, email support"
stripe prices create --product=prod_xxx --unit-amount=4900 --currency=usd --recurring[interval]=month

stripe products create --name="ReviewBox Pro" --description="3 apps, 2K AI calls/mo, automations + KB"
stripe prices create --product=prod_yyy --unit-amount=9900 --currency=usd --recurring[interval]=month

stripe products create --name="ReviewBox Team" --description="10 apps, unlimited AI calls, auto-reply + custom tone"
stripe prices create --product=prod_zzz --unit-amount=19900 --currency=usd --recurring[interval]=month
```

</details>

---

## Step 3 — Set up the webhook

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:**
   - Production: `https://app.tryreviewbox.com/api/stripe/webhook`
   - Local testing: skip — use the Stripe CLI (see Step 6)
3. **Events to send** (the webhook handler at
   `src/app/api/stripe/webhook/route.ts` listens for these three):
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. Click **Reveal signing secret** and copy the value (starts with `whsec_...`)

---

## Step 4 — Fill the env vars

Open `D:\Projects\Reviews\.env.local` and paste:

```bash
STRIPE_SECRET_KEY=sk_test_...        # from Dashboard → Developers → API keys
STRIPE_WEBHOOK_SECRET=whsec_...      # from Step 3
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
```

<details>
<summary>Production env vars (Vercel)</summary>

In the Vercel dashboard for the project:
1. **Settings → Environment Variables**
2. Add each of the five above, scoped to **Production**
3. Use **live keys** (`sk_live_...`, `whsec_...` from the live webhook
   endpoint — repeat Step 3 in live mode after activating the account)
4. Redeploy after env changes (Vercel doesn't hot-reload them)

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
2. Click **Upgrade to Pro**
3. You're redirected to Stripe Checkout — use test card
   `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
4. After payment, you're redirected to `/dashboard?upgraded=1`

### 6c. Verify the side effects

The webhook fires `checkout.session.completed`. Confirm:

- [ ] Clerk dashboard → your user → **Public metadata** now shows
      `{ plan: "pro", paymentFailedAt: null }`
- [ ] Supabase → **workspaces** table → your workspace `plan` column = `pro`
- [ ] Welcome email arrived in your inbox (sent via Resend)
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
- Subscription deleted → plan flips to `free` in both Clerk + Supabase

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

1. **Activate** the Stripe account (Settings → Business settings → Activate)
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

**"No such price" on checkout**
The `STRIPE_PRICE_*` env vars don't match the IDs in the Stripe dashboard.
Confirm the keys (`price_...`, not `prod_...`).

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
