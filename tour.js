// ==============================================================
//  HISTORY FILTER / SEARCH (profile)
// ==============================================================
let _histFilter = 'all';
let _histSearch = '';
let _historyCache = [];

function setHistoryFilter(filter, btn) {
  _histFilter = filter;
  document.querySelectorAll('.prof-filter-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyHistoryFilter();
}

function filterHistory() {
  _histSearch = (document.getElementById('profHistorySearch')?.value || '').toLowerCase().trim();
  applyHistoryFilter();
}

function applyHistoryFilter() {
  const cards = document.querySelectorAll('#profHistory .ph-card');
  cards.forEach(card => {
    const opponent = (card.querySelector('.ph-card-vs')?.textContent || '').toLowerCase();
    const resultEl = card.querySelector('.ph-result-badge');
    const resultCls = resultEl ? resultEl.className : '';

    let show = true;

    // Text search
    if (_histSearch && !opponent.includes(_histSearch)) show = false;

    // Result filter
    if (_histFilter === 'win'  && !resultCls.includes('ph-win'))  show = false;
    if (_histFilter === 'loss' && !resultCls.includes('ph-loss')) show = false;
    if (_histFilter === 'draw' && !resultCls.includes('ph-draw')) show = false;

    card.style.display = show ? '' : 'none';
  });
}

// ==============================================================
//  SHARE PERSONALITY RESULT
// ==============================================================
async function sharePersonality() {
  if (!currentPersonality) return;
  const p = currentPersonality.primary;
  const text = `I'm a ${p.emoji} ${p.name} chess player! ${p.tagline}. Discover yours on Chessonality:`;

  // Try native share API first
  if (navigator.share) {
    try {
      await navigator.share({
        title: `Chessonality: ${p.name}`,
        text,
        url: window.location.href
      });
      return;
    } catch {}
  }

  // Fallback: copy to clipboard
  const fullText = `${text}\n${window.location.href}`;
  try {
    await navigator.clipboard.writeText(fullText);
    const btn = document.querySelector('.pers-share-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '&#10003; Copied!';
      setTimeout(() => btn.innerHTML = orig, 2000);
    }
  } catch {
    // Fallback fallback: textarea copy
    const ta = document.createElement('textarea');
    ta.value = fullText;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

// ==============================================================
//  RETRY HANDLING for API fetches
// ==============================================================
async function fetchWithRetry(fetchFn, retries = 2, delay = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fetchFn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ==============================================================
//  ONBOARDING WALKTHROUGH
// ==============================================================
let _obStep = 0;
function showOnboarding() {
  _obStep = 0;
  renderOnboardingStep();
  document.getElementById('onboardingOverlay').style.display = '';
}
function closeOnboarding() {
  document.getElementById('onboardingOverlay').style.display = 'none';
  localStorage.setItem('ce-onboarded', '1');
  // If the user hasn't saved a theme preference yet, lock in dark — the
  // editorial design is tuned for it and a lot of the imagery assumes it.
  if (!localStorage.getItem('ce-theme')) {
    localStorage.setItem('ce-theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
    if (typeof updateThemeIcon === 'function') updateThemeIcon('dark');
  }
}
function nextOnboardingStep() {
  _obStep++;
  if (_obStep >= 4) { closeOnboarding(); return; }
  renderOnboardingStep();
}
function obPickTheme(theme) {
  // Apply the chosen theme
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ce-theme', theme);
  // Brief celebration then close
  const themeCard = document.querySelector('.ob-theme-card');
  if (themeCard) {
    themeCard.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    themeCard.style.transform = 'scale(1.04)';
    themeCard.style.opacity = '0.7';
  }
  setTimeout(closeOnboarding, 320);
}
function renderOnboardingStep() {
  for (let i = 0; i < 4; i++) {
    const scene = document.getElementById('obScene' + i);
    if (scene) {
      scene.style.display = i === _obStep ? '' : 'none';
      // Trigger entrance animation
      if (i === _obStep) {
        scene.classList.remove('ob-animate-in');
        void scene.offsetWidth;
        scene.classList.add('ob-animate-in');
      }
    }
    const dot = document.getElementById('obDot' + i);
    if (dot) dot.classList.toggle('active', i === _obStep);
  }
}
function checkOnboarding() {
  if (!localStorage.getItem('ce-onboarded')) {
    setTimeout(showOnboarding, 600);
  }
}

// ── Onboarding personality quiz ──
function obPickPersonality(el) {
  // Deselect all
  document.querySelectorAll('.ob-quiz-animal').forEach(a => a.classList.remove('ob-quiz-selected'));
  el.classList.add('ob-quiz-selected');
  const pid = el.dataset.personality;
  const p = PERSONALITIES[pid];
  if (!p) return;
  localStorage.setItem('ce-ob-guess', pid);
  const resultEl = document.getElementById('obQuizResult');
  const textEl = document.getElementById('obQuizResultText');
  const skipEl = document.getElementById('obQuizSkip');
  if (textEl) textEl.innerHTML = `You think you're <strong style="color:${p.color}">${p.name}</strong>? Let's analyze a game and see if the AI agrees!`;
  if (resultEl) resultEl.style.display = '';
  if (skipEl) skipEl.style.display = 'none';
}

// ==============================================================
//  GUIDED TOUR SYSTEM
//  Editorial amber/serif tooltip that walks new visitors through
//  each page. Mobile-friendly: on narrow screens the tooltip is
//  pinned to the bottom of the screen as a bottom sheet and the
//  highlighted target is auto-scrolled into view.
// ==============================================================
let _tourSteps = [];
let _tourIdx = 0;
let _tourKey = '';

// Step shape: { el: 'selector', title: 'Short title', body: 'One-sentence description.' }

const ANALYSIS_TOUR_STEPS = [
  { el: '#analysisPersonalityCard', title: 'Your chess personality',
    body: 'Detected from how you actually played this game — your opening choice, move patterns, and decisions.' },
  { el: '.board-wrapper',           title: 'The board',
    body: 'Your game plays out here. The bar on the left is the evaluation — it shifts as you step through moves.' },
  { el: '.nav-controls',            title: 'Navigate moves',
    body: 'Step through the game one move at a time. The arrow keys work too.' },
  { el: '.move-list',               title: 'Move quality',
    body: 'Every move is color-coded by engine quality. Click any move to jump there instantly.' },
  { el: '#explainBtn',              title: 'Explain this move',
    body: 'A full AI breakdown of the current position: the plan, the pawn structure, and the engine\'s top choice.' },
  { el: '.walkthrough-cta',         title: 'Game walkthrough',
    body: 'A guided tour through the turning points of your game — best and worst moves explained in context.' },
  { el: '.coach-cta-analysis',      title: 'AI Coach',
    body: 'A personalised practice plan built around your chess personality: drills, themes, and endgame homework.' }
];

const PROFILE_TOUR_STEPS = [
  { el: '.prof-identity',          title: 'Your profile',
    body: 'Your display name and total games analyzed. Tap the pencil to rename yourself.' },
  { el: '.prof-analyze-btn',       title: 'Analyze a new game',
    body: 'Import from Lichess or Chess.com and add it to your history.' },
  { el: '.prof-tabs',              title: 'Overview & history',
    body: 'Switch between your aggregate personality and a list of every game you\'ve reviewed.' },
  { el: '.prof-primary',           title: 'Your dominant style',
    body: 'The chess personality that shows up most often across all of your analyzed games.' },
  { el: '.prof-section-breakdown', title: 'Your trait split',
    body: 'How your personality divides across archetypes — a running portrait of how you play.' },
  { el: '.prof-feat-rep',          title: 'Opening repertoire',
    body: 'Openings matched to your chess personality and your actual game results.' },
  { el: '.prof-feat-dna',          title: 'Game insights',
    body: 'Critical moments and opening performance, collected from every game you\'ve analyzed.' },
  { el: '.prof-feat-coach',        title: 'AI Coach',
    body: 'A running practice plan with drills, tactical themes, and endgame homework tailored to you.' }
];

function startTour(steps, storageKey, force) {
  _tourSteps = steps;
  _tourIdx = 0;
  _tourKey = storageKey;

  // Filter out steps whose elements don't exist or are hidden. When a
  // step provides a comma-separated selector list (for desktop/mobile
  // anchor variants), rewrite the step to the first visible match.
  _tourSteps = steps.map(s => {
    const sels = s.el.split(',').map(x => x.trim());
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) {
        return Object.assign({}, s, { el: sel });
      }
    }
    return null;
  }).filter(Boolean);

  if (!_tourSteps.length) return;

  // If force=true (? button), always show even if already toured
  if (force) localStorage.removeItem(storageKey);

  const overlay = document.getElementById('tourOverlay');
  overlay.style.display = '';
  // Force a reflow so the entrance transition plays even on re-open.
  void overlay.offsetWidth;
  overlay.classList.add('tour-visible');

  _buildTourProgressDots();
  _renderTourStep();

  // Keyboard navigation while the tour is open
  if (!window._tourKeyBound) {
    window._tourKeyBound = true;
    document.addEventListener('keydown', _tourOnKey);
  }
}

function _tourOnKey(e) {
  const overlay = document.getElementById('tourOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  if (e.key === 'Escape') { closeTour(); }
  else if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    nextTourStep();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevTourStep();
  }
}

function _buildTourProgressDots() {
  const host = document.getElementById('tourProgress');
  if (!host) return;
  host.innerHTML = '';
  for (let i = 0; i < _tourSteps.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'tour-dot';
    host.appendChild(dot);
  }
}

function _updateTourProgressDots() {
  const host = document.getElementById('tourProgress');
  if (!host) return;
  host.querySelectorAll('.tour-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === _tourIdx);
    dot.classList.toggle('done', i < _tourIdx);
  });
}

function _renderTourStep() {
  if (_tourIdx >= _tourSteps.length) { closeTour(); return; }

  const step = _tourSteps[_tourIdx];
  const target = document.querySelector(step.el);
  if (!target) { _tourIdx++; _renderTourStep(); return; }

  const hl = document.getElementById('tourHighlight');
  const tt = document.getElementById('tourTooltip');
  const titleEl = document.getElementById('tourTitle');
  const bodyEl = document.getElementById('tourText');
  const counter = document.getElementById('tourCounter');
  const nextBtn = tt.querySelector('.tour-next');

  // On narrow screens the tooltip is pinned to the bottom of the
  // viewport, so scroll the highlighted target into view first.
  const isNarrow = window.innerWidth <= 860;
  if (isNarrow) {
    try { target.scrollIntoView({ behavior: 'instant', block: 'center' }); }
    catch (e) { target.scrollIntoView({ block: 'center' }); }
  }

  // Position highlight over the target
  const rect = target.getBoundingClientRect();
  const pad = 8;
  hl.style.left   = (rect.left - pad) + 'px';
  hl.style.top    = (rect.top - pad) + 'px';
  hl.style.width  = (rect.width + pad * 2) + 'px';
  hl.style.height = (rect.height + pad * 2) + 'px';

  // Populate content
  titleEl.textContent = step.title || '';
  bodyEl.textContent  = step.body  || '';
  counter.textContent = (_tourIdx + 1) + ' of ' + _tourSteps.length;
  _updateTourProgressDots();

  // Last step says "Got it" instead of "Next"
  const isLast = _tourIdx === _tourSteps.length - 1;
  nextBtn.innerHTML = isLast ? 'Got it' : 'Next &rarr;';

  // Reset and re-trigger the entrance animation
  tt.style.animation = 'none';
  void tt.offsetWidth;
  tt.style.animation = '';

  if (isNarrow) {
    // Mobile: CSS pins the tooltip to the bottom. Clear any inline
    // positioning that a previous desktop render may have left behind.
    tt.style.left = '';
    tt.style.top  = '';
    tt.style.maxWidth = '';
    return;
  }

  // Desktop: position below the target, flip above if it would overflow.
  tt.style.opacity = '0';
  requestAnimationFrame(() => {
    const ttRect = tt.getBoundingClientRect();
    let top  = rect.bottom + 16;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    if (top + ttRect.height > window.innerHeight - 20) {
      top = rect.top - ttRect.height - 16;
    }
    left = Math.max(16, Math.min(left, window.innerWidth - ttRect.width - 16));
    top  = Math.max(16, top);

    tt.style.left = left + 'px';
    tt.style.top  = top  + 'px';
    tt.style.opacity = '';
  });
}

function nextTourStep() {
  _tourIdx++;
  if (_tourIdx >= _tourSteps.length) { closeTour(); return; }
  _renderTourStep();
}

function prevTourStep() {
  if (_tourIdx <= 0) return;
  _tourIdx--;
  _renderTourStep();
}

function closeTour() {
  const overlay = document.getElementById('tourOverlay');
  if (overlay) {
    overlay.classList.remove('tour-visible');
    overlay.style.display = 'none';
  }
  if (_tourKey) localStorage.setItem(_tourKey, '1');
  _tourSteps = [];
  _tourIdx = 0;
  if (window._tourKeyBound) {
    document.removeEventListener('keydown', _tourOnKey);
    window._tourKeyBound = false;
  }
}

function checkAnalysisTour() {
  if (localStorage.getItem('ce-analysis-toured')) return;
  setTimeout(() => startTour(ANALYSIS_TOUR_STEPS, 'ce-analysis-toured'), 800);
}

function checkProfileTour() {
  if (localStorage.getItem('ce-profile-toured')) return;
  setTimeout(() => startTour(PROFILE_TOUR_STEPS, 'ce-profile-toured'), 600);
}

// ==============================================================
//  PERSONALITIES PRESENTATION
// ==============================================================
let _pglosIdx = 0;

function _pglosColorToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function openPglos(startIdx) {
  _pglosIdx = startIdx || 0;
  const overlay = document.getElementById('pglosOverlay');
  if (!overlay) return;

  // Build dots once
  const dotsEl = document.getElementById('pglosDots');
  if (dotsEl && !dotsEl.querySelector('.pglos-dot')) {
    dotsEl.innerHTML = PERSONALITY_LIST.map((_, i) =>
      `<button class="pglos-dot${i===0?' active':''}" onclick="pglosJump(${i})"></button>`
    ).join('');
  }

  overlay.classList.add('pglos-open');
  document.body.style.overflow = 'hidden';
  _pglosRender(null);
}

function closePglos() {
  const overlay = document.getElementById('pglosOverlay');
  if (overlay) overlay.classList.remove('pglos-open');
  document.body.style.overflow = '';
}

function pglosJump(idx) {
  if (idx === _pglosIdx) return;
  const dir = idx > _pglosIdx ? 1 : -1;
  _pglosIdx = idx;
  _pglosRender(dir);
}

function pglosGo(dir) {
  const next = _pglosIdx + dir;
  if (next < 0 || next >= PERSONALITY_LIST.length) return;
  _pglosIdx = next;
  _pglosRender(dir);
}

function _pglosRender(dir) {
  const p = PERSONALITY_LIST[_pglosIdx];
  const stage = document.getElementById('pglosStage');
  const bg    = document.getElementById('pglosBg');
  const counter = document.getElementById('pglosCounter');
  const dotsEl  = document.getElementById('pglosDots');
  if (!stage || !p) return;

  // Update background: warm-ink editorial base + a small radial hint
  // of the personality color. No full-bleed per-animal gradients.
  if (bg) {
    bg.style.background = `
      radial-gradient(ellipse 80% 55% at 50% 18%, ${_pglosColorToRgba(p.color, 0.16)}, transparent 70%),
      linear-gradient(180deg, #131210 0%, #1a1612 55%, #120f0b 100%)
    `;
    bg.style.setProperty('--pglos-glow', _pglosColorToRgba(p.color, 0.10));
  }

  // Update counter
  if (counter) counter.textContent = `${_pglosIdx + 1} / ${PERSONALITY_LIST.length}`;

  // Update dots
  if (dotsEl) {
    dotsEl.querySelectorAll('.pglos-dot').forEach((d, i) => d.classList.toggle('active', i === _pglosIdx));
  }

  // Build new slide. The data-pers attribute drives per-animal duotone
  // filters via refresh.css.
  const slide = document.createElement('div');
  slide.className = 'pglos-slide';
  slide.setAttribute('data-pers', p.id);
  // Pick entry animation based on direction
  if (dir !== null) {
    slide.classList.add(dir > 0 ? 'pglos-enter-right' : 'pglos-enter-left');
  }

  slide.innerHTML = `
    <div class="pglos-emoji-wrap">
      <div class="pglos-emoji-bg" style="
        --pglos-card-bg: ${_pglosColorToRgba(p.color, 0.08)};
        --pglos-card-border: ${_pglosColorToRgba(p.color, 0.22)};
        --pglos-glow-strong: ${_pglosColorToRgba(p.color, 0.14)};
      ">
        <span class="pglos-emoji">${p.emoji}</span>
      </div>
    </div>
    <div class="pglos-name">${p.name}</div>
    <div class="pglos-tagline" style="--pglos-accent:${p.color}">${p.tagline}</div>
    <div class="pglos-traits">
      ${p.traits.map(t => `<span class="pglos-trait" style="
        --pglos-trait-bg:${_pglosColorToRgba(p.color,0.08)};
        --pglos-trait-border:${_pglosColorToRgba(p.color,0.22)};
      ">${t}</span>`).join('')}
    </div>
    <div class="pglos-desc">${p.description}</div>
    <div class="pglos-famous">
      <span class="pglos-famous-label">Think</span>
      <span class="pglos-famous-names">${p.famous}</span>
    </div>
  `;

  // Exit old slides - force-remove any leftover slides from rapid clicks
  const oldSlides = stage.querySelectorAll('.pglos-slide');
  oldSlides.forEach(old => {
    if (dir !== null) {
      old.classList.remove('pglos-enter-right','pglos-enter-left','pglos-exit-left','pglos-exit-right');
      old.classList.add(dir > 0 ? 'pglos-exit-left' : 'pglos-exit-right');
      old.addEventListener('animationend', () => old.remove(), { once: true });
      // Safety net: remove after animation duration even if animationend doesn't fire
      setTimeout(() => { if (old.parentNode) old.remove(); }, 350);
    } else {
      old.remove();
    }
  });

  stage.appendChild(slide);

  // Keyboard navigation (attach once)
  if (!window._pglosKeyBound) {
    window._pglosKeyBound = true;
    document.addEventListener('keydown', e => {
      if (!document.getElementById('pglosOverlay')?.classList.contains('pglos-open')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') pglosGo(1);
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')  pglosGo(-1);
      if (e.key === 'Escape') closePglos();
    });
  }
}

