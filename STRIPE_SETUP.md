# Stripe Setup for Chessonality Pro

This guide walks you through wiring up the €4.99/month subscription paywall.
Estimated time: **15 minutes**.

---

## 1. Create a Stripe account

1. Go to https://dashboard.stripe.com/register
2. Sign up with `maxtrummer16@gmail.com`
3. Confirm your email
4. Complete the business profile:
   - Business type: **Individual / Sole proprietor** (until you have a registered Gewerbe)
   - Country: **Austria**
   - Address: Mellacher Straße 63, 8072 Fernitz‑Mellach
   - Website: your future Chessonality URL (you can change this later)
5. Add your bank account (IBAN) in **Settings → Payouts** so Stripe can pay you out

You can test everything in **Test Mode** first (toggle top-right of the dashboard) before activating Live Mode.

---

## 2. Create the Pro product

1. Go to https://dashboard.stripe.com/products
2. Click **+ Add product**
3. Fill in:
   - **Name:** `Chessonality Pro`
   - **Description:** `Unlimited chess game analyses, AI coaching, and full personality insights.`
   - **Image:** upload your owl logo (optional but professional)
4. Under **Pricing**:
   - Pricing model: **Standard pricing**
   - Price: **4.99 EUR**
   - Billing period: **Monthly**
   - Type: **Recurring**
5. Click **Save product**

---

## 3. Create a Payment Link

1. Go to https://dashboard.stripe.com/payment-links
2. Click **+ New**
3. Select the `Chessonality Pro` product you just created (€4.99/month)
4. Quantity: **1**, customers cannot adjust
5. Under **After payment**:
   - Select **Don't show confirmation page**
   - Choose **Redirect customers to your website**
   - URL: `https://YOUR-DOMAIN.com/?subscribed=1&session_id={CHECKOUT_SESSION_ID}`
   - (Replace `YOUR-DOMAIN.com` with your real domain once you have it. For local testing you can use `http://localhost:8000/?subscribed=1&session_id={CHECKOUT_SESSION_ID}`.)
6. Optional but recommended:
   - **Collect customer addresses:** off (you don't need this for digital goods)
   - **Allow promotion codes:** on (lets you run coupons later)
   - **Tax behavior:** Stripe Tax handles EU VAT automatically. Enable Stripe Tax in Settings → Tax if you want this auto-calculated. For a sole-proprietor under the Kleinunternehmerregelung you can leave Tax off until you exceed €35,000/year revenue.
7. Click **Create link**
8. Copy the link (looks like `https://buy.stripe.com/abc123XYZ`)

---

## 4. Paste the link into the app

Open `config.js` and replace the `STRIPE_LINK` value:

```js
STRIPE_LINK: 'https://buy.stripe.com/abc123XYZ', // ← your real link
```

Save. That's it on the frontend side.

---

## 5. Test the full flow

1. Run the site locally (`python3 -m http.server 8000` from the project folder)
2. Open `http://localhost:8000`
3. Analyze 2 games — the third one should trigger the paywall
4. Click **Subscribe Now** → you should land on Stripe Checkout
5. Use the test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
6. After paying, Stripe should redirect you back to `http://localhost:8000/?subscribed=1&session_id=cs_test_…`
7. The "Welcome to Chessonality Pro!" celebration modal should appear
8. The free-analyses badge should disappear and you can analyze unlimited games

If the redirect doesn't trigger the welcome modal: check the browser DevTools console and verify the `?subscribed=1` URL parameter is present after redirect.

---

## 6. Going Live

When you're ready to take real money:

1. In the Stripe dashboard, switch from **Test Mode** to **Live Mode** (toggle top-right)
2. Repeat steps 2 and 3 in Live Mode (test products and links don't carry over)
3. Replace `STRIPE_LINK` in `config.js` with the **live** payment link
4. Make sure your hosting domain (e.g. `chessonality.com`) is set as the redirect URL
5. Verify Stripe has approved your account for live payments (usually takes ~1 day)

---

## 7. Customer Management

Stripe automatically handles all the boring parts:

- **Receipts:** sent automatically to the customer's email after each successful charge
- **Cancellations:** customers can manage their subscription via the link in their receipt email (Stripe Customer Portal)
- **Failed payments:** Stripe automatically retries with smart logic
- **Refunds:** issue from Stripe Dashboard → Payments → click payment → Refund

You don't need a customer login system on the Chessonality side — Stripe is the source of truth for who is paying.

---

## 8. Current limitations of the soft paywall

The current implementation stores the Pro status in the user's `localStorage`. This means:

- A tech-savvy user can clear their browser data and get 2 more free analyses
- A paying customer who clears their browser data will lose their Pro status until they re-enter via the Stripe receipt email link

Both of these are fine while you're under ~50 paying customers. When you're ready, the next step is:

- Build a Cloudflare Worker that proxies the Anthropic API calls
- The Worker validates the Stripe `session_id` against the Stripe API on first use
- Store the validated subscription server-side, keyed by the Stripe customer email
- Customers log in via "magic link" sent to the email Stripe has on file

That work is roughly 2-3 days. Until then, the current setup is enough to start collecting real subscribers.

---

## Quick reference

| Item | Value |
|---|---|
| Price | €4.99 / month |
| Free analyses before paywall | 2 |
| Frontend config file | `config.js` |
| Paywall trigger | `quiz.js` line 9 (`checkPaywall()`) |
| Pro state key (localStorage) | `cp-license-key`, `cp-license-exp` |
| Stripe success URL parameter | `?subscribed=1&session_id={CHECKOUT_SESSION_ID}` |
| Test card | `4242 4242 4242 4242` |
