/* ============================================================
   sync.js  Cross-device email-based sync for Chessonality
   ─────────────────────────────────────────────────────────
   Flow (no password, magic-code):
     1. User enters email on profile page → POST /api/sync/request
        Server sends a 6-digit code to the email.
     2. User enters the code → POST /api/sync/redeem
        Server returns a signed token (opaque) stored locally.
        Token lets this device push/pull data by email.
     3. "Save":  POST /api/sync/push with {token, payload}
     4. "Load":  POST /api/sync/pull with {token}  →  payload
   Backend is the existing Cloudflare Worker.
   ============================================================ */

'use strict';

const SYNC_LOCAL_KEY   = 'ce-sync-v1';       // { email, token, lastPush }
const SYNC_DISMISS_KEY = 'ce-sync-dismissed'; // '1' if user closed banner
let   _syncMode = 'save';   // 'save' | 'load'
let   _syncEmail = '';

function _syncApiBase() {
  try {
    const cfg = window.CP_CONFIG || window.CONFIG;
    if (cfg && cfg.PROXY_URL) return cfg.PROXY_URL.replace(/\/$/, '');
  } catch (_) {}
  return '';
}

function _syncState() {
  try { return JSON.parse(localStorage.getItem(SYNC_LOCAL_KEY) || 'null'); }
  catch (_) { return null; }
}
function _syncSetState(s) {
  if (s) localStorage.setItem(SYNC_LOCAL_KEY, JSON.stringify(s));
  else   localStorage.removeItem(SYNC_LOCAL_KEY);
}

// ── Banner visibility ─────────────────────────────────────────
function updateSyncBanner() {
  const banner = document.getElementById('profSyncBanner');
  const status = document.getElementById('profSyncStatus');
  if (!banner || !status) return;

  const state = _syncState();
  if (state && state.email && state.token) {
    banner.style.display = 'none';
    status.style.display = 'flex';
    const el = document.getElementById('pssEmail');
    if (el) el.textContent = state.email;
    return;
  }

  status.style.display = 'none';
  banner.style.display = 'flex';
}

function dismissSyncBanner() {
  localStorage.setItem(SYNC_DISMISS_KEY, '1');
  const b = document.getElementById('profSyncBanner');
  if (b) b.style.display = 'none';
}

// ── Modal control ─────────────────────────────────────────────
function openSyncModal(mode) {
  _syncMode = (mode === 'load') ? 'load' : 'save';
  const overlay = document.getElementById('syncModalOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  _showSyncStep('enter');
  switchSyncTab(_syncMode);
  const err = document.getElementById('syncError');  if (err) err.style.display = 'none';
  const err2 = document.getElementById('syncCodeError'); if (err2) err2.style.display = 'none';
  const input = document.getElementById('syncEmailInput');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 120); }
}

function closeSyncModal() {
  const overlay = document.getElementById('syncModalOverlay');
  if (!overlay) return;
  if (overlay.style.display === 'none') return;
  // Play exit animation, then hide. Guard against repeated clicks.
  if (overlay._closingTimer) return;
  overlay.classList.add('is-closing');
  overlay._closingTimer = setTimeout(() => {
    overlay.classList.remove('is-closing');
    overlay.style.display = 'none';
    overlay._closingTimer = null;
  }, 200);
}

function _showSyncStep(step) {
  const ids = { enter: 'syncStepEnter', code: 'syncStepCode', done: 'syncStepDone' };
  Object.keys(ids).forEach(k => {
    const el = document.getElementById(ids[k]);
    if (el) el.style.display = (k === step) ? 'block' : 'none';
  });
}

function switchSyncTab(mode) {
  _syncMode = mode;
  const save = document.getElementById('syncTabSave');
  const load = document.getElementById('syncTabLoad');
  const btn  = document.getElementById('syncPrimaryBtn');
  const title = document.getElementById('syncModalTitle');
  const sub   = document.getElementById('syncModalSub');
  if (save) save.classList.toggle('active', mode === 'save');
  if (load) load.classList.toggle('active', mode === 'load');
  if (btn)  btn.textContent = 'Send code';
  if (title) title.textContent = (mode === 'save')
    ? 'Save your data to email'
    : 'Load your data on this device';
  if (sub) sub.textContent = (mode === 'save')
    ? "We'll send a 6-digit code to your email. Enter it to back up your profile, history and personality so you can access them on any device."
    : 'Enter the email you used before. We\'ll send a 6-digit code to verify it\'s you and restore your data on this device.';
}

function syncBackToEnter() { _showSyncStep('enter'); }

// ── Step 1: request code ──────────────────────────────────────
async function handleSyncPrimary() {
  const input = document.getElementById('syncEmailInput');
  const err   = document.getElementById('syncError');
  const btn   = document.getElementById('syncPrimaryBtn');
  const email = (input?.value || '').trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (err) { err.textContent = 'Please enter a valid email address.'; err.style.display = 'block'; }
    return;
  }
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    const base = _syncApiBase();
    const res = await fetch(base + '/api/sync/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, mode: _syncMode })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const serverErr = data.error || `HTTP ${res.status}`;
      const err2 = new Error(serverErr);
      err2.serverCode = data.error;
      err2.status = res.status;
      throw err2;
    }

    _syncEmail = email;
    const sentTo = document.getElementById('syncSentTo');
    if (sentTo) sentTo.textContent = email;
    _showSyncStep('code');
    const codeInput = document.getElementById('syncCodeInput');
    if (codeInput) { codeInput.value = ''; setTimeout(() => codeInput.focus(), 100); }
  } catch (e) {
    if (err) {
      let msg = 'Could not send code. Please try again.';
      if (e?.status === 404)                    msg = 'Sync is not available on this server yet. Please try again later.';
      else if (e?.serverCode === 'sync_not_configured') msg = 'Sync is not enabled on the server yet.';
      else if (e?.serverCode === 'rate_limited')        msg = 'Too many requests. Please wait a few minutes.';
      else if (e?.serverCode === 'email_failed')        msg = 'We could not send the email. Please try again.';
      err.textContent = msg;
      err.style.display = 'block';
    }
    console.warn('[sync] request failed', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Send code'; }
  }
}

// ── Step 2: redeem code + push/pull ───────────────────────────
async function handleSyncCode() {
  const input = document.getElementById('syncCodeInput');
  const err   = document.getElementById('syncCodeError');
  const btn   = document.getElementById('syncCodeBtn');
  const code  = (input?.value || '').trim();

  if (!/^\d{6}$/.test(code)) {
    if (err) { err.textContent = 'Enter the 6-digit code from the email.'; err.style.display = 'block'; }
    return;
  }
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }

  try {
    const base = _syncApiBase();
    const res = await fetch(base + '/api/sync/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _syncEmail, code })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.token) throw new Error(data.error || 'Invalid code');

    // Persist the sync credential
    _syncSetState({ email: _syncEmail, token: data.token, lastPush: 0 });

    // Now do the actual save or load
    if (_syncMode === 'save') {
      await syncPushNow(true);
      _finishSync(`Your data is now saved to <strong>${_syncEmail}</strong>. Open Chessonality on another device, click "I have a code" and sign in with the same email to restore it.`);
    } else {
      const ok = await syncPullNow();
      if (ok) {
        _finishSync(`Your data has been restored on this device from <strong>${_syncEmail}</strong>.`);
      } else {
        _finishSync(`This device is now linked to <strong>${_syncEmail}</strong>, but we didn't find any saved data yet.`);
      }
    }
  } catch (e) {
    if (err) {
      err.textContent = 'That code is invalid or expired. Please try again.';
      err.style.display = 'block';
    }
    console.warn('[sync] redeem failed', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm'; }
  }
}

function _finishSync(htmlMsg) {
  _showSyncStep('done');
  const sub = document.getElementById('syncDoneSub');
  if (sub) sub.innerHTML = htmlMsg;
  updateSyncBanner();
}

// ── Collect local data into a single payload ────────────────
async function _syncCollectPayload() {
  const payload = { v: 1, exportedAt: new Date().toISOString() };
  try {
    if (typeof dbGetHistory === 'function') payload.history = await dbGetHistory();
  } catch (_) { payload.history = []; }
  try {
    if (typeof dbGetProfile === 'function') {
      payload.profile = {
        username:     await dbGetProfile('username'),
        lastPlatform: await dbGetProfile('lastPlatform'),
        lastUsername: await dbGetProfile('lastUsername'),
      };
    }
  } catch (_) { payload.profile = {}; }
  // Engagement / streak keys from localStorage (best-effort)
  try {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('ce-') && k !== SYNC_LOCAL_KEY && k !== SYNC_DISMISS_KEY) {
        ls[k] = localStorage.getItem(k);
      }
    }
    payload.localStorage = ls;
  } catch (_) {}
  return payload;
}

async function _syncApplyPayload(p) {
  if (!p || typeof p !== 'object') return false;
  // Restore history entries (merge.never delete local)
  try {
    if (Array.isArray(p.history) && typeof dbSaveHistoryEntry === 'function') {
      for (const entry of p.history) {
        if (entry && entry.id) await dbSaveHistoryEntry(entry);
      }
    }
  } catch (e) { console.warn('[sync] apply history failed', e); }
  try {
    if (p.profile && typeof dbSetProfile === 'function') {
      for (const [k, v] of Object.entries(p.profile)) {
        if (v != null) await dbSetProfile(k, v);
      }
    }
  } catch (e) { console.warn('[sync] apply profile failed', e); }
  try {
    if (p.localStorage && typeof p.localStorage === 'object') {
      for (const [k, v] of Object.entries(p.localStorage)) {
        if (typeof v === 'string' && k.startsWith('ce-')) {
          localStorage.setItem(k, v);
        }
      }
    }
  } catch (_) {}
  return true;
}

// ── Push / pull (callable after linking) ─────────────────────
async function syncPushNow(silent) {
  const s = _syncState();
  if (!s || !s.token) { if (!silent) alert('Not linked yet.'); return false; }
  try {
    const payload = await _syncCollectPayload();
    const base = _syncApiBase();
    const res = await fetch(base + '/api/sync/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: s.token, payload })
    });
    if (!res.ok) throw new Error('push failed');
    s.lastPush = Date.now();
    _syncSetState(s);
    if (!silent) _toast('Synced to ' + s.email);
    return true;
  } catch (e) {
    console.warn('[sync] push failed', e);
    if (!silent) _toast('Sync failed.please try again');
    return false;
  }
}

async function syncPullNow() {
  const s = _syncState();
  if (!s || !s.token) return false;
  try {
    const base = _syncApiBase();
    const res = await fetch(base + '/api/sync/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: s.token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'pull failed');
    if (!data.payload) return false;
    await _syncApplyPayload(data.payload);
    // Refresh profile UI if visible
    try { if (typeof renderFullProfile === 'function') renderFullProfile(); } catch (_) {}
    return true;
  } catch (e) {
    console.warn('[sync] pull failed', e);
    return false;
  }
}

function syncUnlink() {
  if (!confirm('Unlink this device from your email? Your local data stays on this device.')) return;
  _syncSetState(null);
  localStorage.removeItem(SYNC_DISMISS_KEY);
  updateSyncBanner();
  _toast('Unlinked from email');
}

// Tiny toast helper (no deps)
function _toast(msg) {
  try {
    let t = document.getElementById('syncToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'syncToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);'
        + 'background:#111827;color:#fff;padding:10px 18px;border-radius:10px;'
        + 'font-size:0.88rem;z-index:11000;box-shadow:0 8px 24px rgba(0,0,0,0.4);'
        + 'border:1px solid rgba(148,163,184,0.3);opacity:0;transition:opacity 0.2s ease;';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity = '1'; });
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => { t.style.opacity = '0'; }, 2400);
  } catch (_) {}
}

// ── Wire into profile rendering ───────────────────────────────
(function wireSyncBanner() {
  const attach = () => {
    // Update banner whenever profile page is shown
    if (typeof window.renderFullProfile === 'function') {
      const orig = window.renderFullProfile;
      window.renderFullProfile = function () {
        const out = orig.apply(this, arguments);
        try { updateSyncBanner(); } catch (_) {}
        return out;
      };
    }
    // Also hook showPage so banner updates immediately when profile tab is opened
    if (typeof window.showPage === 'function') {
      const origShow = window.showPage;
      window.showPage = function (name) {
        const r = origShow.apply(this, arguments);
        if (name === 'profile') try { updateSyncBanner(); } catch (_) {}
        return r;
      };
    }
    try { updateSyncBanner(); } catch (_) {}

    // Auto-push (debounced) whenever a new history entry is saved
    if (typeof window.dbSaveHistoryEntry === 'function') {
      const origSave = window.dbSaveHistoryEntry;
      let pushTimer = null;
      window.dbSaveHistoryEntry = async function (entry) {
        const r = await origSave.apply(this, arguments);
        const s = _syncState();
        if (s && s.token) {
          clearTimeout(pushTimer);
          pushTimer = setTimeout(() => { syncPushNow(true); }, 2000);
        }
        return r;
      };
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

// Expose for inline onclick handlers
window.openSyncModal   = openSyncModal;
window.closeSyncModal  = closeSyncModal;
window.switchSyncTab   = switchSyncTab;
window.syncBackToEnter = syncBackToEnter;
window.handleSyncPrimary = handleSyncPrimary;
window.handleSyncCode    = handleSyncCode;
window.syncPushNow       = syncPushNow;
window.syncPullNow       = syncPullNow;
window.syncUnlink        = syncUnlink;
window.dismissSyncBanner = dismissSyncBanner;
window.updateSyncBanner  = updateSyncBanner;
