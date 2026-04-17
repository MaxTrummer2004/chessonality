// ==============================================================
//  ANALYSIS HISTORY  (IndexedDB via db.js)
// ==============================================================
const MAX_HISTORY = 50;

async function saveAnalysisToHistory() {
  try {
    const pgn = document.getElementById('pgnInput').value.trim();
    if (!pgn || positions.length < 3) return;

    const g = new Chess();
    g.load_pgn(pgn, { sloppy: true });
    const h = g.header() || {};

    let mistakes = 0, blunders = 0;
    for (let i = 1; i < positions.length; i++) {
      const mover = positions[i].turn === 'b' ? 'w' : 'b';
      if (mover !== playerColor) continue;
      const cls = classifyMove(i);
      if (cls === 'mistake') mistakes++;
      if (cls === 'blunder' || cls === 'book-blunder') blunders++;
    }

    let bookEnd = 0;
    for (let i = bookMoves.length - 1; i >= 0; i--) { if (bookMoves[i]) { bookEnd = i; break; } }

    const lastG = new Chess(positions[positions.length - 1].fen);
    let result = h.Result || '*';
    if (lastG.in_checkmate()) result = lastG.turn() === 'w' ? '0-1' : '1-0';
    else if (lastG.in_draw() || lastG.in_stalemate()) result = '1/2-1/2';

    const id = Date.now();
    const entry = {
      id, date: new Date().toISOString(),
      pgnHash: pgnHash(pgn), pgn, playerColor,
      white: h.White || 'White', black: h.Black || 'Black',
      result, totalMoves: Math.ceil((positions.length - 1) / 2),
      mistakes, blunders, bookDepth: Math.ceil(bookEnd / 2)
    };

    await dbSaveHistoryEntry(entry);

    // Save full analysis data so it can be restored without re-analysis
    await dbSaveGame(id, {
      positions, evals, bookMoves, playerColor, pgn,
      quizAnswers: quizAnswers,
      personality: currentPersonality ? {
        primary: currentPersonality.primary.id,
        secondary: currentPersonality.secondary.id,
        scores: currentPersonality.scores.map(s => ({ id: s.personality.id, score: s.score, pct: s.pct }))
      } : null
    });

    // Store the id so savePersonalityToHistory can find it
    window._lastSavedGameId = id;

    // Check for milestone celebrations
    try {
      const allHistory = await dbGetHistory();
      if (typeof checkMilestone === 'function') checkMilestone(allHistory.length);
    } catch {}
  } catch(err) { console.warn('saveAnalysisToHistory failed:', err); }
}

async function loadFromHistory(id) {
  const numId = typeof id === 'string' ? Number(id) : id;
  // Try to load full analysis from DB (skip re-analysis)
  const saved = await dbLoadGame(numId);
  if (saved && saved.positions && saved.evals) {
    // Restore state directly
    positions = saved.positions;
    evals     = saved.evals;
    bookMoves = saved.bookMoves || [];
    playerColor = saved.playerColor || 'w';
    currentPly = 0;

    setPlayerColor(playerColor);
    document.getElementById('pgnInput').value = saved.pgn || '';

    // Restore personality
    if (saved.personality) {
      const primary   = PERSONALITIES[saved.personality.primary];
      const secondary = PERSONALITIES[saved.personality.secondary];
      if (primary && secondary) {
        currentPersonality = {
          primary, secondary,
          scores: saved.personality.scores.map(s => ({
            personality: PERSONALITIES[s.id], score: s.score, pct: s.pct
          }))
        };
      }
    }

    // Restore AI caches (explain + breakdown + walkthrough)
    window._lastSavedGameId = numId;
    resetExplainCache();
    if (saved.explainCache) {
      Object.assign(_explainCache, saved.explainCache);
    }
    if (saved.breakdownHtml && saved.breakdownKey) {
      _breakdownCachedHtml = saved.breakdownHtml;
      _breakdownCacheKey   = saved.breakdownKey;
    } else {
      _breakdownCachedHtml = null;
      _breakdownCacheKey   = null;
    }
    // Restore raw reply cache (shared between analysis + walkthrough)
    if (typeof _rawReplyCache !== 'undefined') {
      Object.keys(_rawReplyCache).forEach(k => delete _rawReplyCache[k]);
      if (saved.rawReplyCache) Object.assign(_rawReplyCache, saved.rawReplyCache);
    }
    // Restore walkthrough step cache
    if (typeof _wtCache !== 'undefined') {
      Object.keys(_wtCache).forEach(k => delete _wtCache[k]);
      if (saved.wtCache) Object.assign(_wtCache, saved.wtCache);
    }

    // Render analysis page directly
    showAnalysisPersonality();
    renderBoard();
    renderMoveList();
    setNote('Analysis restored from saved data.', true);
    const _ba = document.getElementById('badgeArea'); if (_ba) _ba.innerHTML = '';
    showPage('main');
    return;
  }

  // Fallback: load PGN and re-analyse
  const hist = await dbGetHistory();
  const entry = hist.find(e => Number(e.id) === numId);
  if (!entry) return;

  document.getElementById('pgnInput').value = entry.pgn;
  setPlayerColor(entry.playerColor);
  closeProfile();
  loadGame();
}

async function deleteFromHistory(id, ev) {
  ev.stopPropagation();
  // IDs are stored as numbers; HTML onclick passes them as strings - coerce both ways
  const numId = typeof id === 'string' ? Number(id) : id;
  await dbDeleteHistoryEntry(numId);
  await renderProfileHistoryList();
}

// ==============================================================
//  PROFILE - full page
// ==============================================================
function getProfileName()       { return window._profileName || ''; }
function setProfileName(name)   { window._profileName = name; dbSetProfile('username', name).catch(()=>{}); updateProfileAvatar(); }

function updateProfileAvatar() {
  const name = getProfileName();
  const initial = name.trim() ? name.trim()[0].toUpperCase() : '?';
  document.querySelectorAll('.profile-avatar-letter').forEach(el => el.textContent = initial);
  document.querySelectorAll('.profile-name-display').forEach(el =>
    el.textContent = name.trim() || 'Set your name'
  );
}

function startEditName() {
  const name = getProfileName();
  const input = document.getElementById('profileNameInput');
  const row = document.getElementById('profNameRow');
  if (input) { input.value = name; input.style.display = ''; input.focus(); }
  if (row) row.style.display = 'none';
}

function finishEditName() {
  const input = document.getElementById('profileNameInput');
  const row = document.getElementById('profNameRow');
  if (input) { setProfileName(input.value.trim()); input.style.display = 'none'; }
  if (row) row.style.display = '';
  updateProfileAvatar();
}

// Kept for backwards compat (profile drawer removed, now full page)
function openProfile()  { showPage('profile'); renderFullProfile(); checkProfileTour(); }
function closeProfile() { showPage('profile'); renderFullProfile(); }

async function renderFullProfile() {
  updateProfileAvatar();

  let history = [];
  try { history = await dbGetHistory(); } catch {}

  // Games count (exclude repertoire-batch entries from the visible total)
  const visibleHistory = history.filter(e => e && e.source !== 'repertoire-batch');
  const countEl = document.getElementById('profGamesCount');
  if (countEl) countEl.textContent = visibleHistory.length + ' game' + (visibleHistory.length !== 1 ? 's' : '') + ' analyzed';

  // Aggregate personality
  const agg = await getAggregatePersonality();

  // Primary personality card
  const primaryInner = document.getElementById('profPrimaryInner');
  if (agg) {
    const p = agg.primary;
    const card = document.getElementById('profPrimary');
    card.style.setProperty('--card-pers-color', p.color);
    card.setAttribute('data-pers', p.id);
    document.getElementById('profPrimaryEmoji').textContent = p.emoji;
    document.getElementById('profPrimaryName').textContent = p.name;
    document.getElementById('profPrimaryTagline').textContent = p.tagline;
    // Set global personality color for lasers
    document.documentElement.style.setProperty('--pers-color', p.color);
  } else {
    const card = document.getElementById('profPrimary');
    card.style.removeProperty('--card-pers-color');
    card.removeAttribute('data-pers');
    document.getElementById('profPrimaryEmoji').textContent = '?';
    document.getElementById('profPrimaryName').textContent = 'Analyze games to discover';
    document.getElementById('profPrimaryTagline').textContent = 'your chess personality';
  }

  // Breakdown bars
  const bdEl = document.getElementById('profBreakdown');
  if (agg && agg.breakdown) {
    bdEl.innerHTML = agg.breakdown
      .filter(s => s.pct > 0)
      .map(s => {
        const p = s.personality;
        return `<div class="prof-bar-row">
  <div class="prof-bar-label">
    <span class="prof-bar-emoji">${p.emoji}</span>
    <span>${p.name}</span>
  </div>
  <div class="prof-bar-track">
    <div class="prof-bar-fill" style="width:${s.pct}%;background:${p.color}"></div>
  </div>
  <span class="prof-bar-pct">${s.pct}%</span>
</div>`;
      }).join('');
  } else {
    bdEl.innerHTML = '<div class="ph-empty">Play games to build your personality profile.</div>';
  }

  // History
  renderProfileHistoryList();

  // Insights CTA is part of the always-visible feature row; locked state
  // is handled by renderProfileFeatureRow via the prof-feat-locked class.
  const insightsCta = document.getElementById('profInsightsCta');
  if (insightsCta) insightsCta.style.display = '';

  // Engagement features (collection, streak, sparkline, coach preview)
  if (typeof renderEngagementFeatures === 'function') {
    renderEngagementFeatures(history, agg);
  }
}

function _resultLabel(result, playerColor) {
  if (result === '1-0') return playerColor === 'w' ? { icon: '\u2655', cls: 'win',  text: 'Win'  } : { icon: '\u265A', cls: 'loss', text: 'Loss' };
  if (result === '0-1') return playerColor === 'b' ? { icon: '\u2655', cls: 'win',  text: 'Win'  } : { icon: '\u265A', cls: 'loss', text: 'Loss' };
  if (result === '1/2-1/2') return { icon: '\u2654', cls: 'draw', text: 'Draw' };
  return { icon: '•',  cls: 'unknown', text: result || '?' };
}

function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function renderProfileHistoryList() {
  const container = document.getElementById('profHistory');
  if (!container) return;

  let history = [];
  try { history = await dbGetHistory(); } catch {}

  // Hide repertoire-batch entries from the manual games history view
  history = history.filter(e => e && e.source !== 'repertoire-batch');

  if (!history.length) {
    container.innerHTML = '<div class="ph-empty">No analyses yet.<br>Analyze a game and it will appear here.</div>';
    return;
  }

  container.innerHTML = history.map(e => {
    const opponent = e.playerColor === 'w' ? e.black : e.white;
    const colorIcon = e.playerColor === 'w' ? '♙' : '♟';
    const colorLabel = e.playerColor === 'w' ? 'White' : 'Black';
    const d = new Date(e.date);
    const dateStr = isNaN(d) ? '' : d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
    const rl = _resultLabel(e.result, e.playerColor);
    const persId = e.personality;
    const pers = persId && PERSONALITIES[persId] ? PERSONALITIES[persId] : null;
    const persTag = pers ? `<span class="ph-pers" style="color:${pers.color}">${pers.emoji} ${pers.name}</span>` : '';

    const quality = e.blunders === 0 && e.mistakes === 0
      ? '<span class="ph-clean">\u2713 Clean game</span>'
      : `<span class="ph-errors">${e.blunders ? e.blunders + ' blunder' + (e.blunders > 1 ? 's' : '') : ''}${e.blunders && e.mistakes ? ' \u00B7 ' : ''}${e.mistakes ? e.mistakes + ' mistake' + (e.mistakes > 1 ? 's' : '') : ''}</span>`;

    return `<div class="ph-card" onclick="loadFromHistory('${e.id}')">
  <div class="ph-card-top">
    <div class="ph-card-color">${colorIcon} ${colorLabel}</div>
    ${persTag}
    <span class="ph-result-badge ph-${rl.cls}">${rl.icon} ${rl.text}</span>
    <button class="ph-delete" onclick="deleteFromHistory('${e.id}', event)" title="Remove">\u2715</button>
  </div>
  <div class="ph-card-vs">vs. ${_escHtml(opponent)}</div>
  <div class="ph-card-meta">
    <span>${dateStr}</span>
    <span>\u00B7</span>
    <span>${e.totalMoves} moves</span>
    <span>\u00B7</span>
    ${quality}
  </div>
</div>`;
  }).join('');
}

// ==============================================================
//  ENGINE TOGGLE
// ==============================================================
function onEngineReady(status) {
  // Engine toggle removed from UI - always use default engine
  // Keep function signature so engine.js callbacks don't break
}

function switchEngine(mode) {
  // Engine switching disabled - default engine always used
}

function setActiveToggle(mode) {
  // Engine toggle buttons removed from UI
}

