/**
 * Chess Personality — Cloudflare Worker
 * ─────────────────────────────────────
 * Handles:
 *   POST /api/claude       → proxy to Anthropic (max_tokens 300, default Haiku)
 *   POST /api/claude-long  → proxy to Anthropic (max_tokens 1000, client picks model)
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

// Soft-launch: paid tier is disabled, so we give everyone a high free limit.
// Bump this back down (e.g. to 2) once Stripe billing goes live.
const FREE_LIMIT = 9999;
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

      if (url.pathname === '/api/sync/request' && request.method === 'POST') {
        return handleSyncRequest(request, env);
      }
      if (url.pathname === '/api/sync/redeem' && request.method === 'POST') {
        return handleSyncRedeem(request, env);
      }
      if (url.pathname === '/api/sync/push' && request.method === 'POST') {
        return handleSyncPush(request, env);
      }
      if (url.pathname === '/api/sync/pull' && request.method === 'POST') {
        return handleSyncPull(request, env);
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
  // Allow the client to request a specific model; default to Haiku.
  const ALLOWED_MODELS = [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250514',
  ];
  const requestedModel = ALLOWED_MODELS.includes(body.model)
    ? body.model
    : 'claude-haiku-4-5-20251001';

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: requestedModel,
      max_tokens: isLong ? 1000 : 300,
      temperature: 0,
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

// ═════════════════════════════════════════════════════════════
//  Cross-device sync (email + magic code)
// ═════════════════════════════════════════════════════════════
//
//  Required bindings:
//    SYNC_KV       — Workers KV namespace
//  Optional secrets (for real email delivery):
//    RESEND_API_KEY  — Resend.com API key
//    SYNC_FROM_EMAIL — verified from-address, e.g. 'Chessonality <no-reply@chessonality.com>'
//    LICENSE_SECRET  — reused as HMAC secret for signing sync tokens
//
//  KV keys:
//    code:<email>       → { code, exp } (5 min TTL)
//    rate:<ip>          → counter (10 min TTL)
//    data:<emailHash>   → user payload JSON
//
//  A "token" is HMAC(email, LICENSE_SECRET) so the client can prove
//  ownership without storing anything server-side long-term.

const SYNC_CODE_TTL_SEC   = 300;    // 5 minutes
const SYNC_RATE_TTL_SEC   = 600;    // 10 minutes
const SYNC_RATE_LIMIT     = 8;      // requests per IP per window
const SYNC_MAX_PAYLOAD    = 256 * 1024; // 256 KB cap per user blob

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}
function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function emailHash(email) {
  return (await sha256Hex('chessonality:' + normalizeEmail(email))).slice(0, 32);
}

async function signToken(email, env) {
  const secret = env.LICENSE_SECRET || 'dev-secret';
  const sig = await hmac(normalizeEmail(email), secret);
  // Token format: "t1.<emailB64>.<sig>"
  const emailB64 = btoa(normalizeEmail(email))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `t1.${emailB64}.${sig}`;
}

async function verifyToken(token, env) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 't1') return null;
  let email;
  try {
    const pad = '='.repeat((4 - parts[1].length % 4) % 4);
    email = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/') + pad);
  } catch { return null; }
  const expected = await hmac(email, env.LICENSE_SECRET || 'dev-secret');
  return (expected === parts[2]) ? email : null;
}

function randomCode6() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(a[0] % 1000000).padStart(6, '0');
}

async function rateLimit(env, ip) {
  if (!env.SYNC_KV) return true; // no KV → allow (dev)
  const key = `rate:${ip}`;
  const current = parseInt((await env.SYNC_KV.get(key)) || '0');
  if (current >= SYNC_RATE_LIMIT) return false;
  await env.SYNC_KV.put(key, String(current + 1), { expirationTtl: SYNC_RATE_TTL_SEC });
  return true;
}

async function sendSyncEmail(env, to, code) {
  if (!env.RESEND_API_KEY) {
    // Dev fallback: log the code so it's visible in wrangler tail
    console.log(`[sync] (dev) code for ${to}: ${code}`);
    return { ok: true, dev: true };
  }
  const from = env.SYNC_FROM_EMAIL || 'Chessonality <no-reply@chessonality.com>';
  const subject = 'Your Chessonality sync code';
  const text = `Your Chessonality sync code is: ${code}\n\n`
             + `This code expires in 5 minutes. If you didn't request it, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;">
    <h2 style="margin:0 0 12px;color:#1d4ed8;">Your Chessonality sync code</h2>
    <p style="font-size:15px;color:#334155;">Use this code to link your devices:</p>
    <div style="font-size:36px;font-weight:800;letter-spacing:0.3em;
                padding:18px;background:#f1f5f9;border-radius:12px;
                text-align:center;color:#0f172a;margin:16px 0;">${code}</div>
    <p style="font-size:13px;color:#64748b;">This code expires in 5 minutes.
       If you didn't request it, you can safely ignore this email.</p>
  </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[sync] resend error', res.status, errText);
    return { ok: false };
  }
  return { ok: true };
}

// ── POST /api/sync/request { email } ─────────────────────────
async function handleSyncRequest(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimit(env, ip))) {
    return json({ error: 'rate_limited', message: 'Too many requests. Try again later.' }, 429);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) return json({ error: 'invalid_email' }, 400);

  if (!env.SYNC_KV) {
    return json({ error: 'sync_not_configured', message: 'Sync is not configured on this server.' }, 503);
  }

  const code = randomCode6();
  await env.SYNC_KV.put(`code:${email}`, JSON.stringify({ code, exp: Date.now() + SYNC_CODE_TTL_SEC * 1000 }),
                        { expirationTtl: SYNC_CODE_TTL_SEC });

  const sent = await sendSyncEmail(env, email, code);
  if (!sent.ok) return json({ error: 'email_failed', message: 'Could not send email.' }, 502);

  return json({ ok: true, dev: !!sent.dev });
}

// ── POST /api/sync/redeem { email, code } ────────────────────
async function handleSyncRedeem(request, env) {
  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const code  = String(body?.code || '').trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return json({ error: 'invalid_input' }, 400);
  }
  if (!env.SYNC_KV) return json({ error: 'sync_not_configured' }, 503);

  const raw = await env.SYNC_KV.get(`code:${email}`);
  if (!raw) return json({ error: 'code_expired' }, 410);
  let rec;
  try { rec = JSON.parse(raw); } catch { return json({ error: 'code_expired' }, 410); }
  if (!rec || rec.code !== code) return json({ error: 'invalid_code' }, 401);

  // One-shot: consume the code
  await env.SYNC_KV.delete(`code:${email}`);

  const token = await signToken(email, env);
  return json({ ok: true, token });
}

// ── POST /api/sync/push { token, payload } ───────────────────
async function handleSyncPush(request, env) {
  const body = await request.json().catch(() => null);
  const email = await verifyToken(body?.token, env);
  if (!email) return json({ error: 'invalid_token' }, 401);
  if (!body?.payload || typeof body.payload !== 'object') {
    return json({ error: 'invalid_payload' }, 400);
  }
  if (!env.SYNC_KV) return json({ error: 'sync_not_configured' }, 503);

  const blob = JSON.stringify({
    updatedAt: Date.now(),
    payload: body.payload,
  });
  if (blob.length > SYNC_MAX_PAYLOAD) {
    return json({ error: 'payload_too_large', limit: SYNC_MAX_PAYLOAD }, 413);
  }

  const hash = await emailHash(email);
  await env.SYNC_KV.put(`data:${hash}`, blob);
  return json({ ok: true, size: blob.length });
}

// ── POST /api/sync/pull { token } ────────────────────────────
async function handleSyncPull(request, env) {
  const body = await request.json().catch(() => null);
  const email = await verifyToken(body?.token, env);
  if (!email) return json({ error: 'invalid_token' }, 401);
  if (!env.SYNC_KV) return json({ error: 'sync_not_configured' }, 503);

  const hash = await emailHash(email);
  const raw = await env.SYNC_KV.get(`data:${hash}`);
  if (!raw) return json({ ok: true, payload: null });
  try {
    const parsed = JSON.parse(raw);
    return json({ ok: true, payload: parsed.payload, updatedAt: parsed.updatedAt });
  } catch {
    return json({ ok: true, payload: null });
  }
}
