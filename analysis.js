// ==============================================================
//  LOAD GAME
// ==============================================================
function loadGame() {
  resetExplainCache(); // clear per-game explain limits
  invalidateCoachPlan(); // new game → allow re-generating AI coach plan
  const pgn = document.getElementById('pgnInput').value.trim();
  const errEl = document.getElementById('landingError');

  if (!pgn) {
    if (errEl) { errEl.textContent = 'Please paste a PGN first.'; errEl.style.display = ''; }
    return;
  }

  const g = new Chess();
  if (!g.load_pgn(pgn) && !g.load_pgn(pgn, { sloppy: true })) {
    if (errEl) { errEl.textContent = 'Could not parse PGN. Please check the format.'; errEl.style.display = ''; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const history = g.history({ verbose: true });
  positions = [];
  evals     = [];
  bookMoves = [];

  const start = new Chess();
  positions.push({ fen: start.fen(), san: '', from: '', to: '', turn: 'w' });
  evals.push(null);

  const replay = new Chess();
  for (const mv of history) {
    replay.move(mv.san);
    positions.push({ fen: replay.fen(), san: mv.san, from: mv.from, to: mv.to, turn: replay.turn() });
    evals.push(null);
  }

  currentPly = 0;

  // Reset loading screen
  document.getElementById('loadingTitle').textContent  = 'Analyzing your game\u2026';
  loadingProgress(0);
  loadingStep('lstepEngine', 'pending');
  loadingStep('lstepEval',   'pending');
  loadingStep('lstepBook',   'pending');
  loadingStep('lstepDone',   'pending');

  if (typeof incrementSignupCounter === 'function') incrementSignupCounter();
  showPage('loading');
  runAnalysis();
}

// ==============================================================
//  ANALYSIS LOOP
// ==============================================================
async function runAnalysis() {
  if (analysisActive) return;
  analysisActive = true;

  try {
  // ── Step 1: Engine load ──
  loadingStep('lstepEngine', 'active');
  loadingProgress(2);
  if (typeof waitForEngine === 'function') await waitForEngine();
  loadingStep('lstepEngine', 'done');

  // ── Step 2: Position evaluation ──
  loadingStep('lstepEval', 'active');
  let uncached = 0, sfFallback = 0;
  const total = positions.length;

  for (let i = 0; i < total; i++) {
    const pct = 5 + Math.round((i / total) * 55);
    loadingProgress(pct);
    loadingStepDetail(`Analyzing position ${i + 1} / ${total}\u2026`);

    const result = await analyseAsync(positions[i].fen);
    evals[i] = result;
    if (!result.cached) uncached++;
    if (result.source === 'stockfish-fallback') sfFallback++;
  }
  loadingStep('lstepEval', 'done');

  // ── Step 3: Opening book ──
  loadingStep('lstepBook', 'active');
  bookMoves = await findBookDepth(positions, (i, len) => {
    const pct = 60 + Math.round((i / len) * 25);
    loadingProgress(pct);
    loadingStepDetail(`Move ${i} / ${len}\u2026`);
  });

  // If a book move is a mistake or blunder (>= 100 cp lost), cut the book
  // phase there - those are yellow/red moves that shouldn't count as theory.
  for (let i = 1; i < bookMoves.length; i++) {
    if (bookMoves[i] && evals[i] && evals[i - 1] && cpLoss(i) >= 100) {
      for (let j = i; j < bookMoves.length; j++) bookMoves[j] = false;
      break;
    }
  }

  loadingStep('lstepBook', 'done');

  // ── Step 4: Highlights ──
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  loadingStep('lstepDone', 'active');
  loadingProgress(88);
  loadingStepDetail('Generating game highlights\u2026');
  const highlights = await generateHighlights();
  loadingStep('lstepDone', 'done');
  loadingProgress(100);
  loadingStepDetail('Done!');

  await new Promise(r => setTimeout(r, 500));

  // ── Compute personality ──
  const gameStats = computeGameStats();
  const gameScores = scorePersonalitiesFromGame(gameStats);
  const quizScores = scorePersonalitiesFromQuestionnaire(quizAnswers);
  currentPersonality = determinePersonality(gameScores, quizScores);

  await saveAnalysisToHistory();       // save game to IndexedDB
  await savePersonalityToHistory(currentPersonality); // attach personality

  // ── Render analysis in background ──
  renderBoard();
  renderMoveList();
  setNote('Analysis ready. Navigate to any move and ask Claude.', true);
  const _ba = document.getElementById('badgeArea'); if (_ba) _ba.innerHTML = '';

  const stat = document.getElementById('analysisStatus');
  let note;
  if (uncached > 0)        note = `\u26A0\uFE0F ${uncached} position(s) unavailable`;
  else                     note = '';
  if (stat) stat.textContent = note;

  // ── Show highlights page (or skip to personality reveal) ──
  analysisActive = false;
  if (highlights) {
    showHighlightsPage(highlights);
  } else {
    showPersonalityReveal();
  }

  } catch (err) {
    analysisActive = false;
    if (typeof showAnalysisError === 'function') {
      showAnalysisError(err?.message || 'Unknown error during analysis.');
    } else {
      alert('Analysis failed: ' + (err?.message || 'Unknown error'));
    }
  }
}

// ==============================================================
//  GAME HIGHLIGHTS - shown as overlay after analysis
// ==============================================================
async function generateHighlights() {
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) return null;

  const turns = [];
  for (let i = 1; i < positions.length; i++) {
    const cls = classifyMove(i);
    if (cls === 'mistake' || cls === 'blunder' || cls === 'good' || cls === 'brilliant') {
      const mv   = Math.ceil(i / 2);
      const side = positions[i].turn === 'b' ? 'White' : 'Black';
      turns.push(`Move ${mv} (${side}: ${positions[i].san}): ${labelFor(cls)}, ~${cpLoss(i)}cp`);
    }
  }

  let bookEnd = 0;
  for (let i = bookMoves.length - 1; i >= 0; i--) { if (bookMoves[i]) { bookEnd = i; break; } }

  const lastG = new Chess(positions[positions.length - 1].fen);
  let result = 'Game ended';
  if (lastG.in_checkmate())      result = lastG.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  else if (lastG.in_stalemate()) result = 'Draw by stalemate';
  else if (lastG.in_draw())      result = 'Draw';

  let moves = positions.slice(1).map((p, i) =>
    (i % 2 === 0 ? (Math.floor(i / 2) + 1) + '.' : '') + p.san
  ).join(' ');
  if (moves.length > 500) moves = moves.slice(0, 500) + '...';

  const prompt = TEMPLATES.highlights({
    color: playerColor, moves, result,
    bookEnd, totalPly: positions.length - 1,
    turns: turns.length ? turns.slice(0, 10).join('\n') : null
  });

  try {
    const raw = await callClaude(prompt, key);
    // extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return null;
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr) && arr.length >= 3) return arr.slice(0, 3);
    return null;
  } catch { return null; }
}

function showHighlightsPage(items) {
  const container = document.getElementById('hlItems');
  container.innerHTML = '';
  for (const h of items) {
    const el = document.createElement('div');
    el.className = 'hl-item';
    el.innerHTML = `
      <div class="hl-icon">${h.icon || '\u2728'}</div>
      <div class="hl-item-text">
        <div class="hl-title">${h.title || ''}</div>
        <div class="hl-sub">${h.sub || ''}</div>
      </div>
    `;
    container.appendChild(el);
  }
  showPage('highlights');
}

function showPersonalityReveal() {
  if (!currentPersonality) { goToAnalysis(); return; }
  const p = currentPersonality.primary;

  const reveal = document.getElementById('persReveal');
  reveal.style.background = p.gradient;
  reveal.setAttribute('data-pers', p.id);
  const content = document.getElementById('persContent');
  if (content) content.setAttribute('data-pers', p.id);
  document.getElementById('persEmoji').textContent = p.emoji;
  document.getElementById('persName').textContent = p.name;
  document.getElementById('persTagline').textContent = p.tagline;
  document.getElementById('persDescription').textContent = p.description;

  const traitsEl = document.getElementById('persTraits');
  traitsEl.innerHTML = p.traits.map(t => `<span class="pers-trait">${t}</span>`).join('');

  document.getElementById('persFamous').textContent = 'Think: ' + p.famous;

  showPage('personality');
}


function goToAnalysis() {
  showAnalysisPersonality();
  showGameStats();
  showPage('main');
  // Auto-update the move explanation badge when navigating
  if (currentPly > 0 && evals[currentPly] && evals[currentPly - 1]) {
    const cls = classifyMove(currentPly) || 'neutral';
    setBadge(cls, positions[currentPly].san + ': ' + labelFor(cls));
  }
  checkAnalysisTour();
}

// drawEvalGraph removed - replaced by inline coach panels

function showAnalysisPersonality() {
  const card = document.getElementById('analysisPersonalityCard');
  if (!card || !currentPersonality) return;
  const p = currentPersonality.primary;
  card.setAttribute('data-pers', p.id);
  document.getElementById('apcEmoji').textContent = p.emoji;
  document.getElementById('apcName').textContent = p.name;
  document.getElementById('apcName').style.color = p.color;
  document.getElementById('apcTraits').innerHTML = p.traits.map(t =>
    `<span class="apc-trait" style="border-color:${p.color};color:${p.color}">${t}</span>`
  ).join('');
  card.style.display = '';
  card.style.borderColor = p.color + '44';
  // Use hex-with-alpha for both stops to avoid black interpolation artifact
  card.style.background = `linear-gradient(135deg, ${p.colorDark}18 0%, ${p.colorDark}00 60%)`;

  // Apply personality color as CSS custom properties for the whole analysis page + root (for lasers)
  const pageMain = document.getElementById('pageMain');
  const lighten = (hex, pct) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const lr = Math.min(255, Math.round(r + (255-r)*pct));
    const lg = Math.min(255, Math.round(g + (255-g)*pct));
    const lb = Math.min(255, Math.round(b + (255-b)*pct));
    return `#${lr.toString(16).padStart(2,'0')}${lg.toString(16).padStart(2,'0')}${lb.toString(16).padStart(2,'0')}`;
  };
  if (pageMain) {
    pageMain.style.setProperty('--pers-color', p.color);
    pageMain.style.setProperty('--pers-color-2', lighten(p.color, 0.3));
  }
  // Set on :root so background lasers use the personality color globally
  document.documentElement.style.setProperty('--pers-color', p.color);
  document.documentElement.style.setProperty('--pers-color-2', lighten(p.color, 0.3));
}

function showGameStats() {
  const el = document.getElementById('gameStats');
  if (!el) return;

  // Count player mistakes/blunders/brilliant
  let mistakes = 0, blunders = 0, good = 0, brilliant = 0;
  for (let i = 1; i < positions.length; i++) {
    const mover = positions[i].turn === 'b' ? 'w' : 'b';
    if (mover !== playerColor) continue;
    const cls = classifyMove(i);
    if (cls === 'mistake') mistakes++;
    else if (cls === 'blunder' || cls === 'book-blunder') blunders++;
    else if (cls === 'brilliant') { brilliant++; good++; }
    else if (cls === 'good' || cls === 'book') good++;
  }
  const totalPlayerMoves = Math.ceil((positions.length - 1) / 2);
  const accuracy = totalPlayerMoves > 0 ? Math.round((good / totalPlayerMoves) * 100) : 0;

  let bookEnd = 0;
  for (let i = bookMoves.length - 1; i >= 0; i--) { if (bookMoves[i]) { bookEnd = i; break; } }

  document.getElementById('gsAccVal').textContent = accuracy + '% accuracy';
  document.getElementById('gsMovesVal').textContent = totalPlayerMoves + ' moves';
  document.getElementById('gsBookVal').textContent = Math.ceil(bookEnd / 2) + ' book moves';

  // Color the accuracy pill
  const accPill = document.getElementById('gsAccuracy');
  if (accuracy >= 70)      accPill.classList.add('gs-good');
  else if (accuracy >= 40) accPill.classList.add('gs-okay');
  else                     accPill.classList.add('gs-bad');

  el.style.display = '';

}


