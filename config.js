/**
 * Chess Personality - Frontend Config
 * ─────────────────────────────────────
 * Set PROXY_URL to your deployed Cloudflare Worker URL before going public.
 *
 * Example: 'https://chess-personality-api.YOUR-SUBDOMAIN.workers.dev'
 *
 * While PROXY_URL is empty (''), the app falls back to the hardcoded API key
 * in the HTML for local development only.
 */

window.CP_CONFIG = {
  // ← Replace with your Cloudflare Worker URL before deploying.
  // While empty, the app uses the local API key from claude-api.js (dev only).
  PROXY_URL: 'https://chess-personality-api.maxtrummer.workers.dev',

  // Stripe Payment Link for the €4.99/month Pro subscription.
  // 1. Go to https://dashboard.stripe.com/payment-links
  // 2. Create a recurring product "Chessonality Pro" at €4.99/month
  // 3. After creation, set the success URL to:
  //    https://your-domain.com/?subscribed=1&session_id={CHECKOUT_SESSION_ID}
  // 4. Paste the resulting buy.stripe.com link below.
  STRIPE_LINK: 'https://buy.stripe.com/6oUeVe7HG5ag4tZe6y9MY00',

  // Number of free game analyses before the paywall triggers.
  FREE_ANALYSES: 2,

  // Pro tier display info (used in the paywall modal).
  PRO_PRICE_DISPLAY: '€4.99',
  PRO_PERIOD_DISPLAY: '/ month',
};
