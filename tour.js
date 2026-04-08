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
// ==============================================================
let _tourSteps = [];
let _tourIdx = 0;
let _tourKey = '';

const ANALYSIS_TOUR_STEPS = [
  { el: '#analysisPersonalityCard', text: '&#9812; <strong>Your Chess Personality</strong><br>Detected from how you actually played <em>this</em> game: your opening choice, move patterns, and decision-making style. It can shift game to game as your style evolves.' },
  { el: '.board-wrapper',           text: '&#9823; <strong>The Board</strong><br>Your game plays out here. The bar on the left is the <em>evaluation bar</em>: white rising means White is ahead, black rising means Black is. Watch it shift as you step through moves.' },
  { el: '.nav-controls',            text: '&#9816; <strong>Navigate Moves</strong><br>Step through your game one move at a time. You can also use the ← → arrow keys on your keyboard, handy for quick review.' },
  { el: '.move-list',               text: '&#9814; <strong>Move List</strong><br>Every move is color-coded by quality. Click any move to jump there instantly.' },
  { el: '#explainBtn',              text: '&#9812; <strong>Explain</strong><br>Click this to get a full AI breakdown of the current move: an overview of the position, the pawn structure and plans, and the engine\'s best move recommendation.' },
  { el: '.walkthrough-cta',         text: '&#9816; <strong>Game Walkthrough</strong><br>An AI-guided tour of your key moments: your best and worst moves explained one by one, in context. The deepest way to learn from a game.' },
  { el: '.coach-cta-analysis',      text: '&#9812; <strong>AI Coach</strong><br>Get a personalized training plan built around your chess personality: targeted drills, tactical themes, and endgame homework tailored specifically to you.' }
];

const PROFILE_TOUR_STEPS = [
  { el: '.prof-identity',      text: '&#9812; <strong>Your Identity</strong><br>Your profile name and total games analyzed. Click the pencil to edit your name.' },
  { el: '.prof-analyze-btn',   text: '&#9816; <strong>Analyze a Game</strong><br>Start analyzing a new game from Lichess or Chess.com.' },
  { el: '.prof-tabs',          text: '&#9814; <strong>Tabs</strong><br>Switch between your personality overview and your game history.' },
  { el: '.prof-primary',       text: '&#9812; <strong>Chess Identity</strong><br>Your dominant chess personality across all games you\'ve analyzed.' },
  { el: '.prof-section-breakdown', text: '&#9815; <strong>Personality Breakdown</strong><br>See the percentage split of all your personality traits.' },
  { el: '.prof-feat-rep',      text: '&#9823; <strong>Opening Repertoire</strong><br>Discover your ideal openings: personalized picks based on your chess personality and game stats.' },
  { el: '.prof-feat-dna',      text: '&#9815; <strong>Chess DNA</strong><br>Explore your personality evolution over time with a strengths radar and style-shift timeline.' },
  { el: '.prof-feat-coach',    text: '&#9812; <strong>AI Coach</strong><br>Get a personalized training plan with drills, tactical themes, and endgame homework tailored to you.' }
];

function startTour(steps, storageKey, force) {
  _tourSteps = steps;
  _tourIdx = 0;
  _tourKey = storageKey;

  // Filter out steps whose elements don't exist or are hidden
  _tourSteps = steps.filter(s => {
    const el = document.querySelector(s.el);
    return el && el.offsetParent !== null;
  });

  if (!_tourSteps.length) return;

  // If force=true (? button), always show even if already toured
  if (force) localStorage.removeItem(storageKey);

  document.getElementById('tourOverlay').style.display = '';
  _renderTourStep();
}

function _renderTourStep() {
  if (_tourIdx >= _tourSteps.length) { closeTour(); return; }

  const step = _tourSteps[_tourIdx];
  const target = document.querySelector(step.el);
  if (!target) { _tourIdx++; _renderTourStep(); return; }

  const overlay = document.getElementById('tourOverlay');
  const hl = document.getElementById('tourHighlight');
  const tt = document.getElementById('tourTooltip');
  const text = document.getElementById('tourText');
  const counter = document.getElementById('tourCounter');
  const nextBtn = tt.querySelector('.tour-next');

  // On phones the tooltip is pinned to the bottom by CSS, so make
  // sure the highlighted target is scrolled into the visible area
  // before we measure it.
  if (window.innerWidth <= 860) {
    try { target.scrollIntoView({ behavior: 'instant', block: 'center' }); }
    catch (e) { target.scrollIntoView({ block: 'center' }); }
  }

  // Position highlight over target
  const rect = target.getBoundingClientRect();
  const pad = 6;
  hl.style.left   = (rect.left - pad) + 'px';
  hl.style.top    = (rect.top - pad) + 'px';
  hl.style.width  = (rect.width + pad * 2) + 'px';
  hl.style.height = (rect.height + pad * 2) + 'px';

  // Set text
  text.innerHTML = step.text;
  counter.textContent = (_tourIdx + 1) + ' / ' + _tourSteps.length;

  // Last step says "Done" instead of "Next"
  const isLast = _tourIdx === _tourSteps.length - 1;
  nextBtn.innerHTML = isLast ? 'Done ✓' : 'Next &rarr;';

  // Position tooltip: prefer below, fallback above
  tt.style.opacity = '0';
  requestAnimationFrame(() => {
    const ttRect = tt.getBoundingClientRect();
    let top = rect.bottom + 14;
    let left = rect.left + rect.width / 2 - ttRect.width / 2;

    // If tooltip goes below viewport, place above
    if (top + ttRect.height > window.innerHeight - 20) {
      top = rect.top - ttRect.height - 14;
    }
    // Clamp left
    left = Math.max(12, Math.min(left, window.innerWidth - ttRect.width - 12));
    // Clamp top
    top = Math.max(12, top);

    tt.style.left = left + 'px';
    tt.style.top = top + 'px';

    // Re-trigger entrance animation
    tt.style.animation = 'none';
    void tt.offsetWidth;
    tt.style.animation = '';
    tt.style.opacity = '';
  });
}

function nextTourStep() {
  _tourIdx++;
  if (_tourIdx >= _tourSteps.length) { closeTour(); return; }
  _renderTourStep();
}

function closeTour() {
  document.getElementById('tourOverlay').style.display = 'none';
  if (_tourKey) localStorage.setItem(_tourKey, '1');
  _tourSteps = [];
  _tourIdx = 0;
}

function checkAnalysisTour() {
  if (!localStorage.getItem('ce-analysis-toured')) {
    setTimeout(() => startTour(ANALYSIS_TOUR_STEPS, 'ce-analysis-toured'), 800);
  }
}

function checkProfileTour() {
  if (!localStorage.getItem('ce-profile-toured')) {
    setTimeout(() => startTour(PROFILE_TOUR_STEPS, 'ce-profile-toured'), 600);
  }
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

  // Update background gradient
  if (bg) {
    bg.style.background = p.gradient || `linear-gradient(135deg,#0b0b18,${p.color})`;
    bg.style.setProperty('--pglos-glow', _pglosColorToRgba(p.color, 0.22));
  }

  // Update counter
  if (counter) counter.textContent = `${_pglosIdx + 1} / ${PERSONALITY_LIST.length}`;

  // Update dots
  if (dotsEl) {
    dotsEl.querySelectorAll('.pglos-dot').forEach((d, i) => d.classList.toggle('active', i === _pglosIdx));
  }

  // Build new slide
  const slide = document.createElement('div');
  slide.className = 'pglos-slide';
  // Pick entry animation based on direction
  if (dir !== null) {
    slide.classList.add(dir > 0 ? 'pglos-enter-right' : 'pglos-enter-left');
  }

  slide.innerHTML = `
    <div class="pglos-emoji-wrap">
      <div class="pglos-emoji-bg" style="
        --pglos-card-bg: ${_pglosColorToRgba(p.color, 0.15)};
        --pglos-card-border: ${_pglosColorToRgba(p.color, 0.35)};
        --pglos-glow-strong: ${_pglosColorToRgba(p.color, 0.30)};
      ">
        <span class="pglos-emoji">${p.emoji}</span>
      </div>
    </div>
    <div class="pglos-name">${p.name}</div>
    <div class="pglos-tagline" style="--pglos-accent:${p.color}">${p.tagline}</div>
    <div class="pglos-traits">
      ${p.traits.map(t => `<span class="pglos-trait" style="
        --pglos-trait-bg:${_pglosColorToRgba(p.color,0.12)};
        --pglos-trait-border:${_pglosColorToRgba(p.color,0.30)};
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

