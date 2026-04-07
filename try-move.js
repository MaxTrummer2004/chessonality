// ==============================================================
//  LIVE BOARD - always interactive
//  The user can always make moves on the board.
//  Moves are tracked in a variation line.
//  Analysis is triggered by button click, never automatic.
// ==============================================================
'use strict';

const liveBoard = {
  selected:   null,    // selected square name, e.g. 'e2'
  legalDests: [],      // array of square names the selected piece can go to
  userMoves:  [],      // array of { from, to, san, fenBefore, fenAfter }
  currentFen: null,    // current board FEN (null = use game position)
};

// For backwards compat
const tryMove = { enabled: false, result: null };

// ── Get the FEN currently displayed ──
function liveBoardFen() {
  if (liveBoard.userMoves.length > 0) {
    return liveBoard.userMoves[liveBoard.userMoves.length - 1].fenAfter;
  }
  return positions[currentPly]?.fen || null;
}

// ── Reset user line (called on ply navigation) ──
function liveBoardReset() {
  liveBoard.selected = null;
  liveBoard.legalDests = [];
  liveBoard.userMoves = [];
  liveBoard.currentFen = null;
  _updateLiveBoardUI();
}

// ── Undo last user move ──
function liveBoardUndo() {
  if (!liveBoard.userMoves.length) return;
  liveBoard.userMoves.pop();
  liveBoard.selected = null;
  liveBoard.legalDests = [];
  _updateLiveBoardUI();
  renderBoard();
}

// ── Undo ALL user moves ──
function liveBoardUndoAll() {
  if (!liveBoard.userMoves.length) return;
  liveBoard.userMoves = [];
  liveBoard.selected = null;
  liveBoard.legalDests = [];
  _updateLiveBoardUI();
  renderBoard();
}

// ── Update the undo button visibility ──
function _updateLiveBoardUI() {
  const undoBtn = document.getElementById('liveBoardUndoBtn');
  const undoAllBtn = document.getElementById('liveBoardUndoAllBtn');
  const badge = document.getElementById('liveBoardMoveBadge');
  const n = liveBoard.userMoves.length;
  if (undoBtn) undoBtn.style.display = n > 0 ? '' : 'none';
  if (undoAllBtn) undoAllBtn.style.display = n > 1 ? '' : 'none';
  if (badge) {
    badge.style.display = n > 0 ? '' : 'none';
    badge.textContent = n === 1 ? '1 move ahead' : n + ' moves ahead';
  }
}

// ── Square click handler ──
function handleBoardClick(squareName) {
  const fen = liveBoardFen();
  if (!fen) return;
  const g = new Chess(fen);
  const toMove = g.turn(); // 'w' or 'b'

  if (liveBoard.selected) {
    // Second click - check if legal destination
    if (liveBoard.legalDests.includes(squareName)) {
      _executeLiveMove(liveBoard.selected, squareName, fen, g);
      return;
    }
    // Clicked a different own piece - reselect
    const piece = g.get(squareName);
    if (piece && piece.color === toMove) {
      _selectLivePiece(squareName, g);
      renderBoard();
      return;
    }
    // Deselect
    liveBoard.selected = null;
    liveBoard.legalDests = [];
    renderBoard();
    return;
  }

  // First click - select a piece (any side)
  const piece = g.get(squareName);
  if (!piece || piece.color !== toMove) return;
  _selectLivePiece(squareName, g);
  renderBoard();
}

function _selectLivePiece(sq, g) {
  liveBoard.selected = sq;
  const moves = g.moves({ square: sq, verbose: true });
  liveBoard.legalDests = moves.map(m => m.to);
}

function _executeLiveMove(from, to, fenBefore, gBefore) {
  const moveObj = gBefore.move({ from, to, promotion: 'q' });
  if (!moveObj) return;

  liveBoard.userMoves.push({
    from, to,
    san: moveObj.san,
    fenBefore,
    fenAfter: gBefore.fen()
  });

  liveBoard.selected = null;
  liveBoard.legalDests = [];
  _updateLiveBoardUI();
  renderBoard();
}

// ── Analyze current free-move position (triggered by button) ──
async function analyzeLiveBoardPosition() {
  const fen = liveBoardFen();
  if (!fen) return;

  const key = document.getElementById('apiKey')?.value?.trim() || '';
  if (!key) { setAicOutput('', true, 'API key missing. Open Settings.'); return; }

  // Mark as active (compat)
  if (typeof _activeAnalysisView !== 'undefined') _activeAnalysisView = 'position';

  // Hide button group, show loading in output
  const output = document.getElementById('aicOutput');
  const hint = document.getElementById('aicHint');
  const explainBtn = document.getElementById('explainBtn');
  const btnGroup = explainBtn ? explainBtn.closest('.aic-btn-group') : null;
  if (btnGroup) btnGroup.style.display = 'none';
  if (hint) hint.style.display = 'none';
  if (output) {
    output.style.display = '';
    output.innerHTML = '<div class="aic-loading"><span class="spinner"></span> Analyzing position\u2026</div>';
  }

  try {
    // Get engine eval
    const ev = await analyseAsync(fen);

    // Fetch top moves
    let topMovesStr = '';
    try {
      const topMoves = await fetchTopMoves(fen, 3);
      topMovesStr = annotateTopMoves(fen, topMoves);
    } catch (e) { console.warn('[LiveBoard] topMoves fetch failed:', e.message); }
    if (!topMovesStr && ev && ev.bestSAN) {
      topMovesStr = annotateTopMoves(fen, [{
        rank: 1, moveSAN: ev.bestSAN, lineSAN: ev.bestSAN,
        moveUCI: ev.bestUCI, cp: ev.cp, mate: ev.mate
      }]);
    }

    // Build position explanation using the position template
    const g = new Chess(fen);
    const snap = {
      fen,
      turn: g.turn(),
      eval: fmtEval(ev),
      evalCtx: evalContext(ev, playerColor),
      threats: threatsSummary(fen),
      topMoves: topMovesStr || '',
      material: materialStr(fen),
      color: playerColor,
      thoughts: []
    };

    const prompt = TEMPLATES.position(snap);
    const reply = await callClaude(prompt, key);

    // Render as a single Overview slide (same visual style as walkthrough)
    const bodyHtml = marked.parse(reply).replace(/\s*[-–]\s*/g, ', ')
      .replace(/<h[1-4][^>]*>.*?<\/h[1-4]>/gi, '');
    const rich = `<div class="aic-slide-deck" data-slide="0">
      <div class="aic-slide active" data-idx="0">
        <div class="aic-slide-header slide-overview">
          <span class="aic-slide-icon">\u2654</span>
          <span class="aic-slide-label">Position</span>
        </div>
        <div class="aic-slide-body"><div class="aic-slide-text">${bodyHtml}</div></div>
      </div>
    </div>`;
    if (output) output.innerHTML = rich;
  } catch (err) {
    if (output) output.innerHTML = `<div class="aic-error">Error: ${err.message}</div>`;
  }
}
