// Collapse toggle for monthly improvement plan
function toggleImprovePlan(btn) {
  const body = document.getElementById('profImprovePlan');
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : '';
  btn.querySelector('.prof-improve-chevron').style.transform = open ? 'rotate(-90deg)' : '';
}

// ==============================================================
//  INSIGHTS PAGE - Chess DNA
// ==============================================================
// ── Profile tab switching ──
function switchProfTab(tab) {
  document.getElementById('profTabPanelOverview').style.display = tab === 'overview' ? '' : 'none';
  document.getElementById('profTabPanelHistory').style.display  = tab === 'history'  ? '' : 'none';
  document.getElementById('profTabOverview').classList.toggle('active', tab === 'overview');
  document.getElementById('profTabHistory').classList.toggle('active',  tab === 'history');
}

// ── Insights tab switching ──
let _activeInsTab = 'moments';
function switchInsTab(tab) {
  if (tab === 'coach') { openCoachPage(); return; }
  _activeInsTab = tab;
  ['moments', 'openings'].forEach(t => {
    const panel = document.getElementById('insTabPanel' + t[0].toUpperCase() + t.slice(1));
    const btn   = document.getElementById('insTab'      + t[0].toUpperCase() + t.slice(1));
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (tab === 'moments')       requestAnimationFrame(() => giRenderMomentsPanel());
  else if (tab === 'openings') requestAnimationFrame(() => giRenderOpeningsPanel());
}

let _insHistory = [];
let _gi = { history: [], moments: [], openings: [], momentsIdx: 0, expandedOpening: null };

async function openInsights() {
  // Gate: require at least 2 analyzed games
  let history = [];
  try { history = await dbGetHistory(); } catch {}
  const analyzed = history.filter(e => e && e.personalityScores && e.personalityScores.length > 0);
  if (analyzed.length < 2) {
    showPage('profile'); renderFullProfile();
    return;
  }
  showPage('insights');
  _activeInsTab = 'moments';
  switchInsTab('moments');
  renderInsightsPage();
}

async function openCoachPage() {
  // Gate: require at least 3 analyzed games
  let history = [];
  try { history = await dbGetHistory(); } catch {}
  const analyzed = history.filter(e => e && e.personalityScores && e.personalityScores.length > 0);
  if (analyzed.length < 3) {
    showPage('profile'); renderFullProfile();
    return;
  }
  showPage('coach');
  renderCoachPage();
  // Auto-generate if not cached
  setTimeout(() => {
    if (!_coachCache.html) generateCoachPageAdvice();
  }, 200);
}

async function renderCoachPage() {
  let history = [];
  try { history = await dbGetHistory(); } catch {}
  _insHistory = history.filter(e => e.personality && PERSONALITIES[e.personality]).slice(0, 20);

  const agg = await getAggregatePersonality();
  const subEl = document.querySelector('.coach-header-sub');
  if (subEl && agg) {
    const p = agg.primary;
    subEl.textContent = `${p.emoji} ${p.name}, ${agg.totalGames} game${agg.totalGames !== 1 ? 's' : ''} analyzed`;
  }

  const btn = document.getElementById('coachPageBtn');
  const content = document.getElementById('coachPageContent');
  if (_coachCache.html) {
    _coachTasks = _coachCache.tasks || [];
    _cpoLastHtml = _coachCache.html;
    // IMPORTANT: _buildCoachResultHtml reads _coachPageMode at build time
    // to decide which reset function the embedded "New plan" button calls
    // (resetCoachPagePlan vs resetCoachPlan). When restoring from cache on
    // page open, _coachPageMode is still false, so the button would wire
    // to resetCoachPlan() — which targets the insights-page elements that
    // don't exist here, and the click silently does nothing. Force the
    // flag for the duration of the build so the button gets the right
    // handler.
    const _wasPageMode = _coachPageMode;
    _coachPageMode = true;
    try {
      if (content) _mountCoachDeck(content, _coachCache.html, _coachTasks);
    } finally {
      _coachPageMode = _wasPageMode;
    }
    if (btn) btn.style.display = 'none'; // hide bottom CTA - "New plan" is already inside the result
  } else {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="coach-page-cta-icon">&#9889;</span> Generate Practice Plan'; btn.onclick = function(){ generateCoachPageAdvice(); }; }
    if (content) content.innerHTML = `<div class="coach-page-empty">
      <div class="coach-page-empty-glow"></div>
      <div class="coach-page-empty-icon">&#127942;</div>
      <div class="coach-page-empty-title">Your Practice Plan</div>
      <div class="coach-page-empty-text">Generate a personalised coaching plan based on your chess personality, strengths, and weaknesses.</div>
    </div>`;
  }
}

function _coachLoadingHtml(stepText) {
  return `<div class="coach-page-loading">
    <div class="coach-page-loading-title">Building your practice plan</div>
    <div class="coach-page-loading-bar-outer"><div class="coach-page-loading-bar-inner"></div></div>
    <div class="coach-page-loading-step">
      <div class="coach-page-loading-spinner"></div>
      <div class="coach-page-loading-label">${stepText}</div>
    </div>
  </div>`;
}

function resetCoachPagePlan() {
  invalidateCoachPlan();
  const btn = document.getElementById('coachPageBtn');
  const content = document.getElementById('coachPageContent');
  if (btn) { btn.style.display = 'none'; btn.disabled = true; }
  if (content) content.innerHTML = _coachLoadingHtml('Creating your new practice plan\u2026');
  // Detach deck handlers from the old plan
  if (_coachDeckKeyHandler) {
    document.removeEventListener('keydown', _coachDeckKeyHandler, true);
    _coachDeckKeyHandler = null;
  }
  const outerLinks = document.getElementById('coachCrosslinks');
  if (outerLinks) outerLinks.style.display = '';
  generateCoachPageAdvice();
}

async function generateCoachPageAdvice() {
  const content = document.getElementById('coachPageContent');
  const btn = document.getElementById('coachPageBtn');
  // Show loading immediately
  if (btn) { btn.disabled = true; btn.style.display = 'none'; }
  if (content) content.innerHTML = _coachLoadingHtml('Analyzing your games\u2026');
  _coachPageMode = true;
  try {
    await _generateCoachAdviceShared(content, btn);
  } finally {
    _coachPageMode = false;
  }
}

async function renderInsightsPage() {
  let history = [];
  try { history = await dbGetHistory(); } catch {}
  _gi.history = history.filter(e => e && e.source !== 'repertoire-batch');
  _insHistory = history.filter(e => e.personality && PERSONALITIES[e.personality]).slice(0, 20);

  const subEl = document.getElementById('insHeaderSub');
  if (subEl) {
    const n = _gi.history.length;
    subEl.textContent = n > 0
      ? `Dashboard from ${n} analyzed game${n !== 1 ? 's' : ''}`
      : 'Analyze a game to unlock your insights';
  }

  requestAnimationFrame(() => giRenderDashboard());
}

// ══════════════════════════════════════════════════════════════
//  HARDCODED OPENING BOOK — maps first moves to opening names
// ══════════════════════════════════════════════════════════════
const _OPENING_BOOK = {
  '1.e4 e5 2.Nf3 Nc6 3.Bb5': 'Ruy Lopez',
  '1.e4 e5 2.Nf3 Nc6 3.Bc4': 'Italian Game',
  '1.e4 e5 2.Nf3 Nc6 3.d4': 'Scotch Game',
  '1.e4 e5 2.Nf3 Nf6': 'Petrov Defense',
  '1.e4 e5 2.Nf3 d6': 'Philidor Defense',
  '1.e4 e5 2.d4': 'Center Game',
  '1.e4 e5 2.Bc4': 'Bishop\'s Opening',
  '1.e4 e5 2.f4': 'King\'s Gambit',
  '1.e4 e5 2.Nc3': 'Vienna Game',
  '1.e4 c5 2.Nf3 d6': 'Sicilian Najdorf/Classical',
  '1.e4 c5 2.Nf3 Nc6': 'Sicilian Classical',
  '1.e4 c5 2.Nf3 e6': 'Sicilian Kan/Taimanov',
  '1.e4 c5 2.Nc3': 'Closed Sicilian',
  '1.e4 c5 2.d4': 'Smith-Morra Gambit',
  '1.e4 c5 2.c3': 'Alapin Sicilian',
  '1.e4 c5': 'Sicilian Defense',
  '1.e4 e6 2.d4 d5': 'French Defense',
  '1.e4 e6': 'French Defense',
  '1.e4 c6 2.d4 d5': 'Caro-Kann Defense',
  '1.e4 c6': 'Caro-Kann Defense',
  '1.e4 d5 2.exd5 Qxd5': 'Scandinavian Defense',
  '1.e4 d5': 'Scandinavian Defense',
  '1.e4 Nf6': 'Alekhine Defense',
  '1.e4 d6 2.d4 Nf6 3.Nc3 g6': 'Pirc Defense',
  '1.e4 d6': 'Pirc Defense',
  '1.e4 g6': 'Modern Defense',
  '1.e4 b6': 'Owen Defense',
  '1.d4 d5 2.c4 e6': 'Queen\'s Gambit Declined',
  '1.d4 d5 2.c4 dxc4': 'Queen\'s Gambit Accepted',
  '1.d4 d5 2.c4 c6': 'Slav Defense',
  '1.d4 d5 2.c4': 'Queen\'s Gambit',
  '1.d4 d5 2.Bf4': 'London System',
  '1.d4 d5 2.Nf3 Nf6 3.Bf4': 'London System',
  '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7': 'King\'s Indian Defense',
  '1.d4 Nf6 2.c4 g6': 'King\'s Indian Defense',
  '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4': 'Nimzo-Indian Defense',
  '1.d4 Nf6 2.c4 e6 3.Nf3 b6': 'Queen\'s Indian Defense',
  '1.d4 Nf6 2.c4 e6 3.Nf3 d5': 'Queen\'s Gambit Declined',
  '1.d4 Nf6 2.c4 e6': 'Indian Defense',
  '1.d4 Nf6 2.c4 c5': 'Benoni Defense',
  '1.d4 Nf6 2.Nf3 g6 3.Bf4': 'London System',
  '1.d4 Nf6 2.Nf3 g6': 'King\'s Indian Attack',
  '1.d4 Nf6 2.Bg5': 'Trompowsky Attack',
  '1.d4 Nf6 2.Nf3 e6': 'Indian Game',
  '1.d4 f5': 'Dutch Defense',
  '1.d4 d6': 'Old Indian Defense',
  '1.c4 e5': 'English Opening',
  '1.c4 c5': 'English Symmetrical',
  '1.c4 Nf6': 'English Opening',
  '1.c4': 'English Opening',
  '1.Nf3 d5 2.g3': 'King\'s Indian Attack',
  '1.Nf3 Nf6 2.g3': 'King\'s Indian Attack',
  '1.Nf3': 'Reti Opening',
  '1.g3': 'King\'s Fianchetto',
  '1.b3': 'Larsen\'s Opening',
  '1.f4': 'Bird\'s Opening',
};

function _lookupOpening(pgn) {
  if (!pgn) return null;
  // Try PGN header first
  const tag = /\[Opening\s+"([^"]+)"\]/i.exec(pgn);
  if (tag) return tag[1];
  // Parse first moves and match against book
  let moves = [];
  try {
    const g = new Chess();
    if (g.load_pgn(pgn) || g.load_pgn(pgn, { sloppy: true })) {
      moves = g.history();
    }
  } catch {}
  if (!moves.length) return null;
  // Build move strings and try longest match first
  const parts = [];
  for (let i = 0; i < Math.min(moves.length, 8); i++) {
    if (i % 2 === 0) parts.push(`${(i/2)+1}.${moves[i]}`);
    else parts[parts.length - 1] += ` ${moves[i]}`;
  }
  for (let len = parts.length; len >= 1; len--) {
    const key = parts.slice(0, len).join(' ');
    if (_OPENING_BOOK[key]) return _OPENING_BOOK[key];
  }
  // Fallback: show first 3 moves as name
  return parts.slice(0, 3).join(' ');
}

// ══════════════════════════════════════════════════════════════
//  STATS ENGINE — pure computation, no LLM
// ══════════════════════════════════════════════════════════════
function _computeStats(hist) {
  const s = {
    total: hist.length, wins: 0, losses: 0, draws: 0,
    winRate: 0, asWhite: 0, asBlack: 0,
    totalBlunders: 0, totalMistakes: 0,
    avgBlunders: 0, avgMistakes: 0,
    avgMoves: 0, avgBookDepth: 0,
    openings: {}, // name → { games, wins, losses, draws }
    personalities: {}, // id → count
    resultStreak: { type: null, count: 0 },
    blunderPieces: {}, // piece → count (from PGN analysis)
    mateCount: 0, resignCount: 0, timeoutCount: 0,
    avgOppRating: 0, ratingCount: 0,
    resultTimeline: [], // [{result, date}] chronological
  };
  if (!hist.length) return s;

  let totalMoves = 0, totalBook = 0;
  let streak = { type: null, count: 0 };

  for (const e of hist) {
    const pc = e.playerColor || 'w';
    if (pc === 'w') s.asWhite++; else s.asBlack++;

    // Result
    let res = 'draw';
    if (e.result === '1-0') res = pc === 'w' ? 'win' : 'loss';
    else if (e.result === '0-1') res = pc === 'b' ? 'win' : 'loss';
    else if (e.result === '1/2-1/2') res = 'draw';
    if (res === 'win') s.wins++;
    else if (res === 'loss') s.losses++;
    else s.draws++;

    // Timeline
    s.resultTimeline.push({ result: res, date: e.date || null });

    // Streak (from most recent)
    if (streak.type === null) { streak.type = res; streak.count = 1; }
    else if (res === streak.type) streak.count++;

    // Termination type guessing from PGN
    if (e.pgn) {
      const term = /\[Termination\s+"([^"]+)"\]/i.exec(e.pgn);
      if (term) {
        const t = term[1].toLowerCase();
        if (t.includes('checkmate')) s.mateCount++;
        else if (t.includes('resign')) s.resignCount++;
        else if (t.includes('time')) s.timeoutCount++;
      } else {
        // Heuristic: if result is decisive, check last move for #
        if (e.result !== '1/2-1/2' && e.result !== '*') {
          try {
            const g = new Chess();
            if (g.load_pgn(e.pgn) || g.load_pgn(e.pgn, { sloppy: true })) {
              const h = g.history();
              if (h.length && h[h.length - 1].includes('#')) s.mateCount++;
            }
          } catch {}
        }
      }
    }

    // Blunders & mistakes
    s.totalBlunders += (e.blunders || 0);
    s.totalMistakes += (e.mistakes || 0);
    totalMoves += (e.totalMoves || 0);
    totalBook += (e.bookDepth || 0);

    // Opening
    const opName = _lookupOpening(e.pgn);
    if (opName) {
      if (!s.openings[opName]) s.openings[opName] = { games: 0, wins: 0, losses: 0, draws: 0 };
      s.openings[opName].games++;
      if (res === 'win') s.openings[opName].wins++;
      else if (res === 'loss') s.openings[opName].losses++;
      else s.openings[opName].draws++;
    }

    // Personality
    if (e.personality) {
      s.personalities[e.personality] = (s.personalities[e.personality] || 0) + 1;
    }

    // Opponent rating from PGN headers
    const oppRatingField = pc === 'w' ? 'BlackElo' : 'WhiteElo';
    if (e.pgn) {
      const rMatch = new RegExp(`\\[${oppRatingField}\\s+"(\\d+)"\\]`).exec(e.pgn);
      if (rMatch) { s.avgOppRating += parseInt(rMatch[1], 10); s.ratingCount++; }
    }

    // Blundered pieces — parse PGN for blunder-tagged captures
    if (e.pgn) {
      try {
        const g = new Chess();
        if (g.load_pgn(e.pgn) || g.load_pgn(e.pgn, { sloppy: true })) {
          const moves = g.history({ verbose: true });
          // We use the stored evals if available; otherwise skip
        }
      } catch {}
    }
  }

  s.winRate = s.total ? Math.round((s.wins / s.total) * 100) : 0;
  s.avgBlunders = s.total ? +(s.totalBlunders / s.total).toFixed(1) : 0;
  s.avgMistakes = s.total ? +(s.totalMistakes / s.total).toFixed(1) : 0;
  s.avgMoves = s.total ? Math.round(totalMoves / s.total) : 0;
  s.avgBookDepth = s.total ? +(totalBook / s.total).toFixed(1) : 0;
  s.resultStreak = streak;
  if (s.ratingCount) s.avgOppRating = Math.round(s.avgOppRating / s.ratingCount);

  return s;
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD RENDERER
// ══════════════════════════════════════════════════════════════
function giRenderDashboard() {
  const el = document.getElementById('insDashboard');
  if (!el) return;
  const hist = _gi.history || [];

  if (!hist.length) {
    el.innerHTML = `<div class="gid-empty">
      <div class="gid-empty-icon">📊</div>
      <h3 class="gid-empty-title">No data yet</h3>
      <p class="gid-empty-sub">Analyze at least two games to see your dashboard.</p>
    </div>`;
    return;
  }

  const s = _computeStats(hist);
  el.innerHTML = _buildDashboardHtml(s, hist);

  // Draw canvas charts after DOM update
  requestAnimationFrame(() => {
    _drawWinDonut('gidDonutCanvas', s);
    _drawResultTimeline('gidTimelineCanvas', s.resultTimeline);
  });
}

function _buildDashboardHtml(s, hist) {
  // ── Hero stats row ──
  const lossRate = s.total ? Math.round((s.losses / s.total) * 100) : 0;
  const drawRate = s.total ? Math.round((s.draws / s.total) * 100) : 0;

  const hero = `
  <div class="gid-hero">
    <div class="gid-hero-stat gid-stat-accent">
      <div class="gid-hero-val">${s.winRate}<span class="gid-hero-pct">%</span></div>
      <div class="gid-hero-label">Win Rate</div>
    </div>
    <div class="gid-hero-stat">
      <div class="gid-hero-val">${s.total}</div>
      <div class="gid-hero-label">Games</div>
    </div>
    <div class="gid-hero-stat">
      <div class="gid-hero-val">${s.avgBlunders}</div>
      <div class="gid-hero-label">Avg Blunders</div>
    </div>
    <div class="gid-hero-stat">
      <div class="gid-hero-val">${s.avgMistakes}</div>
      <div class="gid-hero-label">Avg Mistakes</div>
    </div>
    ${s.ratingCount ? `<div class="gid-hero-stat">
      <div class="gid-hero-val">${s.avgOppRating}</div>
      <div class="gid-hero-label">Avg Opp Rating</div>
    </div>` : ''}
  </div>`;

  // ── Win/Loss donut + record ──
  const donut = `
  <div class="gid-card gid-card-donut">
    <div class="gid-card-title">Results Breakdown</div>
    <div class="gid-donut-wrap">
      <canvas id="gidDonutCanvas" width="180" height="180"></canvas>
      <div class="gid-donut-legend">
        <div class="gid-legend-row"><span class="gid-legend-dot" style="background:var(--accent)"></span> Wins <strong>${s.wins}</strong></div>
        <div class="gid-legend-row"><span class="gid-legend-dot" style="background:var(--blunder)"></span> Losses <strong>${s.losses}</strong></div>
        <div class="gid-legend-row"><span class="gid-legend-dot" style="background:var(--text-dim)"></span> Draws <strong>${s.draws}</strong></div>
      </div>
    </div>
    <div class="gid-donut-bar">
      <div class="gid-bar-seg gid-bar-win" style="width:${s.winRate}%"></div>
      <div class="gid-bar-seg gid-bar-draw" style="width:${drawRate}%"></div>
      <div class="gid-bar-seg gid-bar-loss" style="width:${lossRate}%"></div>
    </div>
  </div>`;

  // ── Result timeline ──
  const timeline = `
  <div class="gid-card gid-card-timeline">
    <div class="gid-card-title">Recent Results</div>
    <div class="gid-timeline-wrap">
      <canvas id="gidTimelineCanvas"></canvas>
    </div>
    <div class="gid-timeline-legend">
      <span class="gid-tl-leg"><span class="gid-tl-swatch" style="background:var(--accent)"></span>Win</span>
      <span class="gid-tl-leg"><span class="gid-tl-swatch" style="background:var(--blunder)"></span>Loss</span>
      <span class="gid-tl-leg"><span class="gid-tl-swatch" style="background:var(--text-dim)"></span>Draw</span>
    </div>
  </div>`;

  // ── Quick facts row ──
  const facts = `
  <div class="gid-facts">
    <div class="gid-fact"><span class="gid-fact-icon">♔</span><span class="gid-fact-val">${s.asWhite}</span><span class="gid-fact-label">as White</span></div>
    <div class="gid-fact"><span class="gid-fact-icon">♚</span><span class="gid-fact-val">${s.asBlack}</span><span class="gid-fact-label">as Black</span></div>
    <div class="gid-fact"><span class="gid-fact-icon">♟</span><span class="gid-fact-val">${s.avgMoves}</span><span class="gid-fact-label">Avg Moves</span></div>
    <div class="gid-fact"><span class="gid-fact-icon">📖</span><span class="gid-fact-val">${s.avgBookDepth}</span><span class="gid-fact-label">Avg Book Depth</span></div>
    ${s.mateCount ? `<div class="gid-fact"><span class="gid-fact-icon">💀</span><span class="gid-fact-val">${s.mateCount}</span><span class="gid-fact-label">Checkmates</span></div>` : ''}
    ${s.resultStreak.count >= 2 ? `<div class="gid-fact gid-fact-streak"><span class="gid-fact-icon">${s.resultStreak.type === 'win' ? '🔥' : s.resultStreak.type === 'loss' ? '❄️' : '➖'}</span><span class="gid-fact-val">${s.resultStreak.count}</span><span class="gid-fact-label">${s.resultStreak.type} streak</span></div>` : ''}
  </div>`;

  // ── Blunders & Mistakes summary ──
  const errorCard = `
  <div class="gid-card gid-card-errors">
    <div class="gid-card-title">Accuracy Overview</div>
    <div class="gid-error-bars">
      <div class="gid-error-row">
        <span class="gid-error-label">Blunders</span>
        <div class="gid-error-track"><div class="gid-error-fill gid-fill-blunder" style="width:${Math.min(100, s.avgBlunders * 20)}%"></div></div>
        <span class="gid-error-val">${s.avgBlunders}/game</span>
      </div>
      <div class="gid-error-row">
        <span class="gid-error-label">Mistakes</span>
        <div class="gid-error-track"><div class="gid-error-fill gid-fill-mistake" style="width:${Math.min(100, s.avgMistakes * 15)}%"></div></div>
        <span class="gid-error-val">${s.avgMistakes}/game</span>
      </div>
    </div>
    <div class="gid-error-totals">
      <span>Total: <strong>${s.totalBlunders}</strong> blunders, <strong>${s.totalMistakes}</strong> mistakes across ${s.total} games</span>
    </div>
  </div>`;

  // ── Opening win rates ──
  const opArr = Object.entries(s.openings)
    .map(([name, o]) => ({ name, ...o, winRate: o.games ? Math.round((o.wins / o.games) * 100) : 0 }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 8);

  let openingsHtml = '';
  if (opArr.length) {
    const opRows = opArr.map(o => {
      const winPct = o.games ? (o.wins / o.games) * 100 : 0;
      const drawPct = o.games ? (o.draws / o.games) * 100 : 0;
      const lossPct = o.games ? (o.losses / o.games) * 100 : 0;
      const wrCls = o.winRate >= 60 ? 'gid-wr-hot' : o.winRate <= 35 ? 'gid-wr-cold' : '';
      return `<div class="gid-op-row">
        <div class="gid-op-name">${_escapeHtml(o.name)}</div>
        <div class="gid-op-bar">
          <div class="gid-bar-seg gid-bar-win" style="width:${winPct}%"></div>
          <div class="gid-bar-seg gid-bar-draw" style="width:${drawPct}%"></div>
          <div class="gid-bar-seg gid-bar-loss" style="width:${lossPct}%"></div>
        </div>
        <div class="gid-op-meta">
          <span class="gid-op-wr ${wrCls}">${o.winRate}%</span>
          <span class="gid-op-count">${o.games}g</span>
        </div>
      </div>`;
    }).join('');
    openingsHtml = `
    <div class="gid-card gid-card-openings">
      <div class="gid-card-title">Opening Performance</div>
      <div class="gid-op-list">${opRows}</div>
    </div>`;
  }

  return hero + `<div class="gid-grid">${donut}${timeline}</div>` + facts + `<div class="gid-grid">${errorCard}${openingsHtml}</div>`;
}

// ── Canvas: Win/Loss donut ──
function _drawWinDonut(canvasId, s) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = 180 * dpr; c.height = 180 * dpr;
  c.style.width = '180px'; c.style.height = '180px';
  ctx.scale(dpr, dpr);
  const cx = 90, cy = 90, r = 68, lw = 22;
  const cs = getComputedStyle(document.documentElement);
  const accentColor = cs.getPropertyValue('--accent').trim() || '#d4a24c';
  const blunderColor = cs.getPropertyValue('--blunder').trim() || '#c8412e';
  const dimColor = cs.getPropertyValue('--text-dim').trim() || '#a59c84';
  const data = [
    { val: s.wins, color: accentColor },
    { val: s.draws, color: dimColor },
    { val: s.losses, color: blunderColor },
  ];
  const total = data.reduce((a, d) => a + d.val, 0) || 1;
  let angle = -Math.PI / 2;
  for (const d of data) {
    const sweep = (d.val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.lineWidth = lw;
    ctx.strokeStyle = d.color;
    ctx.lineCap = 'round';
    ctx.stroke();
    angle += sweep;
  }
  // Center text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 28px "Space Grotesk", sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1c1816';
  ctx.fillText(`${s.winRate}%`, cx, cy - 6);
  ctx.font = '500 11px "Space Grotesk", sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#888';
  ctx.fillText('win rate', cx, cy + 14);
}

// ── Canvas: Result timeline (vertical bars) ──
function _drawResultTimeline(canvasId, timeline) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const wrap = c.parentElement;
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = wrap.clientWidth || 400;
  const h = wrap.clientHeight || 160;
  c.style.width = w + 'px'; c.style.height = h + 'px';
  c.width = w * dpr; c.height = h * dpr;
  ctx.scale(dpr, dpr);

  const cs = getComputedStyle(document.documentElement);
  const accentColor = cs.getPropertyValue('--accent').trim() || '#d4a24c';
  const blunderColor = cs.getPropertyValue('--blunder').trim() || '#c8412e';
  const dimColor = cs.getPropertyValue('--text-dim').trim() || '#a59c84';
  const borderColor = cs.getPropertyValue('--border').trim() || '#e5e5e5';
  const colors = { win: accentColor, loss: blunderColor, draw: dimColor };

  const items = timeline.slice(-20);
  if (!items.length) return;

  const pad = 8;
  const barGap = 6;
  const totalBarSpace = w - pad * 2;
  const barW = Math.min(28, (totalBarSpace - barGap * (items.length - 1)) / items.length);
  const totalW = items.length * barW + (items.length - 1) * barGap;
  const startX = (w - totalW) / 2;
  const maxBarH = h - 32;
  const baseY = h - 12;
  const barRadius = Math.min(6, barW / 2);

  // Heights: win = full, loss = 40%, draw = 65%
  const heightFrac = { win: 1.0, loss: 0.4, draw: 0.65 };

  items.forEach((item, i) => {
    const x = startX + i * (barW + barGap);
    const frac = heightFrac[item.result] || 0.65;
    const barH = Math.max(8, maxBarH * frac);
    const y = baseY - barH;
    const col = colors[item.result] || dimColor;

    // Bar with rounded top
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, y + barRadius);
    ctx.arcTo(x, y, x + barRadius, y, barRadius);
    ctx.arcTo(x + barW, y, x + barW, y + barRadius, barRadius);
    ctx.lineTo(x + barW, baseY);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();

    // Subtle inner glow for wins
    if (item.result === 'win') {
      const grad = ctx.createLinearGradient(x, y, x, baseY);
      grad.addColorStop(0, 'rgba(255,255,255,0.25)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Game number label below
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '500 9px "Space Grotesk", sans-serif';
    ctx.fillStyle = dimColor;
    ctx.fillText(String(i + 1), x + barW / 2, baseY + 2);
  });
}

// Keep old functions as no-ops so nothing breaks
function giRenderMomentsPanel() { giRenderDashboard(); }
function giRenderOpeningsPanel() { giRenderDashboard(); }

function _giOpeningSignature(pgn) {
  const name = _lookupOpening(pgn);
  return name ? { name, moves: '' } : null;
}

// (legacy panels removed — dashboard replaces them)
function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderEvoStats(withPers, agg) {
  const el = document.getElementById('insEvoStats');
  if (!el) return;
  if (!withPers.length) { el.innerHTML = ''; return; }

  const total = withPers.length;
  const wins  = withPers.filter(e => (e.result === '1-0' && e.playerColor === 'w') || (e.result === '0-1' && e.playerColor === 'b')).length;
  const winRate = total ? Math.round(wins / total * 100) : 0;

  // Build primary-score series per game (same logic as drawEvolutionLineChart)
  const scores = withPers.slice().reverse().map(e => {
    if (!e.personalityScores || !e.personality) return 0;
    const top = e.personalityScores.find(s => s.id === e.personality);
    return top ? top.pct : 0;
  }).filter(v => v > 0);

  const meanScore   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const peakScore   = scores.length ? Math.max(...scores) : 0;
  const lowestScore = scores.length ? Math.min(...scores) : 0;

  el.innerHTML = `
    <div class="ins-stat-card accent-purple">
      <div class="ins-stat-card-icon">📊</div>
      <div class="ins-stat-card-value">${meanScore}%</div>
      <div class="ins-stat-card-label">Mean Score</div>
    </div>
    <div class="ins-stat-card accent-yellow">
      <div class="ins-stat-card-icon">\u2655</div>
      <div class="ins-stat-card-value">${peakScore}%</div>
      <div class="ins-stat-card-label">Peak Score</div>
    </div>
    <div class="ins-stat-card accent-red">
      <div class="ins-stat-card-icon">\u265A</div>
      <div class="ins-stat-card-value">${lowestScore}%</div>
      <div class="ins-stat-card-label">Lowest Score</div>
    </div>
    <div class="ins-stat-card accent-blue">
      <div class="ins-stat-card-icon">\u2655</div>
      <div class="ins-stat-card-value">${winRate}%</div>
      <div class="ins-stat-card-label">Win Rate</div>
    </div>
  `;
}

function renderStrengthBars(withPers) {
  const el = document.getElementById('insStrengthBars');
  if (!el) return;

  const totals = {};
  PERSONALITY_LIST.forEach(p => { totals[p.id] = 0; });
  let count = 0;
  for (const e of withPers) {
    if (e.personalityScores) {
      count++;
      for (const s of e.personalityScores) totals[s.id] = (totals[s.id] || 0) + s.pct;
    }
  }
  const avgs = PERSONALITY_LIST.map(p => ({
    p, val: count > 0 ? Math.round(totals[p.id] / count) : 0
  })).sort((a, b) => b.val - a.val);

  // Header row + bars (bars start at width:0 then animate to target on next frame)
  el.innerHTML = `
    <div class="ins-bars-summary">
      <span class="ins-bars-summary-num">${count}</span>
      <span class="ins-bars-summary-text">${count === 1 ? 'game analyzed' : 'games analyzed'}</span>
    </div>
  ` + avgs.map(({p, val}) => `
    <div class="ins-sbar-row">
      <div class="ins-sbar-top">
        <span class="ins-sbar-name">${p.emoji} ${p.name.replace('The ','')}</span>
        <span class="ins-sbar-pct">${val}%</span>
      </div>
      <div class="ins-sbar-track">
        <div class="ins-sbar-fill" data-target="${val}" style="width:0%;background:${p.color};color:${p.color}"></div>
      </div>
    </div>
  `).join('');

  // Stagger fills in over 750ms with sequential delays for a dynamic entrance
  requestAnimationFrame(() => {
    el.querySelectorAll('.ins-sbar-fill').forEach((fill, i) => {
      const target = parseFloat(fill.dataset.target) || 0;
      fill.style.transitionDelay = (0.10 + i * 0.07) + 's';
      fill.style.width = target + '%';
    });
  });
}

// ── Line Chart: Personality Evolution (reference-style) ──
// opts: { progress: 0..1, hoverIdx: number|null, showAvg: bool }
function drawEvolutionLineChart(withPers, opts = {}) {
  const canvas = document.getElementById('insLineChart');
  if (!canvas) return;

  const progress = typeof opts.progress === 'number' ? Math.max(0, Math.min(1, opts.progress)) : 1;
  const hoverIdx = (opts.hoverIdx == null) ? -1 : opts.hoverIdx;
  const showAvg  = opts.showAvg !== false;

  const rect  = canvas.getBoundingClientRect();
  const dpr   = window.devicePixelRatio || 1;
  const W     = Math.max(rect.width || canvas.parentElement?.clientWidth || 700, 300);
  const H     = 420;
  canvas.width  = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const isDarkMode = document.documentElement.getAttribute('data-theme') !== 'light';
  const surfaceCol = isDarkMode ? '#13132a' : '#ffffff';
  const gridStrong = isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(20,20,60,0.10)';
  const gridWeak   = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(20,20,60,0.06)';
  const labelCol   = isDarkMode ? 'rgba(255,255,255,0.40)' : 'rgba(20,20,60,0.55)';
  const titleCol   = isDarkMode ? 'rgba(255,255,255,0.30)' : 'rgba(20,20,60,0.45)';

  if (withPers.length < 2) {
    ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.30)' : 'rgba(30,30,60,0.40)';
    ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Analyze at least 2 games to see your evolution', W / 2, H / 2);
    canvas._dnaGeom = null;
    return;
  }

  const items = withPers.slice().reverse(); // oldest → newest
  const N = items.length;

  // Build primary-score series: top personality % per game
  const scores = items.map(e => {
    if (!e.personalityScores || !e.personality) return 0;
    const top = e.personalityScores.find(s => s.id === e.personality);
    return top ? top.pct : 0;
  });

  // Running average
  const runAvg = scores.map((_, i) => {
    const slice = scores.slice(0, i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });

  const PAD_L = 56, PAD_R = 28, PAD_T = 24, PAD_B = 52;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  // Y scale: auto-range with some headroom
  const allVals = [...scores, ...runAvg];
  const rawMin  = Math.min(...allVals);
  const rawMax  = Math.max(...allVals);
  const pad     = Math.max(8, (rawMax - rawMin) * 0.18);
  const yMin    = Math.max(0,   Math.floor((rawMin - pad) / 5) * 5);
  const yMax    = Math.min(100, Math.ceil( (rawMax + pad) / 5) * 5);
  const yRange  = yMax - yMin || 10;
  const toY = v => PAD_T + plotH - ((v - yMin) / yRange) * plotH;
  const toX = i => PAD_L + (N > 1 ? i / (N - 1) : 0.5) * plotW;

  // Primary personality color for the line
  const primaryId = items[items.length - 1]?.personality;
  const lineColor = PERSONALITIES[primaryId]?.color || '#8b5cf6';

  // ── Grid (always full width — labels don't animate) ──
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const val = yMin + (yRange / gridSteps) * i;
    const y   = toY(val);
    ctx.strokeStyle = gridStrong;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    ctx.fillStyle = titleCol;
    ctx.font = '600 11px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(val) + '%', PAD_L - 10, y);
  }
  items.forEach((_, i) => {
    const x = toX(i);
    ctx.strokeStyle = gridWeak;
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + plotH); ctx.stroke();
  });
  ctx.fillStyle = labelCol;
  ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  items.forEach((e, i) => {
    if (N > 10 && i % 2 !== 0 && i !== N - 1) return;
    const d = new Date(e.date);
    const label = isNaN(d) ? `G${i + 1}` : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    ctx.fillText(label, toX(i), PAD_T + plotH + 10);
  });

  // ── Animated reveal: clip a left-to-right rect and draw line/area/dots inside ──
  ctx.save();
  ctx.beginPath();
  ctx.rect(PAD_L - 4, PAD_T - 8, plotW * progress + 8, plotH + 16);
  ctx.clip();

  // Background fill under main line
  ctx.beginPath();
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(toX(N - 1), toY(yMin));
  ctx.lineTo(toX(0), toY(yMin));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + plotH);
  grad.addColorStop(0,   `rgba(${_hexToRgb(lineColor)},0.32)`);
  grad.addColorStop(0.6, `rgba(${_hexToRgb(lineColor)},0.10)`);
  grad.addColorStop(1,   `rgba(${_hexToRgb(lineColor)},0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Running average (dashed)
  if (showAvg) {
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = 0.50;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    runAvg.forEach((v, i) => {
      const x = toX(i), y = toY(v);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // Main line — soft shadow for depth
  ctx.shadowColor = `rgba(${_hexToRgb(lineColor)},0.45)`;
  ctx.shadowBlur  = 14;
  ctx.shadowOffsetY = 3;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetY = 0;

  // Find peak and valley
  const peakIdx   = scores.indexOf(Math.max(...scores));
  const valleyIdx = scores.indexOf(Math.min(...scores));

  // Dots
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    const isPeak   = i === peakIdx;
    const isValley = i === valleyIdx && scores[i] !== scores[peakIdx];
    const isHover  = i === hoverIdx;
    const r = isHover ? 8 : (isPeak || isValley ? 7 : 5);
    const dotColor = isPeak ? '#f0c040'
                  : (isValley && scores.length > 3 ? '#f87171' : lineColor);

    if (isPeak) {
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240, 192, 64, 0.18)';
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = dotColor; ctx.fill();
    ctx.strokeStyle = surfaceCol; ctx.lineWidth = 2.5; ctx.stroke();
  });
  ctx.restore();

  // Store geometry for hover handler (in CSS pixels, relative to canvas)
  canvas._dnaGeom = {
    points: scores.map((v, i) => ({ x: toX(i), y: toY(v) })),
    data: scores.map((v, i) => {
      const d = new Date(items[i].date);
      const label = isNaN(d) ? `Game ${i + 1}` : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
      return { label, score: v, avg: runAvg[i] };
    }),
    plot: { left: PAD_L, top: PAD_T, width: plotW, height: plotH },
    lineColor
  };

  // Update chart header badges
  const badgesEl = document.getElementById('insChartBadges');
  if (badgesEl && primaryId && PERSONALITIES[primaryId]) {
    const p = PERSONALITIES[primaryId];
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    badgesEl.innerHTML = `
      <span class="ins-badge-pill" style="background:rgba(${_hexToRgb(lineColor)},0.18);color:${lineColor};border-color:rgba(${_hexToRgb(lineColor)},0.30);">${p.emoji} ${p.name.replace('The ','')}</span>
      <span class="ins-badge-pill ins-badge-avg">Avg ${avg}%</span>
    `;
  }
}

function _hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return '139,92,246';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ══════════════════════════════════════════════════════════════
// CHESS DNA — Animation, hover & theme-sync helpers
// ══════════════════════════════════════════════════════════════

// Generic rAF easing runner: drives a draw fn with progress 0..1
function _dnaRunAnim(durationMs, drawFn) {
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs);
    // ease-out-cubic
    const eased = 1 - Math.pow(1 - t, 3);
    drawFn(eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Wrapper: draw the radar with an entrance animation
function _dnaRenderRadarAnimated(history) {
  drawRadarChart(history, { progress: 0 });
  _dnaRunAnim(720, (p) => drawRadarChart(history, { progress: p }));
  _dnaSetupRadarHover();
}

// Wrapper: draw the line chart with an entrance animation
function _dnaRenderLineAnimated(history) {
  drawEvolutionLineChart(history, { progress: 0 });
  _dnaRunAnim(820, (p) => drawEvolutionLineChart(history, { progress: p }));
  _dnaSetupLineHover();
}

// ── Tooltip / overlay element creation ─────────────────────────
function _dnaEnsureOverlay(host, className) {
  let el = host.querySelector('.' + className);
  if (!el) {
    el = document.createElement('div');
    el.className = className;
    host.appendChild(el);
  }
  return el;
}

// ── Radar hover ─────────────────────────────────────────────────
function _dnaSetupRadarHover() {
  const canvas = document.getElementById('insRadarChart');
  if (!canvas) return;
  const host = canvas.closest('.ins-card-radar');
  if (!host) return;
  const tooltip = _dnaEnsureOverlay(host, 'ins-canvas-tooltip');
  const marker  = _dnaEnsureOverlay(host, 'ins-radar-marker');

  if (canvas._dnaHoverAttached) return;
  canvas._dnaHoverAttached = true;

  const onMove = (e) => {
    const geom = canvas._dnaGeom;
    if (!geom || !geom.points) return;
    const cRect = canvas.getBoundingClientRect();
    const hRect = host.getBoundingClientRect();
    const mx = e.clientX - cRect.left;
    const my = e.clientY - cRect.top;

    let bestIdx = -1, bestDist = Infinity;
    geom.points.forEach((pt, i) => {
      const dx = pt.x - mx, dy = pt.y - my;
      const d  = Math.sqrt(dx*dx + dy*dy);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });

    if (bestIdx >= 0 && bestDist < 42) {
      const pt = geom.points[bestIdx];
      const data = geom.data[bestIdx];
      const offsetLeft = (cRect.left - hRect.left) + pt.x;
      const offsetTop  = (cRect.top  - hRect.top)  + pt.y;

      tooltip.innerHTML = `${data.emoji} <strong>${data.name}</strong> · ${data.val}%`;
      tooltip.style.left = offsetLeft + 'px';
      tooltip.style.top  = offsetTop  + 'px';
      tooltip.classList.add('show');

      marker.style.left = offsetLeft + 'px';
      marker.style.top  = offsetTop  + 'px';
      marker.style.borderColor = geom.topColor || '#8b5cf6';
      marker.style.boxShadow =
        `0 0 0 5px ${_rgbaFromHex(geom.topColor || '#8b5cf6', 0.22)},` +
        `0 6px 18px ${_rgbaFromHex(geom.topColor || '#8b5cf6', 0.4)}`;
      marker.classList.add('show');
    } else {
      tooltip.classList.remove('show');
      marker.classList.remove('show');
    }
  };

  const onLeave = () => {
    tooltip.classList.remove('show');
    marker.classList.remove('show');
  };

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
}

// ── Line hover (vertical cursor + marker + tooltip) ─────────────
function _dnaSetupLineHover() {
  const canvas = document.getElementById('insLineChart');
  if (!canvas) return;
  const host = canvas.closest('.ins-card-chart');
  if (!host) return;
  const tooltip = _dnaEnsureOverlay(host, 'ins-canvas-tooltip');
  const cursor  = _dnaEnsureOverlay(host, 'ins-line-cursor');
  const marker  = _dnaEnsureOverlay(host, 'ins-line-marker');

  if (canvas._dnaHoverAttached) return;
  canvas._dnaHoverAttached = true;

  const onMove = (e) => {
    const geom = canvas._dnaGeom;
    if (!geom || !geom.points || geom.points.length === 0) return;
    const cRect = canvas.getBoundingClientRect();
    const hRect = host.getBoundingClientRect();
    const mx = e.clientX - cRect.left;

    let bestIdx = 0, bestDist = Infinity;
    geom.points.forEach((pt, i) => {
      const d = Math.abs(pt.x - mx);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });

    if (bestDist < 60) {
      const pt = geom.points[bestIdx];
      const data = geom.data[bestIdx];
      const offsetLeft = (cRect.left - hRect.left) + pt.x;
      const offsetTop  = (cRect.top  - hRect.top)  + pt.y;
      const plotTop    = (cRect.top  - hRect.top)  + geom.plot.top;

      tooltip.innerHTML =
        `<strong>${data.label}</strong> · ${data.score}% ` +
        `<span class="tt-sub">avg ${data.avg}%</span>`;
      tooltip.style.left = offsetLeft + 'px';
      tooltip.style.top  = offsetTop  + 'px';
      tooltip.classList.add('show');

      marker.style.left = offsetLeft + 'px';
      marker.style.top  = offsetTop  + 'px';
      marker.style.borderColor = geom.lineColor || '#8b5cf6';
      marker.style.boxShadow =
        `0 0 0 5px ${_rgbaFromHex(geom.lineColor || '#8b5cf6', 0.22)},` +
        `0 6px 18px ${_rgbaFromHex(geom.lineColor || '#8b5cf6', 0.4)}`;
      marker.classList.add('show');

      cursor.style.left   = offsetLeft + 'px';
      cursor.style.top    = plotTop + 'px';
      cursor.style.height = geom.plot.height + 'px';
      cursor.classList.add('show');
    } else {
      tooltip.classList.remove('show');
      marker.classList.remove('show');
      cursor.classList.remove('show');
    }
  };

  const onLeave = () => {
    tooltip.classList.remove('show');
    marker.classList.remove('show');
    cursor.classList.remove('show');
  };

  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);
}

function _rgbaFromHex(hex, alpha) {
  return `rgba(${_hexToRgb(hex)},${alpha})`;
}

// ── Theme observer: redraw charts (no animation) when theme toggles ──
let _dnaThemeObserver = null;
function _dnaSetupThemeObserver() {
  if (_dnaThemeObserver) return;
  _dnaThemeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName === 'data-theme') {
        // Re-render whichever panel is currently visible (no entrance anim)
        const strengthsVisible = document.getElementById('insTabPanelStrengths')?.style.display !== 'none';
        const evolutionVisible = document.getElementById('insTabPanelEvolution')?.style.display !== 'none';
        if (strengthsVisible) drawRadarChart(_insHistory);
        if (evolutionVisible) drawEvolutionLineChart(_insHistory);
        return;
      }
    }
  });
  _dnaThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// ── Radar Chart: 8 Personality Strengths (Nen-style) ──
// opts: { progress: 0..1, hoverIdx: number|null }
function drawRadarChart(withPers, opts = {}) {
  const canvas = document.getElementById('insRadarChart');
  if (!canvas) return;

  const progress = typeof opts.progress === 'number' ? Math.max(0, Math.min(1, opts.progress)) : 1;
  const hoverIdx = (opts.hoverIdx == null) ? -1 : opts.hoverIdx;

  // Use full container width, up to 580px
  const container = canvas.parentElement;
  const rawSize   = Math.min((container?.clientWidth || 480), 580);
  const size      = Math.max(rawSize, 300);
  const dpr       = window.devicePixelRatio || 1;
  canvas.width    = size * dpr;
  canvas.height   = size * dpr;
  canvas.style.width  = size + 'px';
  canvas.style.height = size + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const W = size, H = size;
  ctx.clearRect(0, 0, W, H);

  const CX = W / 2, CY = H / 2;
  const isRadarDark = document.documentElement.getAttribute('data-theme') !== 'light';
  // More padding for bigger emoji labels
  const LABEL_PAD = Math.round(size * 0.14);
  const R         = Math.min(W, H) / 2 - LABEL_PAD;
  const N         = PERSONALITY_LIST.length; // 8

  // Theme palette
  const ringStrong = isRadarDark ? 'rgba(255,255,255,0.55)' : 'rgba(20,20,60,0.45)';
  const ringWeak   = isRadarDark ? 'rgba(255,255,255,0.10)' : 'rgba(20,20,60,0.10)';
  const axisCol    = isRadarDark ? 'rgba(255,255,255,0.13)' : 'rgba(20,20,60,0.14)';
  const dotFill    = isRadarDark ? 'rgba(255,255,255,0.85)' : 'rgba(20,20,60,0.78)';
  const dotStroke  = isRadarDark ? 'rgba(255,255,255,0.20)' : 'rgba(20,20,60,0.20)';
  const nameCol    = isRadarDark ? 'rgba(255,255,255,0.80)' : 'rgba(20,20,60,0.80)';

  // Compute average scores
  const totals = {};
  PERSONALITY_LIST.forEach(p => { totals[p.id] = 0; });
  let count = 0;
  for (const e of withPers) {
    if (e.personalityScores) {
      count++;
      for (const s of e.personalityScores) totals[s.id] = (totals[s.id] || 0) + s.pct;
    }
  }
  const avg = {};
  PERSONALITY_LIST.forEach(p => {
    avg[p.id] = count > 0 ? totals[p.id] / count : 0;
  });
  const maxVal = Math.max(...Object.values(avg), 1);

  const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;

  // ── Concentric rings (5 rings) ──
  for (let ring = 1; ring <= 5; ring++) {
    const r = (ring / 5) * R;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const a = angle(i % N);
      const x = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = ring === 5 ? ringStrong : ringWeak;
    ctx.lineWidth   = ring === 5 ? 1.5 : 0.8;
    ctx.stroke();
  }

  // ── Axis lines ──
  for (let i = 0; i < N; i++) {
    const a = angle(i);
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
    ctx.strokeStyle = axisCol;
    ctx.lineWidth = 0.8; ctx.setLineDash([]);
    ctx.stroke();
  }

  // ── Data polygon (animated radial expansion) ──
  const topId    = Object.entries(avg).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topColor = PERSONALITIES[topId]?.color || '#8b5cf6';
  const topRgb   = _hexToRgb(topColor);
  // ease-out-cubic easing on progress for a more "snappy" entrance
  const ease = 1 - Math.pow(1 - progress, 3);

  // Pre-compute vertex positions for both drawing AND hover storage
  const verts = PERSONALITY_LIST.map((p, i) => {
    const val = (avg[p.id] / maxVal) * 0.88 * ease;
    const r   = val * R;
    const a   = angle(i);
    return {
      x: CX + Math.cos(a) * r,
      y: CY + Math.sin(a) * r,
      val: avg[p.id],
      pct: Math.round(avg[p.id]),
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      color: p.color
    };
  });

  ctx.beginPath();
  verts.forEach((v, i) => {
    if (i === 0) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();

  const polyGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
  polyGrad.addColorStop(0,   `rgba(${topRgb},${0.55 * progress})`);
  polyGrad.addColorStop(0.6, `rgba(${topRgb},${0.22 * progress})`);
  polyGrad.addColorStop(1,   `rgba(99,102,241,${0.08 * progress})`);
  ctx.fillStyle = polyGrad;
  ctx.fill();

  // Soft outer glow on the polygon stroke
  ctx.shadowColor = `rgba(${topRgb},0.55)`;
  ctx.shadowBlur  = 16 * progress;
  ctx.strokeStyle = `rgba(${topRgb},${Math.max(0.4, 0.92 * progress)})`;
  ctx.lineWidth   = 2.5;
  ctx.lineJoin    = 'round';
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;

  // ── Vertex dots + labels ──
  const emojiSize  = Math.round(size * 0.065); // ~32px at 480
  const nameSize   = Math.round(size * 0.026); // ~12px
  const labelDist  = R + LABEL_PAD * 0.58;

  verts.forEach((v, i) => {
    const isHover = i === hoverIdx;
    const isTop   = v.id === topId;

    // Vertex dot — bigger + accented for top personality / hover
    const dotR = isHover ? 5.5 : (isTop ? 4 : 3);
    if (isTop && progress > 0.85) {
      ctx.beginPath(); ctx.arc(v.x, v.y, dotR + 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${topRgb},0.25)`;
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(v.x, v.y, dotR, 0, Math.PI * 2);
    ctx.fillStyle   = isTop ? topColor : (isHover ? topColor : dotFill);
    ctx.fill();
    ctx.strokeStyle = isTop ? `rgba(${topRgb},0.5)` : dotStroke;
    ctx.lineWidth   = isTop ? 1.5 : 1;
    ctx.stroke();

    // Outer label — emoji + name (always full opacity, regardless of theme)
    const a  = angle(i);
    const lx = CX + Math.cos(a) * labelDist;
    const ly = CY + Math.sin(a) * labelDist;

    ctx.fillStyle = 'rgba(0,0,0,1)';  // emoji renders in its own colors
    ctx.font = `${emojiSize}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(v.emoji, lx, ly - nameSize * 0.9);

    // Name below emoji
    ctx.fillStyle = isTop || isHover ? topColor : nameCol;
    ctx.font = `${isTop || isHover ? '700' : '600'} ${nameSize}px system-ui`;
    ctx.fillText(v.name.replace('The ', ''), lx, ly + emojiSize * 0.55);
  });

  // Stash geometry for the hover handler
  canvas._dnaGeom = {
    points: verts.map(v => ({ x: v.x, y: v.y })),
    data:   verts.map(v => ({ name: v.name.replace('The ', ''), emoji: v.emoji, val: v.pct })),
    topId,
    topColor
  };
}

// ── Markdown → HTML (minimal, safe) ──
function markdownToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  let inPara    = false;
  let inSection = false;

  const closePara    = () => { if (inPara)    { html += '</p>';   inPara    = false; } };
  const closeSection = () => { if (inSection) { html += '</div>'; inSection = false; } };

  const inline = s => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');

  // Section icon map - keyed on first word of heading (lowercased)
  const SECTION_ICONS = {
    who: '\u2657', your: '\u2658', blind: '\u2656', this: '\u2654', study: '\u2659'
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { closePara(); continue; }

    const h2  = line.match(/^##\s+(.*)/);
    const h1  = line.match(/^#\s+(.*)/);
    const li  = line.match(/^[-*]\s+(.*)/);
    const num = line.match(/^\d+\.\s+(.*)/);

    if (h1 || h2) {
      closePara();
      closeSection();
      const headText = (h1 || h2)[1];
      const iconKey  = headText.toLowerCase().split(/\s+/)[0];
      const icon     = SECTION_ICONS[iconKey] || '◆';
      inSection = true;
      html += `<div class="coach-section"><div class="coach-heading"><span class="coach-heading-icon">${icon}</span>${inline(headText)}</div>`;
    } else if (li) {
      closePara();
      html += `<div class="coach-item"><span class="coach-bullet">&#9670;</span><span>${inline(li[1])}</span></div>`;
    } else if (num) {
      closePara();
      html += `<div class="coach-item coach-numbered"><span class="coach-num">${line.match(/^(\d+)\./)[1]}</span><span>${inline(num[1])}</span></div>`;
    } else {
      if (!inPara) { html += '<p>'; inPara = true; } else { html += ' '; }
      html += inline(line);
    }
  }
  closePara();
  closeSection();
  return html;
}

// ── AI Coach: persistence helpers ──
// NOTE: cache key is suffixed with a version. Bump this when the
// prompt or resource list changes so old cached plans are discarded.
const _COACH_CACHE_STORAGE_KEY = 'ce-coach-cache-v2';
function _loadCoachCacheFromStorage() {
  try {
    const raw = localStorage.getItem(_COACH_CACHE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    // Drop the legacy cache so users automatically get the new plan
    // with whitelisted study links instead of the old YouTube search.
    localStorage.removeItem('ce-coach-cache');
  } catch {}
  return { key: null, html: null, tasks: null };
}
function _saveCoachCacheToStorage() {
  try {
    localStorage.setItem(_COACH_CACHE_STORAGE_KEY, JSON.stringify(_coachCache));
  } catch {}
}
function invalidateCoachPlan() {
  _coachCache = { key: null, html: null, tasks: null };
  localStorage.removeItem(_COACH_CACHE_STORAGE_KEY);
  localStorage.removeItem('ce-coach-cache');
}

// ── AI Coach: Generate personalised advice ──
let _coachCache = _loadCoachCacheFromStorage();

let _coachPageMode = false;

async function generateInsightsAdvice() {
  const btn = document.getElementById('insCoachBtn');
  const content = document.getElementById('insCoachContent');
  if (!content) return;
  await _generateCoachAdviceShared(content, btn);
}

async function _generateCoachAdviceShared(content, btn) {
  if (!content) return;

  // Build a cache key from current aggregate personality
  const agg = await getAggregatePersonality();
  const cacheKey = agg ? agg.breakdown.map(s => s.personality.id + ':' + s.pct).join(',') : null;

  // If personality hasn't changed since last advice, show cached
  if (cacheKey && _coachCache.key === cacheKey && _coachCache.html) {
    _coachTasks = _coachCache.tasks || [];
    _cpoLastHtml = _coachCache.html;
    if (_coachPageMode) {
      _mountCoachDeck(content, _coachCache.html, _coachTasks);
    } else {
      content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(_coachCache.html, _coachTasks) + '</div>';
    }
    if (btn) { btn.innerHTML = '<span class="ins-coach-cta-icon">&#10003;</span> Advice generated'; btn.disabled = true; }
    return;
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ins-coach-cta-icon">&#9889;</span> Analyzing...'; }
  content.innerHTML = _coachPageMode
    ? '<div class="coach-page-loading"><div class="coach-page-loading-spinner"></div><div class="coach-page-loading-text">Analyzing your games...</div></div>'
    : '<div class="ins-coach-empty"><div class="ins-coach-empty-text">Analyzing your games\u2026</div></div>';

  let history = [];
  try { history = await dbGetHistory(); } catch {}
  const withPers = history.filter(e => e.personality && PERSONALITIES[e.personality]);

  // Build aggregate data
  const totals = {};
  PERSONALITY_LIST.forEach(p => { totals[p.id] = 0; });
  let count = 0;
  for (const e of withPers) {
    if (e.personalityScores) {
      count++;
      for (const s of e.personalityScores) totals[s.id] = (totals[s.id] || 0) + s.pct;
    }
  }
  const avg = {};
  PERSONALITY_LIST.forEach(p => { avg[p.id] = count > 0 ? Math.round(totals[p.id] / count) : 0; });

  // Sort by strength
  const sorted = Object.entries(avg).sort((a, b) => b[1] - a[1]);
  const top3    = sorted.slice(0, 3).map(([id, pct]) => `${PERSONALITIES[id].name} (${pct}%)`).join(', ');
  const bottom3 = sorted.slice(-3).map(([id, pct]) => `${PERSONALITIES[id].name} (${pct}%)`).join(', ');

  // Recent primary personalities
  const recentPrimaries = withPers.slice(0, 5).map(e => PERSONALITIES[e.personality]?.name || '?').join(' → ');

  // Win/loss/draw
  const wins   = withPers.filter(e => e.result === '1-0' && e.playerColor === 'w' || e.result === '0-1' && e.playerColor === 'b').length;
  const losses = withPers.filter(e => e.result === '1-0' && e.playerColor === 'b' || e.result === '0-1' && e.playerColor === 'w').length;
  const draws  = withPers.length - wins - losses;

  // Detect platform from most recent game or fallback to current selection
  let platform = 'lichess';
  try { platform = (typeof gsPlatform !== 'undefined' && gsPlatform) || 'lichess'; } catch {}
  const platformName = platform === 'chesscom' ? 'Chess.com' : 'Lichess';
  const puzzleUrl = platform === 'chesscom'
    ? 'https://www.chess.com/puzzles'
    : 'https://lichess.org/training';

  // ── Whitelisted study resources ──
  // Task 2 must pick exactly ONE of these (Claude is not allowed to invent URLs).
  const STUDY_RESOURCES = [
    { id: 'tactical-targets', title: 'Tactical Targets in Chess',
      url: 'https://chessfox.com/tactical-targets-in-chess/',
      topic: 'tactical targets, weak squares, undefended pieces' },
    { id: 'chess-elements',   title: 'The Chess Elements (why pieces have the values they have)',
      url: 'https://www.youtube.com/watch?v=L2CK5FKC5Zs&t=2468s',
      topic: 'piece values, material, fundamental elements of chess' },
    { id: 'chess-weaknesses', title: 'Chess Weaknesses',
      url: 'https://www.youtube.com/watch?v=KZNUV2wiBAc',
      topic: 'pawn weaknesses, weak squares, structural weaknesses' },
    { id: 'tactics-u1800',    title: 'Complete Chess Tactics Guide For Under-1800 Rated Players',
      url: 'https://www.youtube.com/watch?v=fN3xjmw6wzY',
      topic: 'tactics fundamentals, pattern recognition, calculation' },
    { id: 'positional',       title: 'Positional Chess',
      url: 'https://www.youtube.com/watch?v=WGeQ8pSmSiE',
      topic: 'positional play, planning, strategic thinking' },
  ];
  const studyMenu = STUDY_RESOURCES
    .map(r => `[${r.id}] "${r.title}" — covers ${r.topic}`)
    .join('\n');

  const prompt = `You are a bold chess personality coach. A player analyzed ${count} game${count !== 1 ? 's' : ''}.

Player data:
- Dominant traits: ${top3}
- Underused traits: ${bottom3}
- Recent sequence: ${recentPrimaries}
- Record: ${wins}W / ${losses}L / ${draws}D
- Platform: ${platformName}

Personalities: ${PERSONALITY_LIST.map(p => `${p.name}: ${p.playstyle}`).join('; ')}

RULES: Only use data above. No em-dashes. No bullets. Always "you/your". Every section MUST be SHORT: max 2 sentences per section. Be punchy and direct.

Write these sections with EXACTLY these ## headers:

## Your Profile
One punchy identity line, then name strongest/weakest trait. Max 2 sentences.

## Task 1: Solve Tactical Puzzles
TASK: [specific puzzle type like "defensive puzzles" or "mating in 3"] | [why this fits their weakness]
One sentence on what to focus on. No links needed.

## Task 2: Study a Key Concept
TASK: Study [very specific concept] | [why it addresses their gap]
Then pick EXACTLY ONE resource from this whitelist that best matches the player's weakness:
${studyMenu}
On a new line write "RESOURCE: [id]" using the bracketed id of your chosen resource. Do NOT invent URLs, do NOT write "SEARCH:", and do NOT recommend any other resource. One sentence on what to focus on while watching/reading.

## Task 3: Play Focused Games
TASK: Play [N] games at [time control] | [why this time control]
Then exactly 3 pre-move questions, each on its own line starting with "Q:". Keep each question under 10 words.

## Task 4: Learn from the Masters
TASK: Analyze your next game focusing on [area] | [why]
Then exactly 2 famous master games. Each on its own line: "GAME: [White] vs [Black], [Year] | [what it teaches]". Do NOT include any URLs or links.`;


  try {
    const key = document.getElementById('apiKey')?.value?.trim() || '';
    const raw = await callClaudeLong(prompt, key);
    const rendered = renderAicRich(marked.parse(raw), null, 'full');

    // Parse structured tasks from raw text
    const tasks = [];
    const taskRx = /TASK:\s*(.+?)\s*\|\s*(.+)/g;
    let m;
    while ((m = taskRx.exec(raw)) !== null && tasks.length < 4) {
      const task = { title: m[1].trim(), desc: m[2].trim(), done: false, questions: [], games: [] };
      // Determine task type from position
      const idx = tasks.length;
      task.type = ['tactics', 'study', 'play', 'analysis'][idx] || 'general';
      task.icon = ['\u265E', '\uD83D\uDCD6', '\u265F', '\uD83D\uDD0D'][idx] || '\u2605';
      tasks.push(task);
    }
    // Parse Q: lines for Task 3 (play)
    const qRx = /Q:\s*(.+)/g;
    let qm;
    while ((qm = qRx.exec(raw)) !== null) {
      const playTask = tasks.find(t => t.type === 'play');
      if (playTask && playTask.questions.length < 3) {
        playTask.questions.push(qm[1].trim());
      }
    }
    // Parse GAME: lines and match to real games from our database
    const analTask = tasks.find(t => t.type === 'analysis');
    if (analTask && typeof findMasterGames === 'function') {
      // Use full task context + raw text to find best matching games
      const context = (analTask.title + ' ' + analTask.desc + ' ' + raw).toLowerCase();
      analTask.games = findMasterGames(context, 2);
    } else if (analTask) {
      // Fallback: parse GAME: lines and build search links
      const gameRx = /GAME:\s*(.+?)\s*\|\s*(.+)/g;
      let gm;
      while ((gm = gameRx.exec(raw)) !== null) {
        if (analTask.games.length < 2) {
          const name = gm[1].trim();
          const link = `https://www.chessgames.com/perl/chess.pl?action=2&searchterm=${encodeURIComponent(name)}`;
          analTask.games.push({ name, lesson: gm[2].trim(), link });
        }
      }
    }
    // Parse RESOURCE: line for Task 2 (study) - look up the chosen
    // resource from the whitelist. Claude is restricted to picking
    // exactly one entry; if it picks nothing valid, fall back to the
    // first whitelist entry rather than exposing a search query URL.
    const resourceRx = /RESOURCE:\s*\[?([a-z0-9-]+)\]?/i;
    const resourceMatch = resourceRx.exec(raw);
    const studyTask = tasks.find(t => t.type === 'study');
    if (studyTask) {
      let chosen = null;
      if (resourceMatch) {
        const wantedId = resourceMatch[1].trim().toLowerCase();
        chosen = STUDY_RESOURCES.find(r => r.id === wantedId);
      }
      if (!chosen) chosen = STUDY_RESOURCES[0];
      studyTask.studyLink = chosen.url;
      studyTask.studyQuery = chosen.title;
    }
    _coachTasks = tasks;

    // Build the content: slide-deck on the coach page, scroll-story elsewhere
    if (_coachPageMode) {
      _mountCoachDeck(content, rendered, tasks);
    } else {
      content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(rendered, tasks) + '</div>';
    }
    _coachCache = { key: cacheKey, html: rendered, tasks: tasks };
    _saveCoachCacheToStorage();
    if (btn) {
      if (_coachPageMode) {
        btn.style.display = 'none'; // hide bottom CTA - "New plan" is inside the result
      } else {
        btn.textContent = '\u2713 Advice generated'; btn.disabled = true;
      }
    }
    // Coach story is rendered inline - no presentation overlay needed
  } catch (err) {
    content.innerHTML = '<div class="ins-coach-error">Could not generate advice. Please check your connection and try again.</div>';
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="ins-coach-cta-icon">&#9889;</span> Get Personalised Advice'; }
  }
}

// ── Coach task plan state ──
let _coachTasks = [];

// Reset coach plan cache and regenerate
function resetCoachPlan() {
  invalidateCoachPlan();
  // Show loading state before regenerating
  const btn = document.getElementById('insCoachBtn');
  const content = document.getElementById('insCoachContent');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="ins-coach-cta-icon">&#9889;</span> Generating...'; }
  if (content) content.innerHTML = '<div class="ins-coach-empty"><div class="ins-coach-empty-text">Creating your new practice plan\u2026</div></div>';
  generateInsightsAdvice();
}

// Build coach result as scroll-driven story page (like repertoire)
function _buildCoachResultHtml(renderedHtml, tasks) {
  const resetFn = _coachPageMode ? 'resetCoachPagePlan' : 'resetCoachPlan';

  // Parse rendered HTML to extract section headings + bodies
  const wrap = document.createElement('div');
  wrap.innerHTML = renderedHtml;
  const block = wrap.querySelector('.aic-rich-block') || wrap;

  const sections = [];
  let cur = null;
  for (const node of Array.from(block.children)) {
    const isHead = node.classList?.contains('aic-section-head');
    if (isHead) {
      if (cur) sections.push(cur);
      cur = { heading: node.textContent.trim(), headHtml: node.outerHTML, body: '' };
    } else if (cur) {
      cur.body += node.outerHTML;
    }
  }
  if (cur) sections.push(cur);

  // Map tasks by index to sections (DNA=0, Task1=1, Task2=2, Task3=3, Task4=4)
  const taskMap = {};
  tasks.forEach((t, i) => { taskMap[i + 1] = t; }); // tasks[0]→section 1, etc.

  // ── Hero ──
  let html = `
    <div class="coach-story-wrap" id="coachStoryWrap">
      <div class="coach-story-hero">
        <h2 class="coach-story-hero-title">Your Monthly Practice Plan</h2>
        <p class="coach-story-hero-sub">Four focused tasks to sharpen the gaps in your play.</p>
      </div>`;

  // Helper: strip emoji characters from HTML strings
  function stripEmojis(h) {
    return h.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s{2,}/g, ' ');
  }

  // Strip emojis from section heading HTML
  function cleanHeadHtml(h) {
    // Remove emoji spans (aic-section-icon) and inline emoji characters
    return h.replace(/<span class="aic-section-icon">[^<]*<\/span>/g, '')
            .replace(/<span class="aic-inline-icon">[^<]*<\/span>/g, '')
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '');
  }

  // ── Sections as scroll-driven story ──
  sections.forEach((sec, i) => {
    // Narrative divider before each section (except first)
    if (i > 0) {
      const narratives = [
        '',
        { text: 'Train the pattern', sub: 'Puzzles that target your weakest area.' },
        { text: 'Study the concept', sub: 'A single resource to fill the gap.' },
        { text: 'Practice with intention', sub: 'Play deliberate games with pre-move questions.' },
        { text: 'Learn from the masters', sub: 'Games that illustrate the idea in action.' },
      ];
      const nar = narratives[i] || { text: 'Next up', sub: '' };
      if (typeof nar === 'object') {
        html += `
        <div class="rep-narrative rep-scroll-section">
          <div class="rep-narrative-text">${nar.text}</div>
          ${nar.sub ? `<div class="rep-narrative-sub">${nar.sub}</div>` : ''}
          <div class="rep-narrative-line"></div>
        </div>`;
      }
    }

    const taskIdx = i;
    const task = taskMap[taskIdx];
    const headCleaned = cleanHeadHtml(sec.headHtml);

    html += `<div class="coach-story-section rep-scroll-section">`;
    html += headCleaned;

    // DNA section (i=0): show body text (stripped of emojis)
    // Task sections (i>=1): skip the raw body, only show the task card
    if (i === 0) {
      html += `<div class="coach-story-body">${stripEmojis(sec.body)}</div>`;
    }

    if (task) {
      html += _buildSingleTaskCard(task, taskIdx - 1);
    }

    html += `</div>`;

    // Fading divider after each section (sits between the task card and the next narrative heading)
    if (i < sections.length - 1) {
      html += `<div class="coach-story-divider"></div>`;
    }
  });

  // ── Progress + New Plan button at bottom ──
  const doneCount = tasks.filter(t => t.done).length;
  html += `
      <div class="coach-story-footer rep-scroll-section">
        <div class="coach-plan-progress" id="coachPlanProgress">${doneCount} of ${tasks.length} completed</div>
        <button class="coach-story-new-btn" onclick="${resetFn}()" title="Generate a fresh plan">&#8635;&nbsp;Generate New Plan</button>
      </div>
    </div>`;

  // Kick off scroll observer after DOM update
  requestAnimationFrame(() => _initCoachScrollObserver());

  return html;
}

// Build a single inline task card (clickable button, no checkbox)
function _buildSingleTaskCard(t, idx) {
  let extra = '';
  if (t.questions && t.questions.length) {
    extra += `<div class="coach-task-questions">
      <div class="coach-task-q-label">Ask yourself before every move:</div>
      ${t.questions.map(q => `<div class="coach-task-q">${_escHtml(q)}</div>`).join('')}
    </div>`;
  }
  if (t.studyLink) {
    const isYt = /youtube\.com|youtu\.be/i.test(t.studyLink);
    const verb = isYt ? 'Watch on YouTube' : 'Read article';
    extra += `<div class="coach-task-study">
      <a class="coach-task-study-link" href="${_escHtml(t.studyLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${verb}: ${_escHtml(t.studyQuery || 'Study resource')}</a>
    </div>`;
  }
  if (t.games && t.games.length) {
    extra += `<div class="coach-task-games">
      <div class="coach-task-g-label">Study these master games:</div>
      ${t.games.map(g => {
        const nameHtml = g.link
          ? `<a class="coach-task-game-link" href="${_escHtml(g.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${_escHtml(g.name)}</a>`
          : `<span class="coach-task-game-name">${_escHtml(g.name)}</span>`;
        return `<div class="coach-task-game">
        ${nameHtml}
        <span class="coach-task-game-lesson">${_escHtml(g.lesson)}</span>
      </div>`;
      }).join('')}
    </div>`;
  }
  return `
  <div class="coach-task ${t.done ? 'coach-task-done' : ''}" id="coachTask${idx}" onclick="toggleCoachTask(${idx})">
    <div class="coach-task-body">
      <div class="coach-task-title">${_escHtml(t.title)}</div>
      <div class="coach-task-desc">${_escHtml(t.desc)}</div>
      ${extra}
    </div>
    <div class="coach-task-done-label">${t.done ? 'Done' : 'Mark complete'}</div>
  </div>`;
}

// Scroll-driven IntersectionObserver for coach story (mirrors repertoire's)
let _coachObserver = null;
function _initCoachScrollObserver() {
  if (_coachObserver) _coachObserver.disconnect();

  // Works on both the dedicated coach page and the insights tab
  const page = document.getElementById('pageCoach') || document.getElementById('pageInsights');
  const wrap = document.querySelector('.coach-story-wrap');
  if (!wrap || !page) return;

  const sections = wrap.querySelectorAll('.rep-scroll-section');
  if (!sections.length) return;

  sections.forEach(el => el.classList.remove('rep-visible'));

  _coachObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('rep-visible');
        _coachObserver.unobserve(entry.target);
      }
    }
  }, {
    root: page,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.15
  });

  sections.forEach(el => _coachObserver.observe(el));
}

function _buildTaskPlanHtml(tasks) {
  if (!tasks.length) return '';
  return `
    <div class="coach-plan">
      <div class="coach-plan-header">
        <span class="coach-plan-icon">&#128203;</span>
        <span class="coach-plan-title">Your Practice Plan</span>
      </div>
      <div class="coach-plan-tasks" id="coachPlanTasks">
        ${tasks.map((t, i) => {
          let extra = '';
          // Task 3: show pre-move questions
          if (t.questions && t.questions.length) {
            extra += `<div class="coach-task-questions">
              <div class="coach-task-q-label">Ask yourself before every move:</div>
              ${t.questions.map(q => `<div class="coach-task-q">${_escHtml(q)}</div>`).join('')}
            </div>`;
          }
          // Task 2: show study link (whitelist resource — YouTube or article)
          if (t.studyLink) {
            const isYt = /youtube\.com|youtu\.be/i.test(t.studyLink);
            const verb = isYt ? '&#9654; Watch on YouTube' : '&#9654; Read article';
            extra += `<div class="coach-task-study">
              <a class="coach-task-study-link" href="${_escHtml(t.studyLink)}" target="_blank" rel="noopener">${verb}: ${_escHtml(t.studyQuery || 'Study resource')}</a>
            </div>`;
          }
          // Task 4: show master games
          if (t.games && t.games.length) {
            extra += `<div class="coach-task-games">
              <div class="coach-task-g-label">Study these master games:</div>
              ${t.games.map(g => {
                const nameHtml = g.link
                  ? `<a class="coach-task-game-link" href="${_escHtml(g.link)}" target="_blank" rel="noopener">${_escHtml(g.name)} &#8599;</a>`
                  : `<span class="coach-task-game-name">${_escHtml(g.name)}</span>`;
                return `<div class="coach-task-game">
                ${nameHtml}
                <span class="coach-task-game-lesson">${_escHtml(g.lesson)}</span>
              </div>`;
              }).join('')}
            </div>`;
          }
          return `
          <div class="coach-task ${t.done ? 'coach-task-done' : ''}" id="coachTask${i}" onclick="toggleCoachTask(${i})">
            <div class="coach-task-check">${t.done ? '&#10003;' : ''}</div>
            <div class="coach-task-body">
              <div class="coach-task-title"><span class="coach-task-icon">${t.icon || ''}</span> ${_escHtml(t.title)}</div>
              <div class="coach-task-desc">${_escHtml(t.desc)}</div>
              ${extra}
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="coach-plan-progress" id="coachPlanProgress">${tasks.filter(t => t.done).length} of ${tasks.length} completed</div>
    </div>
  `;
}

function toggleCoachTask(idx) {
  if (idx < 0 || idx >= _coachTasks.length) return;
  _coachTasks[idx].done = !_coachTasks[idx].done;
  const isDone = _coachTasks[idx].done;
  // Update the task element
  const el = document.getElementById('coachTask' + idx);
  if (el) {
    el.classList.toggle('coach-task-done', isDone);
    const label = el.querySelector('.coach-task-done-label');
    if (label) label.textContent = isDone ? 'Done' : 'Mark complete';
  }
  // Update progress
  const done = _coachTasks.filter(t => t.done).length;
  const total = _coachTasks.length;
  const prog = document.getElementById('coachPlanProgress');
  if (prog) {
    if (done === total && total > 0) {
      prog.innerHTML = '<span class="coach-congrats">All tasks completed. Great work.</span>';
    } else {
      prog.textContent = `${done} of ${total} completed`;
    }
  }
  // Update cache + persist
  if (_coachCache.tasks) _coachCache.tasks = _coachTasks;
  _saveCoachCacheToStorage();
}


// ══════════════════════════════════════════════
// AI COACH — SLIDE DECK PRESENTATION
// (mirrors the Opening Repertoire deck UX)
// ══════════════════════════════════════════════
let _coachDeckIdx = 0;
let _coachDeckTotal = 0;
let _coachDeckAnimating = false;
let _coachDeckKeyHandler = null;
let _coachDeckClickHandler = null;

function _buildCoachDeckHtml(renderedHtml, tasks) {
  const wrap = document.createElement('div');
  wrap.innerHTML = renderedHtml;
  const block = wrap.querySelector('.aic-rich-block') || wrap;

  const sections = [];
  const badges = [];
  let cur = null;
  for (const node of Array.from(block.children)) {
    const cls = node.classList;
    const isHead = cls && cls.contains('aic-section-head');
    const isBadge = cls && (cls.contains('aic-eval-pill') || cls.contains('aic-class-row'));
    if (isBadge) { badges.push(node.outerHTML); continue; }
    if (isHead) {
      if (cur) sections.push(cur);
      const heading = node.textContent.trim()
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu, '')
        .trim();
      cur = { heading: heading, body: '' };
    } else if (cur) {
      cur.body += node.outerHTML;
    }
  }
  if (cur) sections.push(cur);

  const narratives = [
    { label: 'Train the pattern',       sub: 'Puzzles that target your weakest area.' },
    { label: 'Study the concept',       sub: 'A single resource to fill the gap.' },
    { label: 'Practice with intention', sub: 'Deliberate games with pre-move questions.' },
    { label: 'Learn from the masters',  sub: 'Games that illustrate the idea in action.' },
  ];

  const slides = [];

  // 1) Intro slide
  slides.push(`
    <div class="rep-slide-inner rep-slide-center coach-deck-slide-intro">
      <div class="rep-slide-eyebrow rep-fx" data-fx="0">Your Practice Plan</div>
      <h2 class="rep-slide-title rep-fx" data-fx="1">Four focused tasks,<br>built around you</h2>
      <p class="rep-slide-sub rep-fx" data-fx="2">
        A pattern to train, a concept to study, deliberate games to play, and master games to learn from &mdash; chosen to sharpen the gaps in your play.
      </p>
      ${badges.length ? `<div class="coach-deck-badges rep-fx" data-fx="3">${badges.join('')}</div>` : ''}
    </div>`);

  // Strip emojis from HTML
  function _stripEmojisHtml(h) {
    return h.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s{2,}/g, ' ');
  }

  // 2) Section slides — first section (DNA/overview) shown after intro.
  //    Sections 1..4 are tasks → render with the proper task card (with
  //    real study/game links), not raw TASK:/RESOURCE: text.
  sections.forEach((sec, i) => {
    let nar;
    if (i === 0) {
      nar = { label: 'Where you stand', sub: 'Your strengths and the gaps we saw.' };
    } else {
      nar = narratives[i - 1] || { label: 'Next up', sub: '' };
    }

    let bodyHtml;
    let bodyVariant;
    if (i === 0) {
      bodyHtml = _stripEmojisHtml(sec.body);
      bodyVariant = 'coach-deck-body-narrative';
    } else if (tasks && tasks[i - 1]) {
      bodyHtml = _buildSingleTaskCard(tasks[i - 1], i - 1);
      bodyVariant = 'coach-deck-body-task';
    } else {
      bodyHtml = _stripEmojisHtml(sec.body);
      bodyVariant = 'coach-deck-body-narrative';
    }

    slides.push(`
      <div class="rep-slide-inner rep-slide-center coach-deck-slide">
        <div class="rep-slide-eyebrow rep-fx" data-fx="0">${nar.label}</div>
        <h2 class="rep-slide-title coach-deck-slide-title rep-fx" data-fx="1">${sec.heading || 'Section'}</h2>
        ${nar.sub ? `<p class="rep-slide-sub rep-fx" data-fx="2">${nar.sub}</p>` : ''}
        <div class="rep-slide-opening-divider rep-fx" data-fx="3"></div>
        <div class="coach-deck-body ${bodyVariant} rep-fx" data-fx="4">${bodyHtml}</div>
      </div>`);
  });

  // 3) CTA slide
  slides.push(`
    <div class="rep-slide-inner rep-slide-cta rep-slide-center">
      <div class="rep-slide-eyebrow rep-fx" data-fx="0">You're set</div>
      <h2 class="rep-slide-title rep-fx" data-fx="1">Time to put it in motion</h2>
      <p class="rep-slide-sub rep-fx" data-fx="2">Play a live game and the coach will refine your plan from what it sees.</p>
      <button class="rep-cta-btn rep-slide-cta-btn rep-fx" data-fx="3" onclick="showPage('gameSelect')">
        Analyze a game
        <span class="rep-cta-arrow">&#8594;</span>
      </button>
      <div class="rep-cta-divider rep-fx" data-fx="4"></div>
      <div class="rep-cta-more-label rep-fx" data-fx="5">Or keep exploring</div>
      <div class="rep-slide-crosslinks rep-fx" data-fx="6">
        <div class="rep-crosslink" onclick="openRepertoire()">
          <span class="rep-crosslink-icon rep-crosslink-icon-text">&#9817;</span>
          <div class="rep-crosslink-name">Your Ideal Openings</div>
          <div class="rep-crosslink-desc">Personality-matched repertoire</div>
        </div>
        <div class="rep-crosslink" onclick="showPage('profile'); renderFullProfile(); openInsights();">
          <span class="rep-crosslink-icon rep-crosslink-icon-text">&#9819;</span>
          <div class="rep-crosslink-name">Game Insights</div>
          <div class="rep-crosslink-desc">Turning points &amp; best openings</div>
        </div>
        <div class="rep-crosslink" onclick="coachDeckGo(0)">
          <span class="rep-crosslink-icon rep-crosslink-icon-text">&#10227;</span>
          <div class="rep-crosslink-name">Replay plan</div>
          <div class="rep-crosslink-desc">Walk through the slides again</div>
        </div>
      </div>
    </div>`);

  _coachDeckTotal = slides.length;

  return `
    <div class="coach-deck-wrap">
      <div class="rep-deck-stage coach-deck-stage" id="coachDeckStage" role="region" aria-label="Coach practice plan" tabindex="0">
        <div class="rep-deck-slides" id="coachDeckSlides">
          ${slides.map((s, i) => `<div class="rep-slide${i === 0 ? ' rep-slide-active' : ''}" data-slide-idx="${i}">${s}</div>`).join('')}
        </div>
        <div class="rep-deck-hint" id="coachDeckHint">
          <span class="rep-deck-hint-kbd">Click</span>
          <span>or press</span>
          <span class="rep-deck-hint-kbd">Space</span>
          <span>to continue</span>
        </div>
      </div>
      <div class="rep-deck-controls">
        <button class="rep-deck-nav rep-deck-prev" id="coachDeckPrev" onclick="coachDeckGo(_coachDeckIdx - 1)" aria-label="Previous slide" disabled>
          <span class="rep-deck-nav-arrow">&#8592;</span>
        </button>
        <div class="rep-deck-dots" id="coachDeckDots">
          ${slides.map((_, i) => `<span class="rep-deck-dot${i === 0 ? ' rep-deck-dot-active' : ''}" onclick="coachDeckGo(${i})"></span>`).join('')}
        </div>
        <button class="rep-deck-nav rep-deck-next" id="coachDeckNext" onclick="coachDeckGo(_coachDeckIdx + 1)" aria-label="Next slide">
          <span class="rep-deck-nav-arrow">&#8594;</span>
        </button>
      </div>
    </div>`;
}

function _coachDeckActivate(idx) {
  const slidesEl = document.getElementById('coachDeckSlides');
  if (!slidesEl) return;
  const slides = slidesEl.querySelectorAll('.rep-slide');
  if (!slides.length) return;

  idx = Math.max(0, Math.min(slides.length - 1, idx));
  const prevIdx = _coachDeckIdx;
  const direction = idx >= prevIdx ? 'fwd' : 'back';

  slides.forEach((el, i) => {
    el.classList.remove('rep-slide-active', 'rep-slide-exit', 'rep-slide-exit-back');
    if (i === idx) {
      el.classList.add('rep-slide-active');
      el.setAttribute('data-direction', direction);
      const fxEls = el.querySelectorAll('.rep-fx');
      fxEls.forEach(fx => {
        fx.classList.remove('rep-fx-in');
        void fx.offsetWidth;
        const delay = parseInt(fx.getAttribute('data-fx'), 10) || 0;
        fx.style.animationDelay = (80 + delay * 140) + 'ms';
        fx.classList.add('rep-fx-in');
      });
    } else if (i === prevIdx) {
      el.classList.add(direction === 'fwd' ? 'rep-slide-exit' : 'rep-slide-exit-back');
    }
  });

  _coachDeckIdx = idx;
  _coachDeckUpdateChrome();
}

function _coachDeckUpdateChrome() {
  const total = _coachDeckTotal;
  const dots = document.querySelectorAll('#coachDeckDots .rep-deck-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('rep-deck-dot-active', i === _coachDeckIdx);
    d.classList.toggle('rep-deck-dot-visited', i < _coachDeckIdx);
  });
  const prevBtn = document.getElementById('coachDeckPrev');
  const nextBtn = document.getElementById('coachDeckNext');
  if (prevBtn) prevBtn.disabled = _coachDeckIdx === 0;
  if (nextBtn) nextBtn.disabled = _coachDeckIdx >= total - 1;
  const hint = document.getElementById('coachDeckHint');
  if (hint) hint.classList.toggle('rep-deck-hint-hide', _coachDeckIdx > 0);
}

function coachDeckGo(idx) {
  if (_coachDeckAnimating) return;
  if (!_coachDeckTotal) return;
  if (idx < 0 || idx >= _coachDeckTotal) return;
  _coachDeckAnimating = true;
  _coachDeckActivate(idx);
  setTimeout(() => { _coachDeckAnimating = false; }, 420);
}

function _coachDeckAttachHandlers() {
  if (_coachDeckKeyHandler) {
    document.removeEventListener('keydown', _coachDeckKeyHandler, true);
  }
  _coachDeckKeyHandler = function(e) {
    const coachPage = document.getElementById('pageCoach');
    if (!coachPage || coachPage.style.display === 'none') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const keys = ['ArrowRight', 'ArrowLeft', ' ', 'Enter', 'PageDown', 'PageUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
      coachDeckGo(_coachDeckIdx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      coachDeckGo(_coachDeckIdx - 1);
    } else if (e.key === 'Home') {
      coachDeckGo(0);
    } else if (e.key === 'End') {
      coachDeckGo(_coachDeckTotal - 1);
    }
  };
  document.addEventListener('keydown', _coachDeckKeyHandler, true);

  const stage = document.getElementById('coachDeckStage');
  if (stage) {
    if (_coachDeckClickHandler) stage.removeEventListener('click', _coachDeckClickHandler);
    _coachDeckClickHandler = function(e) {
      if (e.target.closest('button, a, .rep-crosslink, .rep-deck-dot')) return;
      coachDeckGo(_coachDeckIdx + 1);
    };
    stage.addEventListener('click', _coachDeckClickHandler);
  }
}

function _mountCoachDeck(content, renderedHtml, tasks) {
  _coachDeckIdx = 0;
  content.innerHTML = _buildCoachDeckHtml(renderedHtml, tasks);
  // Hide the outer crosslinks (the deck has its own ending)
  const outerLinks = document.getElementById('coachCrosslinks');
  if (outerLinks) outerLinks.style.display = 'none';
  // Kick first slide animations
  requestAnimationFrame(() => {
    const first = document.querySelector('#coachDeckSlides .rep-slide[data-slide-idx="0"] .rep-fx');
    _coachDeckAttachHandlers();
    _coachDeckUpdateChrome();
    // Re-trigger fx on first slide
    document.querySelectorAll('#coachDeckSlides .rep-slide[data-slide-idx="0"] .rep-fx').forEach(fx => {
      fx.classList.remove('rep-fx-in');
      void fx.offsetWidth;
      const delay = parseInt(fx.getAttribute('data-fx'), 10) || 0;
      fx.style.animationDelay = (80 + delay * 140) + 'ms';
      fx.classList.add('rep-fx-in');
    });
  });
}
