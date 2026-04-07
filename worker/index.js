/**
 * Chess Personality — Cloudflare Worker
 * ─────────────────────────────────────
 * Handles:
 *   POST /api/claude       → proxy to Anthropic (max_tokens 300)
 *   POST /api/claude-long  → proxy to Anthropic (max_tokens 600)
 *   POST /api/verify-key   → verify a license key
 *   GET  /api/health       → health check
 *
 * Required Worker secrets (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY   — your Claude API key
 *   LICENSE_SECRET      — random string used to sign license keys
 *
 * Optional KV binding (for usage tracking):
 *   USAGE_KV            — KV namespace bound in wrangler.toml
 *
 * Deploy:
 *   1. npm install -g wrangler
 *   2. wrangler login
 *   3. wrangler secret put ANTHROPIC_API_KEY
 *   4. wrangler secret put LICENSE_SECRET
 *   5. wrangler deploy
 *   6. Set PROXY_URL in your frontend config.js to your worker URL
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-License-Key',
  'Access-Control-Max-Age': '86400',
};

const FREE_LIMIT = 2; // free analyses per browser (enforced on frontend + here as soft limit)
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health') {
        return json({ ok: true, ts: Date.now() });
      }

      if (url.pathname === '/api/verify-key' && request.method === 'POST') {
        return handleVerifyKey(request, env);
      }

      if ((url.pathname === '/api/claude' || url.pathname === '/api/claude-long')
           && request.method === 'POST') {
        return handleClaude(request, env, url.pathname === '/api/claude-long');
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'Internal error' }, 500);
    }
  }
};

// ── Claude proxy ─────────────────────────────────────────────────────────────
async function handleClaude(request, env, isLong) {
  const licenseKey = request.headers.get('X-License-Key') || '';
  const body = await request.json().catch(() => null);

  if (!body?.prompt) {
    return json({ error: 'Missing prompt' }, 400);
  }

  // Soft check: if no valid license key, enforce free limit via KV (if available)
  if (!licenseKey && env.USAGE_KV) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `usage:${ip}`;
    const count = parseInt(await env.USAGE_KV.get(key) || '0');
    if (count >= FREE_LIMIT) {
      return json({ error: 'free_limit_reached', message: 'Free analysis limit reached. Subscribe to continue.' }, 402);
    }
    // Increment (TTL: 30 days)
    await env.USAGE_KV.put(key, String(count + 1), { expirationTtl: 60 * 60 * 24 * 30 });
  }

  // If license key provided, verify it
  if (licenseKey) {
    const valid = await isValidKey(licenseKey, env);
    if (!valid) {
      return json({ error: 'invalid_key', message: 'Invalid or expired license key.' }, 403);
    }
  }

  // Proxy to Anthropic
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: isLong ? 600 : 300,
      messages: [{ role: 'user', content: body.prompt }]
    })
  });

  const data = await res.json();
  if (!res.ok) {
    return json({ error: data.error?.message || `Anthropic error ${res.status}` }, res.status);
  }

  return json({ text: data.content?.[0]?.text || '' });
}

// ── License key verification ──────────────────────────────────────────────────
async function handleVerifyKey(request, env) {
  const { key } = await request.json().catch(() => ({}));
  if (!key) return json({ valid: false, error: 'No key provided' });
  const valid = await isValidKey(key, env);
  return json({ valid });
}

async function isValidKey(key, env) {
  if (!key || !key.startsWith('CP-')) return false;
  // Key format: CP-{expiryTimestamp}-{hmac(expiryTimestamp, secret)}
  const parts = key.split('-');
  if (parts.length !== 3) return false;
  const [, expiry, sig] = parts;
  const expiryMs = parseInt(expiry, 36); // base36 timestamp
  if (isNaN(expiryMs) || expiryMs < Date.now()) return false; // expired

  // Verify HMAC-SHA256 signature
  const expected = await hmac(expiry, env.LICENSE_SECRET || 'dev-secret');
  return sig === expected;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function hmac(data, secret) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', keyMaterial, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '').slice(0, 16);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}
