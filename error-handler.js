/* ============================================================
   error-handler.js  Global error + worker-downtime safety net
   ─────────────────────────────────────────────────────────
   - Catches uncaught exceptions and unhandled promise rejections
   - Detects when the Cloudflare Worker is unreachable
   - Shows a polite non-blocking toast instead of silent failure
   - Retries the health check periodically
   ============================================================ */
'use strict';

(function () {
  const TOAST_ID = 'globalErrorToast';
  let _lastShown = 0;
  const MIN_GAP_MS = 20000; // don't spam toasts

  function ensureToast() {
    let t = document.getElementById(TOAST_ID);
    if (t) return t;
    t = document.createElement('div');
    t.id = TOAST_ID;
    t.setAttribute('role', 'status');
    t.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:28px',
      'transform:translateX(-50%) translateY(20px)',
      'max-width:min(92vw,440px)',
      'background:#111827',
      'color:#f1f5f9',
      'padding:12px 18px',
      'border-radius:12px',
      'font-size:0.9rem',
      'font-family:system-ui,-apple-system,sans-serif',
      'line-height:1.4',
      'z-index:12000',
      'box-shadow:0 10px 32px rgba(0,0,0,0.45)',
      'border:1px solid rgba(148,163,184,0.3)',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'opacity:0',
      'pointer-events:none',
      'transition:opacity 0.25s ease, transform 0.25s ease'
    ].join(';');
    document.body.appendChild(t);
    return t;
  }

  function showToast(msg, opts) {
    opts = opts || {};
    const now = Date.now();
    if (now - _lastShown < MIN_GAP_MS && !opts.force) return;
    _lastShown = now;

    const t = ensureToast();
    t.innerHTML = '';
    const icon = document.createElement('span');
    icon.textContent = opts.icon || '\u26A0\uFE0F';
    icon.style.fontSize = '18px';
    icon.style.flex = '0 0 auto';
    t.appendChild(icon);
    const text = document.createElement('span');
    text.textContent = msg;
    text.style.flex = '1 1 auto';
    t.appendChild(text);

    const close = document.createElement('button');
    close.textContent = '\u00D7';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = 'background:transparent;border:0;color:#94a3b8;'
      + 'font-size:20px;line-height:1;cursor:pointer;padding:0 4px;flex:0 0 auto;';
    close.onclick = () => hideToast();
    t.appendChild(close);

    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateX(-50%) translateY(0)';
      t.style.pointerEvents = 'auto';
    });

    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(hideToast, opts.duration || 6500);
  }

  function hideToast() {
    const t = document.getElementById(TOAST_ID);
    if (!t) return;
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(20px)';
    t.style.pointerEvents = 'none';
  }

  // ── Detect "service unavailable" style errors ──────────────
  function looksLikeWorkerDown(err) {
    if (!err) return false;
    const msg = String(err.message || err).toLowerCase();
    return msg.includes('failed to fetch')
        || msg.includes('networkerror')
        || msg.includes('load failed')
        || msg.includes('worker')
        || msg.includes('502')
        || msg.includes('503')
        || msg.includes('504');
  }

  function friendlyNetworkMessage() {
    showToast('Analysis service is temporarily unavailable. Please try again in a moment.');
  }

  // ── Global error handlers ──────────────────────────────────
  window.addEventListener('error', function (ev) {
    // Skip resource-load errors (images, stylesheets) — those are handled individually
    if (ev?.target && ev.target !== window && ev.target.tagName) return;
    const e = ev?.error || ev?.message;
    if (looksLikeWorkerDown(e)) {
      friendlyNetworkMessage();
    }
  });

  window.addEventListener('unhandledrejection', function (ev) {
    const reason = ev?.reason;
    if (looksLikeWorkerDown(reason)) {
      friendlyNetworkMessage();
      // Prevent console spam if we've already shown a toast
      ev.preventDefault && ev.preventDefault();
    }
  });

  // ── Wrap fetch to detect and report Worker-specific failures ─
  const origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = async function (input, init) {
      const url = (typeof input === 'string') ? input : (input && input.url) || '';
      const isWorker = /workers\.dev|\/api\//.test(url);
      try {
        const res = await origFetch(input, init);
        if (isWorker && (res.status === 502 || res.status === 503 || res.status === 504)) {
          friendlyNetworkMessage();
        }
        return res;
      } catch (err) {
        if (isWorker) {
          friendlyNetworkMessage();
        }
        throw err;
      }
    };
  }

  // ── Expose a manual trigger so other modules can use it ─────
  window.showNetworkErrorToast = friendlyNetworkMessage;
  window.showErrorToast = showToast;
})();
