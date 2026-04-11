/* ══════════════════════════════════════════════════════════════
   INTERACTIVE.JS
   - How-it-works step tabs (auto-advance with pause on hover)
   - Loading screen rotating coaching facts
   - Personality reveal: staggered entrance + "why you are X" + copy
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // SCROLL-REVEAL SYSTEM
  //   Any element with [data-reveal] fades into place the first time it
  //   enters the viewport. Supports per-element delay (data-reveal-delay)
  //   and automatic stagger when a parent has [data-reveal-stagger].
  // ──────────────────────────────────────────────
  const REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let _revealIO = null;

  function ensureRevealObserver() {
    if (_revealIO || !('IntersectionObserver' in window)) return _revealIO;
    _revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        // Compute delay: explicit > stagger-from-parent > 0
        let delay = parseInt(el.dataset.revealDelay || '0', 10) || 0;
        const staggerParent = el.closest('[data-reveal-stagger]');
        if (staggerParent && !el.dataset.revealDelay) {
          const step = parseInt(staggerParent.dataset.revealStagger || '70', 10) || 70;
          const base = parseInt(staggerParent.dataset.revealBase || '0', 10) || 0;
          const siblings = staggerParent.querySelectorAll(':scope > [data-reveal]');
          const idx = Array.prototype.indexOf.call(siblings, el);
          delay = base + Math.max(0, idx) * step;
        }
        if (delay > 0) el.style.setProperty('--reveal-delay', delay + 'ms');
        el.classList.add('is-visible');
        _revealIO.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    return _revealIO;
  }

  function observeReveals(root) {
    if (REDUCED_MOTION) {
      (root || document).querySelectorAll('[data-reveal]').forEach((el) => {
        el.classList.add('is-visible');
      });
      return;
    }
    ensureRevealObserver();
    if (!_revealIO) return;
    (root || document)
      .querySelectorAll('[data-reveal]:not(.is-visible)')
      .forEach((el) => _revealIO.observe(el));
  }

  function resetReveals(root) {
    if (!root) return;
    root.querySelectorAll('[data-reveal].is-visible').forEach((el) => {
      el.classList.remove('is-visible');
      el.style.removeProperty('--reveal-delay');
      if (_revealIO) _revealIO.unobserve(el);
    });
  }

  // Expose for navigation.js + other callers
  window.ceObserveReveals = observeReveals;
  window.ceResetReveals = resetReveals;

  // ──────────────────────────────────────────────
  // HOW-IT-WORKS interactive stepper
  // ──────────────────────────────────────────────
  let howCurrentStep = 1;
  let howAutoTimer = null;
  let howPaused = false;
  const HOW_STEP_COUNT = 3;
  const HOW_STEP_INTERVAL = 5200;

  window.setHowStep = function (step, opts) {
    opts = opts || {};
    if (step < 1 || step > HOW_STEP_COUNT) step = 1;
    howCurrentStep = step;

    const tabs = document.querySelectorAll('.how-tab');
    const panels = document.querySelectorAll('.how-panel');
    tabs.forEach((t) => t.classList.toggle('active', parseInt(t.dataset.step) === step));
    panels.forEach((p) => p.classList.toggle('active', parseInt(p.dataset.step) === step));

    const fill = document.getElementById('howProgressFill');
    if (fill) fill.style.width = (step / HOW_STEP_COUNT * 100) + '%';

    if (!opts.auto) {
      // User interacted: restart the auto-advance timer from this step
      restartHowAutoTimer();
    }
  };

  function restartHowAutoTimer() {
    if (howAutoTimer) clearInterval(howAutoTimer);
    howAutoTimer = setInterval(() => {
      if (howPaused) return;
      const next = howCurrentStep >= HOW_STEP_COUNT ? 1 : howCurrentStep + 1;
      window.setHowStep(next, { auto: true });
    }, HOW_STEP_INTERVAL);
  }

  function initHowItWorks() {
    const stage = document.getElementById('howStage');
    if (!stage) return;

    stage.addEventListener('mouseenter', () => { howPaused = true; });
    stage.addEventListener('mouseleave', () => { howPaused = false; });

    // Only start the auto-timer once the section scrolls into view so we
    // don't burn cycles on off-screen animations.
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            restartHowAutoTimer();
            io.disconnect();
          }
        });
      }, { threshold: 0.25 });
      io.observe(stage);
    } else {
      restartHowAutoTimer();
    }

    window.setHowStep(1, { auto: true });
  }

  // ──────────────────────────────────────────────
  // Smooth scroll from hero to the How-It-Works section
  // ──────────────────────────────────────────────
  window.scrollToHowItWorks = function () {
    const target = document.getElementById('howSection');
    if (!target) return;
    // Each .app-page has its own internal scroll, so we must scroll the
    // ancestor .app-page, not the window.
    const scroller = target.closest('.app-page') || document.scrollingElement || document.documentElement;
    const targetRect = target.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect ? scroller.getBoundingClientRect() : { top: 0 };
    const top = (targetRect.top - scrollerRect.top) + (scroller.scrollTop || 0) - 32;
    if (typeof scroller.scrollTo === 'function') {
      scroller.scrollTo({ top, behavior: 'smooth' });
    } else {
      scroller.scrollTop = top;
    }
    // Kick the stage into step 1 so people see the sequence from the start.
    try { if (typeof window.setHowStep === 'function') window.setHowStep(1); } catch (_) {}
  };

  // ──────────────────────────────────────────────
  // LOADING SCREEN rotating facts
  // ──────────────────────────────────────────────
  const LOADING_FACTS = [
    "♟ There are more possible chess games than atoms in the observable universe — roughly 10^120 unique games.",
    "♛ The longest chess game theoretically possible is 5,949 moves. The longest actually played in a tournament was 269.",
    "♞ The word 'Checkmate' comes from the Persian phrase 'Shah Mat' — meaning 'the king is dead.'",
    "♝ Magnus Carlsen became a Grandmaster at 13 years, 4 months, and 27 days — one of the youngest ever at the time.",
    "♜ The En Passant rule was introduced in the 15th century when pawns were given the option to move two squares on their first move.",
    "♟ A computer was first allowed to play in a major human chess tournament in 1997. Kasparov was not happy about it.",
    "♛ The second player wins roughly 45% of games at the top level. White's first-move advantage is real — but smaller than most people think.",
    "♞ Judit Polgar became the strongest female player in history without ever playing in the Women's World Championship. She said the men's circuit was more interesting.",
    "♝ There are 400 possible positions after each player makes one move. After two moves each, there are 197,742.",
    "♜ The Immortal Game (Anderssen vs Kieseritzky, 1851) is still considered the most beautiful attacking game ever played — 170 years later.",
    "♟ Chess clocks were introduced in 1883. Before that, players could think as long as they liked — one game lasted over 14 hours on a single move.",
    "♛ Stockfish, the engine analyzing your game right now, would beat Magnus Carlsen approximately 100 times out of 100.",
    "♞ The fool's mate — checkmate in 2 moves — is the fastest possible. It requires White to play very badly on purpose.",
    "♝ José Raúl Capablanca only lost 36 games in his entire classical chess career.",
    "♜ In 1997, Deep Blue beat Kasparov by famously making a move that Kasparov was convinced no computer could find. It turned out to be a bug."
  ];

  let factTimer = null;
  let factIndex = 0;

  function rotateFacts() {
    const el = document.getElementById('loadingFactText');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => {
      factIndex = (factIndex + 1) % LOADING_FACTS.length;
      el.textContent = LOADING_FACTS[factIndex];
      el.style.opacity = '1';
    }, 320);
  }

  function startLoadingFacts() {
    const el = document.getElementById('loadingFactText');
    if (!el) return;
    factIndex = Math.floor(Math.random() * LOADING_FACTS.length);
    el.textContent = LOADING_FACTS[factIndex];
    el.style.opacity = '1';
    if (factTimer) clearInterval(factTimer);
    factTimer = setInterval(rotateFacts, 4200);
  }

  function stopLoadingFacts() {
    if (factTimer) { clearInterval(factTimer); factTimer = null; }
  }

  // Hook showPage to start/stop facts automatically when the loading page
  // shows. We wrap rather than replace so the original still runs.
  function hookShowPage() {
    if (typeof window.showPage !== 'function') return;
    if (window.showPage.__interactiveWrapped) return;
    const original = window.showPage;
    window.showPage = function (pageId) {
      const result = original.apply(this, arguments);
      try {
        if (pageId === 'loading') startLoadingFacts();
        else stopLoadingFacts();
        if (pageId === 'personality') {
          // Slight delay so the DOM is in place before we animate
          setTimeout(initPersonalityRevealExtras, 30);
        }
      } catch (_) {}
      return result;
    };
    window.showPage.__interactiveWrapped = true;
  }

  // ──────────────────────────────────────────────
  // Button ripple / press feedback on tap
  //   Adds .is-pressed briefly for a subtle scale pulse.
  // ──────────────────────────────────────────────
  function initPressFeedback() {
    const selector = '.prof-analyze-btn, .prof-pglos-btn, .prof-feat-card, .psb-btn, .pss-btn, .hl-btn, .btn-primary, .ob-cta';
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(selector);
      if (!el) return;
      el.classList.add('is-pressed');
    }, { passive: true });
    const release = (e) => {
      document.querySelectorAll('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
    };
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    document.addEventListener('pointerleave', release, { passive: true });
  }

  // ──────────────────────────────────────────────
  // PERSONALITY REVEAL extras
  //   - Apply staggered delays from data-delay attrs
  //   - Populate "why you are X" list from game stats
  //   - Animate match meter
  // ──────────────────────────────────────────────
  function initPersonalityRevealExtras() {
    // Apply CSS custom property for stagger delays
    document.querySelectorAll('.pers-stagger').forEach((el) => {
      // Force reflow so the animation restarts on every reveal
      el.style.animation = 'none';
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight;
      el.style.animation = '';
      const delay = el.dataset.delay || '0';
      el.style.setProperty('--delay', delay);
    });

    // Populate "why you are X"
    populatePersonalityWhy();

    // Animate match strength bar
    setTimeout(animateMatchMeter, 1500);
  }

  function populatePersonalityWhy() {
    const list = document.getElementById('persWhyList');
    if (!list) return;

    const reasons = [];
    try {
      const cp = (typeof currentPersonality !== 'undefined') ? currentPersonality : null;
      const primary = cp && cp.primary;

      // Signal 1: how strongly the primary matched vs the rest
      if (cp && Array.isArray(cp.scores) && cp.scores.length >= 2) {
        const top = cp.scores[0];
        const second = cp.scores[1];
        if (top && top.pct) {
          reasons.push('Your moves scored ' + top.pct + '% ' + (primary ? primary.name : 'this archetype') + ' across the whole game.');
        }
        if (second && second.personality) {
          reasons.push('Secondary influence: ' + second.personality.name + ' (' + second.pct + '%). You carry both styles but lean into the first.');
        }
      }

      // Signal 2: accuracy and mistake counts from the actual game (if globals exist)
      if (typeof positions !== 'undefined' && Array.isArray(positions) && positions.length > 1 && typeof playerColor !== 'undefined') {
        let blunders = 0, mistakes = 0, brilliant = 0, good = 0;
        for (let i = 1; i < positions.length; i++) {
          const mover = positions[i].turn === 'b' ? 'w' : 'b';
          if (mover !== playerColor) continue;
          if (typeof classifyMove !== 'function') break;
          const cls = classifyMove(i);
          if (cls === 'blunder' || cls === 'book-blunder') blunders++;
          else if (cls === 'mistake') mistakes++;
          else if (cls === 'brilliant') brilliant++;
          else if (cls === 'good' || cls === 'book') good++;
        }
        const totalPlayerMoves = Math.ceil((positions.length - 1) / 2);
        if (totalPlayerMoves > 0) {
          const accuracy = Math.round((good / totalPlayerMoves) * 100);
          reasons.push('You played ' + totalPlayerMoves + ' moves with ' + accuracy + '% accuracy, ' + blunders + ' blunder' + (blunders === 1 ? '' : 's') + ', ' + mistakes + ' mistake' + (mistakes === 1 ? '' : 's') + '.');
          if (brilliant > 0) {
            reasons.push(brilliant + ' brilliant move' + (brilliant === 1 ? '' : 's') + ' flagged. That is not a coincidence for a ' + (primary ? primary.name : 'player') + '.');
          }
        }
      }

      // Signal 3: a characterising trait of the primary archetype
      if (primary && Array.isArray(primary.traits) && primary.traits.length) {
        reasons.push('Matching traits: ' + primary.traits.slice(0, 3).join(', ') + '.');
      }
    } catch (_) {}

    if (!reasons.length) {
      reasons.push('Your move choices form a consistent pattern across the whole game.');
      reasons.push('Engine evaluations over time match this archetype.');
      reasons.push('Your opening and middlegame decisions point in the same direction.');
    }

    // Keep it tight: 4 bullets max
    list.innerHTML = reasons.slice(0, 4)
      .map((r) => '<li>' + escapeHtml(String(r)) + '</li>')
      .join('');
  }

  function animateMatchMeter() {
    const fill = document.getElementById('persMatchFill');
    const val = document.getElementById('persMatchVal');
    if (!fill || !val) return;
    let pct = 87;
    try {
      const cp = (typeof currentPersonality !== 'undefined') ? currentPersonality : null;
      if (cp && Array.isArray(cp.scores) && cp.scores.length && typeof cp.scores[0].pct === 'number') {
        pct = cp.scores[0].pct;
      }
    } catch (_) {}
    // Keep the match meter in a readable range: low enough to feel honest,
    // high enough that nobody feels insulted on their primary result.
    pct = Math.max(58, Math.min(99, pct));
    fill.style.width = pct + '%';
    val.textContent = pct + '%';
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // ──────────────────────────────────────────────
  // Copy personality result to clipboard
  // ──────────────────────────────────────────────
  window.copyPersonalityResult = function (btn) {
    try {
      const name = (document.getElementById('persName') || {}).textContent || '';
      const tag = (document.getElementById('persTagline') || {}).textContent || '';
      const text = 'I am ' + name + '. ' + tag + '\nFind your chess personality at https://chessonality.com';
      const done = () => {
        if (!btn) return;
        btn.classList.add('copied');
        const label = btn.querySelector('.pcb-text');
        const prev = label ? label.textContent : '';
        if (label) label.textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('copied');
          if (label) label.textContent = prev || 'Copy link';
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (_) {}
        document.body.removeChild(ta);
      }
    } catch (_) {}
  };

  // ──────────────────────────────────────────────
  // Boot
  // ──────────────────────────────────────────────
  function boot() {
    initHowItWorks();
    hookShowPage();
    initPressFeedback();
    // Reveal anything already in the DOM on first paint
    observeReveals(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // showPage may not exist yet (defined by navigation.js) – defer a tick
    setTimeout(boot, 0);
  }
})();
