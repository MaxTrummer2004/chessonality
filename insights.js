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
let _activeInsTab = 'strengths';
function switchInsTab(tab) {
  if (tab === 'coach') { openCoachPage(); return; }
  _activeInsTab = tab;
  ['strengths','evolution'].forEach(t => {
    const panel = document.getElementById('insTabPanel' + t[0].toUpperCase() + t.slice(1));
    const btn   = document.getElementById('insTab'   + t[0].toUpperCase() + t.slice(1));
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
  if (tab === 'evolution') requestAnimationFrame(() => drawEvolutionLineChart(_insHistory));
  else if (tab === 'strengths') requestAnimationFrame(() => { drawRadarChart(_insHistory); renderStrengthBars(_insHistory); });
}

let _insHistory = [];

function openInsights() {
  showPage('insights');
  _activeInsTab = 'strengths';
  switchInsTab('strengths');
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
    if (content) content.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(_coachCache.html, _coachTasks) + '</div>';
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
  if (content) content.innerHTML = '<div class="coach-page-loading"><div class="coach-page-loading-spinner"></div><div class="coach-page-loading-text">Analyzing your chess DNA...</div></div>';
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
  _insHistory = history.filter(e => e.personality && PERSONALITIES[e.personality]).slice(0, 20);

  // Header subtitle: show top personality
  const agg = await getAggregatePersonality();
  const subEl = document.getElementById('insHeaderSub');
  if (subEl && agg) {
    const p = agg.primary;
    subEl.textContent = `Primarily ${p.emoji} ${p.name} across ${agg.totalGames} game${agg.totalGames !== 1 ? 's' : ''}`;
  }

  // Stat chips on evolution panel
  renderEvoStats(_insHistory, agg);

  // Draw the default tab (strengths = radar + bars)
  requestAnimationFrame(() => { drawRadarChart(_insHistory); renderStrengthBars(_insHistory); });

  // Auto-show cached coach plan (no button click needed)
  const coachBtn = document.getElementById('insCoachBtn');
  const coachContent = document.getElementById('insCoachContent');
  if (_coachCache.html) {
    _coachTasks = _coachCache.tasks || [];
    _cpoLastHtml = _coachCache.html;
    if (coachContent) coachContent.innerHTML = '<div class="ins-coach-result">' + _buildCoachResultHtml(_coachCache.html, _coachTasks) + '</div>';
    if (coachBtn) { coachBtn.innerHTML = '<span class="ins-coach-cta-icon">&#8635;</span> Generate New Plan'; coachBtn.disabled = false; coachBtn.onclick = function(){ resetCoachPlan(); }; }
  } else {
    if (coachBtn) { coachBtn.disabled = false; coachBtn.innerHTML = '<span class="ins-coach-cta-icon">&#9889;</span> Get Personalised Advice'; coachBtn.onclick = function(){ generateInsightsAdvice(); }; }
    if (coachContent) coachContent.innerHTML = '<div class="ins-coach-empty"><div class="ins-coach-empty-icon">&#127942;</div><div class="ins-coach-empty-text">Your personalised coaching plan is one click away.</div></div>';
  }
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

  el.innerHTML = avgs.map(({p, val}) => `
    <div class="ins-sbar-row">
      <div class="ins-sbar-top">
        <span class="ins-sbar-name">${p.emoji} ${p.name.replace('The ','')}</span>
        <span class="ins-sbar-pct">${val}%</span>
      </div>
      <div class="ins-sbar-track">
        <div class="ins-sbar-fill" style="width:${val}%;background:${p.color}"></div>
      </div>
    </div>
  `).join('');
}

// ── Line Chart: Personality Evolution (reference-style) ──
function drawEvolutionLineChart(withPers) {
  const canvas = document.getElementById('insLineChart');
  if (!canvas) return;

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

  if (withPers.length < 2) {
    ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(30,30,60,0.35)';
    ctx.font = '15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Analyze at least 2 games to see your evolution', W / 2, H / 2);
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

  // ── Background fill under main line ──
  ctx.beginPath();
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(toX(N - 1), toY(yMin));
  ctx.lineTo(toX(0), toY(yMin));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + plotH);
  grad.addColorStop(0, `rgba(${_hexToRgb(lineColor)},0.28)`);
  grad.addColorStop(0.6, `rgba(${_hexToRgb(lineColor)},0.10)`);
  grad.addColorStop(1, `rgba(${_hexToRgb(lineColor)},0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Grid lines ──
  const gridSteps = 5;
  for (let i = 0; i <= gridSteps; i++) {
    const val = yMin + (yRange / gridSteps) * i;
    const y   = toY(val);
    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(30,30,60,0.10)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    // Y label
    ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.30)' : 'rgba(30,30,60,0.45)';
    ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(val) + '%', PAD_L - 10, y);
  }

  // Vertical grid lines
  items.forEach((_, i) => {
    const x = toX(i);
    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(30,30,60,0.07)';
    ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + plotH); ctx.stroke();
  });

  // ── X labels ──
  ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(30,30,60,0.50)';
  ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  items.forEach((e, i) => {
    // Only show every nth label to avoid overlap
    if (N > 10 && i % 2 !== 0 && i !== N - 1) return;
    const d = new Date(e.date);
    const label = isNaN(d) ? `G${i + 1}` : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    ctx.fillText(label, toX(i), PAD_T + plotH + 10);
  });

  // ── Running average (dashed) ──
  ctx.strokeStyle = lineColor;
  ctx.globalAlpha = 0.45;
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

  // ── Main line ──
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Find peak and valley
  const peakIdx  = scores.indexOf(Math.max(...scores));
  const valleyIdx = scores.indexOf(Math.min(...scores));

  // ── Dots ──
  scores.forEach((v, i) => {
    const x = toX(i), y = toY(v);
    const isPeak   = i === peakIdx;
    const isValley = i === valleyIdx && scores[i] !== scores[peakIdx];
    const r = isPeak || isValley ? 8 : 5;
    const dotColor = isPeak ? '#f0c040' : (isValley && scores.length > 3 ? '#f87171' : lineColor);

    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = dotColor; ctx.fill();
    ctx.strokeStyle = isDarkMode ? '#13132a' : '#e8e8f4'; ctx.lineWidth = 2.5; ctx.stroke();
  });

  // Update chart header badges
  const badgesEl = document.getElementById('insChartBadges');
  if (badgesEl && primaryId && PERSONALITIES[primaryId]) {
    const p = PERSONALITIES[primaryId];
    const avg = Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
    badgesEl.innerHTML = `
      <span class="ins-badge-pill" style="background:rgba(${_hexToRgb(lineColor)},0.18);color:${lineColor};">${p.emoji} ${p.name.replace('The ','')}</span>
      <span class="ins-badge-pill ins-badge-avg">Avg ${avg}%</span>
    `;
  }
}

function _hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return '139,92,246';
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// ── Radar Chart: 8 Personality Strengths (Nen-style) ──
function drawRadarChart(withPers) {
  const canvas = document.getElementById('insRadarChart');
  if (!canvas) return;

  // Use full container width, up to 520px
  const container = canvas.parentElement;
  const rawSize   = Math.min((container?.clientWidth || 480), 520);
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
    // Outermost ring bolder; inner rings subtle - theme-aware
    ctx.strokeStyle = isRadarDark
      ? (ring === 5 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.12)')
      : (ring === 5 ? 'rgba(30,30,60,0.55)'    : 'rgba(30,30,60,0.12)');
    ctx.lineWidth   = ring === 5 ? 1.5 : 0.8;
    ctx.stroke();
  }

  // ── Axis lines ──
  for (let i = 0; i < N; i++) {
    const a = angle(i);
    ctx.beginPath();
    ctx.moveTo(CX, CY);
    ctx.lineTo(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
    ctx.strokeStyle = isRadarDark ? 'rgba(255,255,255,0.15)' : 'rgba(30,30,60,0.15)';
    ctx.lineWidth = 0.8; ctx.setLineDash([]);
    ctx.stroke();
  }

  // ── Data polygon (gradient fill using top personality color) ──
  const topId    = Object.entries(avg).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topColor = PERSONALITIES[topId]?.color || '#8b5cf6';
  const topRgb   = _hexToRgb(topColor);

  ctx.beginPath();
  PERSONALITY_LIST.forEach((p, i) => {
    const val = (avg[p.id] / maxVal) * 0.88;
    const r   = val * R, a = angle(i);
    const x   = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();

  const polyGrad = ctx.createRadialGradient(CX, CY, 0, CX, CY, R);
  polyGrad.addColorStop(0,   `rgba(${topRgb},0.50)`);
  polyGrad.addColorStop(0.6, `rgba(${topRgb},0.22)`);
  polyGrad.addColorStop(1,   `rgba(99,102,241,0.08)`);
  ctx.fillStyle = polyGrad;
  ctx.fill();
  ctx.strokeStyle = `rgba(${topRgb},0.9)`;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // ── Vertex dots + labels ──
  const emojiSize  = Math.round(size * 0.065); // ~32px at 480
  const nameSize   = Math.round(size * 0.026); // ~12px
  const labelDist  = R + LABEL_PAD * 0.58;

  PERSONALITY_LIST.forEach((p, i) => {
    const val = (avg[p.id] / maxVal) * 0.88;
    const r   = val * R, a = angle(i);
    const x   = CX + Math.cos(a) * r, y = CY + Math.sin(a) * r;

    // Vertex dot - white in dark mode, dark in light mode
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle   = isRadarDark ? 'rgba(255,255,255,0.80)' : 'rgba(30,30,60,0.65)';
    ctx.fill();
    ctx.strokeStyle = isRadarDark ? 'rgba(255,255,255,0.20)' : 'rgba(30,30,60,0.18)';
    ctx.lineWidth   = 1; ctx.stroke();

    // Outer label - emoji (full opacity)
    const lx = CX + Math.cos(a) * labelDist;
    const ly = CY + Math.sin(a) * labelDist;

    ctx.fillStyle = 'rgba(0,0,0,1)';  // reset so emoji renders at full colour
    ctx.font = `${emojiSize}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.emoji, lx, ly - nameSize * 0.9);

    // Name below emoji
    ctx.fillStyle = isRadarDark ? 'rgba(255,255,255,0.75)' : 'rgba(30,30,60,0.75)';
    ctx.font = `600 ${nameSize}px system-ui`;
    ctx.fillText(p.name.replace('The ', ''), lx, ly + emojiSize * 0.55);

    // (percentage labels intentionally hidden)
  });
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
function _loadCoachCacheFromStorage() {
  try {
    const raw = localStorage.getItem('ce-coach-cache');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { key: null, html: null, tasks: null };
}
function _saveCoachCacheToStorage() {
  try {
    localStorage.setItem('ce-coach-cache', JSON.stringify(_coachCache));
  } catch {}
}
function invalidateCoachPlan() {
  _coachCache = { key: null, html: null, tasks: null };
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
    ? '<div class="coach-page-loading"><div class="coach-page-loading-spinner"></div><div class="coach-page-loading-text">Analyzing your chess DNA...</div></div>'
    : '<div class="ins-coach-empty"><div class="ins-coach-empty-icon">&#128300;</div><div class="ins-coach-empty-text">Analyzing your chess DNA…</div></div>';

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

## Your Chess DNA
One punchy identity line, then name strongest/weakest trait. Max 2 sentences.

## Task 1: Solve Tactical Puzzles
TASK: [specific puzzle type like "defensive puzzles" or "mating in 3"] | [why this fits their weakness]
One sentence on what to focus on. No links needed.

## Task 2: Study a Key Concept
TASK: Study [very specific concept] | [why it addresses their gap]
Then on a new line write "SEARCH: [YouTube channel name] [specific topic]" (e.g. "SEARCH: Daniel Naroditsky rook endgames"). One sentence only.

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
    // Parse SEARCH: line for Task 2 (study) - build YouTube link
    const searchRx = /SEARCH:\s*(.+)/;
    const searchMatch = searchRx.exec(raw);
    if (searchMatch) {
      const studyTask = tasks.find(t => t.type === 'study');
      if (studyTask) {
        const q = searchMatch[1].trim();
        studyTask.studyLink = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
        studyTask.studyQuery = q;
      }
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
  if (content) content.innerHTML = '<div class="ins-coach-empty"><div class="ins-coach-empty-icon">&#128300;</div><div class="ins-coach-empty-text">Creating your new practice plan\u2026</div></div>';
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
        <p class="coach-story-hero-sub">A personalised roadmap to sharpen your chess, based on your unique playing style.</p>
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
        { text: "Now let's put this into action", sub: 'Four targeted tasks to level up your game.' },
        { text: 'Deepen your understanding', sub: 'Guided study to fill the gaps.' },
        { text: 'Apply it at the board', sub: 'Deliberate practice with focused intention.' },
        { text: 'Learn from the greatest', sub: 'Master games hand-picked for your development.' },
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
    extra += `<div class="coach-task-study">
      <a class="coach-task-study-link" href="${_escHtml(t.studyLink)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Watch on YouTube: ${_escHtml(t.studyQuery || 'Study video')}</a>
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
          // Task 2: show YouTube study link
          if (t.studyLink) {
            extra += `<div class="coach-task-study">
              <a class="coach-task-study-link" href="${_escHtml(t.studyLink)}" target="_blank" rel="noopener">&#9654; Watch on YouTube: ${_escHtml(t.studyQuery || 'Study video')}</a>
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

