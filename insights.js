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

function openInsights() {
  showPage('insights');
  _activeInsTab = 'moments';
  switchInsTab('moments');
  renderInsightsPage();
}

function openCoachPage() {
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
      if (content) content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(_coachCache.html, _coachTasks) + '</div>';
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

function resetCoachPagePlan() {
  invalidateCoachPlan();
  const btn = document.getElementById('coachPageBtn');
  const content = document.getElementById('coachPageContent');
  if (btn) { btn.style.display = ''; btn.disabled = true; btn.innerHTML = '<span class="coach-page-cta-icon">&#9889;</span> Generating...'; }
  if (content) content.innerHTML = '<div class="coach-page-loading"><div class="coach-page-loading-spinner"></div><div class="coach-page-loading-text">Creating your new practice plan...</div></div>';
  generateCoachPageAdvice();
}

async function generateCoachPageAdvice() {
  const content = document.getElementById('coachPageContent');
  const btn = document.getElementById('coachPageBtn');
  // Show loading immediately
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="coach-page-cta-icon">&#9889;</span> Generating...'; }
  if (content) content.innerHTML = '<div class="coach-page-loading"><div class="coach-page-loading-spinner"></div><div class="coach-page-loading-text">Analyzing your games...</div></div>';
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
  // Filter out repertoire-batch entries (same convention as profile history list)
  _gi.history = history.filter(e => e && e.source !== 'repertoire-batch');
  // Reset cached aggregations on every page entry
  _gi.moments = [];
  _gi.openings = [];
  _gi.momentsIdx = 0;
  _gi.expandedOpening = null;
  // Keep _insHistory populated for other consumers (renderCoachPage etc.)
  _insHistory = history.filter(e => e.personality && PERSONALITIES[e.personality]).slice(0, 20);

  // Header subtitle
  const subEl = document.getElementById('insHeaderSub');
  if (subEl) {
    const n = _gi.history.length;
    subEl.textContent = n > 0
      ? `Lessons drawn from ${n} analyzed game${n !== 1 ? 's' : ''}`
      : 'Analyze a game to unlock your insights';
  }

  // Render whichever tab is currently active
  requestAnimationFrame(() => {
    if (_activeInsTab === 'openings') giRenderOpeningsPanel();
    else giRenderMomentsPanel();
  });
}

// ── Game Insights: Critical Moments panel ──
function giRenderMomentsPanel() {
  const el = document.getElementById('insMomentsContent');
  if (!el) return;
  const hist = _gi.history || [];

  if (!hist.length) {
    el.innerHTML = `
      <section class="ins-empty">
        <div class="ins-empty-kicker">Critical Moments</div>
        <h3 class="ins-empty-title">No games yet</h3>
        <p class="ins-empty-text">Analyze a game from your profile to see the turning points that shaped your result.</p>
      </section>`;
    return;
  }

  const withIssues = hist.filter(e => (e.blunders || 0) + (e.mistakes || 0) > 0);
  if (!withIssues.length) {
    el.innerHTML = `
      <section class="ins-empty">
        <div class="ins-empty-kicker">Critical Moments</div>
        <h3 class="ins-empty-title">Nothing to flag — yet</h3>
        <p class="ins-empty-text">None of your analyzed games contain blunders or mistakes. Play a few more and we'll find your turning points.</p>
      </section>`;
    return;
  }

  // Sort by blunders desc, then mistakes desc
  const sorted = withIssues.slice().sort((a, b) =>
    ((b.blunders || 0) * 3 + (b.mistakes || 0)) - ((a.blunders || 0) * 3 + (a.mistakes || 0))
  );

  const totalBlunders = sorted.reduce((s, e) => s + (e.blunders || 0), 0);
  const totalMistakes = sorted.reduce((s, e) => s + (e.mistakes || 0), 0);

  const cards = sorted.map((e, i) => {
    const pc = e.playerColor || 'w';
    const opp = pc === 'w' ? (e.black || 'Black') : (e.white || 'White');
    const you = pc === 'w' ? (e.white || 'White') : (e.black || 'Black');
    let outcome = 'Draw';
    if (e.result === '1-0') outcome = pc === 'w' ? 'Win' : 'Loss';
    else if (e.result === '0-1') outcome = pc === 'b' ? 'Win' : 'Loss';
    else if (e.result === '1/2-1/2') outcome = 'Draw';
    const outcomeCls = outcome === 'Win' ? 'win' : outcome === 'Loss' ? 'loss' : 'draw';
    const dateStr = e.date ? new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const blunders = e.blunders || 0;
    const mistakes = e.mistakes || 0;
    const rankNum = String(i + 1).padStart(2, '0');
    const sideLabel = pc === 'w' ? 'Played White' : 'Played Black';
    return `
      <div class="ins-mg-card" onclick="loadFromHistory(${e.id})">
        <div class="ins-mg-top">
          <span class="ins-mg-rank">${rankNum}</span>
          <span class="ins-mg-outcome ${outcomeCls}">${outcome}</span>
        </div>
        <div class="ins-mg-matchup">
          <span class="ins-mg-you">${_escapeHtml(you)}</span>
          <span class="ins-mg-vs">vs</span>
          <span class="ins-mg-opp">${_escapeHtml(opp)}</span>
        </div>
        <div class="ins-mg-side">${sideLabel}${dateStr ? ` &middot; ${dateStr}` : ''}</div>
        <div class="ins-mg-stats">
          ${blunders > 0 ? `<span class="ins-mg-stat ins-mg-blunder"><strong>${blunders}</strong> ${blunders === 1 ? 'blunder' : 'blunders'}</span>` : ''}
          ${mistakes > 0 ? `<span class="ins-mg-stat ins-mg-mistake"><strong>${mistakes}</strong> ${mistakes === 1 ? 'mistake' : 'mistakes'}</span>` : ''}
        </div>
        <div class="ins-mg-foot">
          <span class="ins-mg-cta">Review this game &rarr;</span>
        </div>
      </div>
    `;
  }).join('');

  const gameWord = sorted.length === 1 ? 'game' : 'games';
  const intro = `
    <div class="ins-section-head">
      <div class="ins-section-kicker">Critical Moments</div>
      <h2 class="ins-section-title">The games that turned on a single move</h2>
      <p class="ins-section-sub">
        <strong>${sorted.length}</strong> ${gameWord} with room to grow &middot;
        <strong>${totalBlunders}</strong> blunder${totalBlunders === 1 ? '' : 's'} &middot;
        <strong>${totalMistakes}</strong> mistake${totalMistakes === 1 ? '' : 's'} flagged.
      </p>
    </div>`;

  el.innerHTML = intro + `<div class="ins-mg-list">${cards}</div>`;
}

// ── Game Insights: Openings panel ──
function giRenderOpeningsPanel() {
  const el = document.getElementById('insOpeningsContent');
  if (!el) return;
  const hist = _gi.history || [];

  if (!hist.length) {
    el.innerHTML = `
      <section class="ins-empty">
        <div class="ins-empty-kicker">Openings</div>
        <h3 class="ins-empty-title">No games yet</h3>
        <p class="ins-empty-text">Analyze a game from your profile to start tracking how your openings perform.</p>
      </section>`;
    return;
  }

  // Aggregate by opening signature (parsed from PGN)
  const byOpening = {};
  for (const e of hist) {
    const sig = _giOpeningSignature(e.pgn);
    if (!sig) continue;
    const key = sig.name;
    if (!byOpening[key]) byOpening[key] = { name: sig.name, moves: sig.moves, games: 0, wins: 0, losses: 0, draws: 0, asWhite: 0, asBlack: 0, ids: [] };
    const rec = byOpening[key];
    rec.games++;
    rec.ids.push(e.id);
    if (e.playerColor === 'w') rec.asWhite++; else rec.asBlack++;
    const pc = e.playerColor || 'w';
    if (e.result === '1-0') { if (pc === 'w') rec.wins++; else rec.losses++; }
    else if (e.result === '0-1') { if (pc === 'b') rec.wins++; else rec.losses++; }
    else if (e.result === '1/2-1/2') rec.draws++;
  }

  const list = Object.values(byOpening).sort((a, b) => b.games - a.games);

  if (!list.length) {
    el.innerHTML = `
      <section class="ins-empty">
        <div class="ins-empty-kicker">Openings</div>
        <h3 class="ins-empty-title">Openings could not be identified</h3>
        <p class="ins-empty-text">Your saved games don't have opening tags we can aggregate. Try importing from Lichess or Chess.com.</p>
      </section>`;
    return;
  }

  const totalGames = list.reduce((s, o) => s + o.games, 0);
  const totalWins  = list.reduce((s, o) => s + o.wins, 0);
  const overallWR  = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

  const cards = list.map(o => {
    const winRate = o.games > 0 ? Math.round((o.wins / o.games) * 100) : 0;
    const winPct  = o.games > 0 ? (o.wins  / o.games) * 100 : 0;
    const drawPct = o.games > 0 ? (o.draws / o.games) * 100 : 0;
    const lossPct = o.games > 0 ? (o.losses/ o.games) * 100 : 0;
    const colorSide = o.asWhite >= o.asBlack ? 'Mostly White' : 'Mostly Black';
    const wrClass = winRate >= 60 ? 'hot' : (winRate <= 35 ? 'cold' : '');
    return `
      <div class="ins-og-card">
        <div class="ins-og-top">
          <div class="ins-og-titlebox">
            <div class="ins-og-kicker">Opening</div>
            <h3 class="ins-og-name">${_escapeHtml(o.name)}</h3>
            ${o.moves ? `<div class="ins-og-moves">${_escapeHtml(o.moves)}</div>` : ''}
          </div>
          <div class="ins-og-winratebox ${wrClass}">
            <div class="ins-og-winrate">${winRate}<span class="ins-og-pct">%</span></div>
            <div class="ins-og-winrate-label">Win rate</div>
          </div>
        </div>
        <div class="ins-og-bar" aria-hidden="true">
          <div class="ins-og-bar-seg ins-og-bar-win"  style="width:${winPct}%"></div>
          <div class="ins-og-bar-seg ins-og-bar-draw" style="width:${drawPct}%"></div>
          <div class="ins-og-bar-seg ins-og-bar-loss" style="width:${lossPct}%"></div>
        </div>
        <div class="ins-og-foot">
          <span class="ins-og-count">${o.games} game${o.games === 1 ? '' : 's'}</span>
          <span class="ins-og-wl"><strong>${o.wins}</strong>W &middot; <strong>${o.draws}</strong>D &middot; <strong>${o.losses}</strong>L</span>
          <span class="ins-og-side">${colorSide}</span>
        </div>
      </div>
    `;
  }).join('');

  const intro = `
    <div class="ins-section-head">
      <div class="ins-section-kicker">Openings</div>
      <h2 class="ins-section-title">How your repertoire is actually performing</h2>
      <p class="ins-section-sub">
        <strong>${list.length}</strong> opening${list.length === 1 ? '' : 's'} across
        <strong>${totalGames}</strong> game${totalGames === 1 ? '' : 's'} &middot;
        <strong>${overallWR}%</strong> overall win rate.
      </p>
    </div>`;

  el.innerHTML = intro + `<div class="ins-og-list">${cards}</div>`;
}

function _giOpeningSignature(pgn) {
  if (!pgn) return null;
  // Prefer the PGN Opening header when present
  const openingTag = /\[Opening\s+"([^"]+)"\]/i.exec(pgn);
  const ecoTag     = /\[ECO\s+"([^"]+)"\]/i.exec(pgn);
  let movePreview = '';
  try {
    const g = new Chess();
    if (g.load_pgn(pgn) || g.load_pgn(pgn, { sloppy: true })) {
      const moves = g.history().slice(0, 6);
      if (moves.length) {
        const parts = [];
        for (let i = 0; i < moves.length; i += 2) {
          const mn = (i / 2) + 1;
          parts.push(`${mn}.${moves[i]}${moves[i + 1] ? ' ' + moves[i + 1] : ''}`);
        }
        movePreview = parts.join(' ');
      }
    }
  } catch {}
  if (openingTag) {
    return { name: openingTag[1] + (ecoTag ? ` (${ecoTag[1]})` : ''), moves: movePreview };
  }
  if (movePreview) {
    return { name: movePreview, moves: '' };
  }
  return null;
}

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
    content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(_coachCache.html, _coachTasks) + '</div>';
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

    // Build the content as a scroll-driven story page
    content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(rendered, tasks) + '</div>';
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

