// ==============================================================
//  QUESTIONNAIRE FLOW
// ==============================================================
let quizAnswers = [];  // [{questionIdx, value: 1-10}]
let currentQuizQ = 0;

function startFlow() {
  // Paywall check - returns false and opens paywall if no analyses remaining
  if (typeof checkPaywall === 'function' && !checkPaywall()) return;

  const pgn   = document.getElementById('pgnInput').value.trim();
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

  // ── Parse game metadata for dynamic questionnaire ──
  const headers    = g.header() || {};
  const history    = g.history({ verbose: true });
  const totalMoves = Math.ceil(history.length / 2);

  // Determine opponent name
  const opponent = playerColor === 'w'
    ? (headers.Black  || 'your opponent')
    : (headers.White  || 'your opponent');

  // Parse PGN result header
  let result = '?';
  const r = headers.Result || '';
  if (r === '1-0') result = playerColor === 'w' ? 'win' : 'loss';
  else if (r === '0-1') result = playerColor === 'b' ? 'win' : 'loss';
  else if (r === '1/2-1/2') result = 'draw';

  // First 4 moves as a readable opening line
  const openingMoves = history.slice(0, 6).map((mv, i) =>
    (i % 2 === 0 ? (Math.floor(i / 2) + 1) + '. ' : '') + mv.san
  ).join(' ');

  // Generate game-specific questionnaire
  QUESTIONNAIRE = generateQuestionnaire({
    opponent,
    colorLabel: playerColor === 'w' ? 'White' : 'Black',
    result,
    totalMoves,
    openingLine: openingMoves || null
  });

  // Skip the 1-10 questionnaire entirely - fill neutral answers and run
  // analysis straight away. The questions added little signal but a lot of
  // friction before each game analysis.
  quizAnswers  = [];
  currentQuizQ = 0;
  for (let i = 0; i < QUESTIONNAIRE.length; i++) {
    quizAnswers.push({ questionIdx: i, value: 5 });
  }
  loadGame();
}

function showQuizQuestion(idx) {
  const q = QUESTIONNAIRE[idx];
  if (!idx && idx !== 0 || !q) return;
  currentQuizQ = idx;

  const counter = document.getElementById('quizCounter');
  const fill    = document.getElementById('quizProgressFill');
  const qEl     = document.getElementById('quizQuestion');
  const boxesEl = document.getElementById('quizBoxes');

  counter.textContent = `${idx + 1} / ${QUESTIONNAIRE.length}`;
  fill.style.width = ((idx + 1) / QUESTIONNAIRE.length * 100) + '%';
  qEl.textContent = q.question;

  qEl.style.opacity = '0';
  boxesEl.style.opacity = '0';

  // Render 10 clickable boxes
  boxesEl.innerHTML = '';
  for (let v = 1; v <= 10; v++) {
    const box = document.createElement('button');
    box.className = 'quiz-box';
    box.textContent = v;
    box.onclick = () => pickQuizAnswer(idx, v);
    boxesEl.appendChild(box);
  }

  // Fade in
  requestAnimationFrame(() => {
    qEl.style.opacity = '1';
    boxesEl.style.opacity = '1';
  });
}

function pickQuizAnswer(qIdx, value) {
  quizAnswers.push({ questionIdx: qIdx, value });

  // Highlight selected box briefly
  const boxes = document.getElementById('quizBoxes').querySelectorAll('.quiz-box');
  boxes[value - 1].classList.add('selected');

  setTimeout(() => {
    if (qIdx + 1 < QUESTIONNAIRE.length) {
      showQuizQuestion(qIdx + 1);
    } else {
      // Questionnaire done → start analysis
      loadGame();
    }
  }, 400);
}

// Skip questionnaire - fill neutral (5) for all unanswered questions and go straight to analysis
function skipQuestionnaire() {
  // Fill remaining questions with neutral value (5)
  for (let i = quizAnswers.length; i < QUESTIONNAIRE.length; i++) {
    quizAnswers.push({ questionIdx: i, value: 5 });
  }
  loadGame();
}

// Store current personality result for the reveal page
let currentPersonality = null;

// Step label/detail map
const STEP_INFO = {
  lstepEngine: { label: 'Loading chess engine',    detail: 'Stockfish WASM via Lichess cloud' },
  lstepEval:   { label: 'Engine analysis',         detail: 'Evaluating all positions\u2026'  },
  lstepBook:   { label: 'Checking opening theory', detail: 'Comparing moves against ChessDB'  },
  lstepDone:   { label: 'Building your game plan', detail: 'Generating personalised AI advice'}
};

// Loading screen helpers
function loadingStep(id, state) {
  if (state === 'active') {
    const info = STEP_INFO[id] || { label: 'Working\u2026', detail: '' };
    const cur  = document.getElementById('lstepCurrent');
    const lbl  = document.getElementById('lstepCurLabel');
    const det  = document.getElementById('lstepCurDetail');
    if (cur) { cur.style.opacity = '0'; }
    setTimeout(() => {
      if (lbl) lbl.textContent = info.label;
      if (det) det.textContent = info.detail;
      if (cur) { cur.style.opacity = '1'; }
    }, 180);
  }
}
function loadingProgress(pct) {
  const fill  = document.getElementById('loadingBarFill');
  const label = document.getElementById('loadingBarPct');
  if (fill)  fill.style.width  = Math.round(pct) + '%';
  if (label) label.textContent = Math.round(pct) + '%';
}

// Update the detail line of the current step (used during eval loop)
function loadingStepDetail(text) {
  const det = document.getElementById('lstepCurDetail');
  if (det) det.textContent = text;
}

