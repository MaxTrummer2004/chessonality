// ==============================================================
//  BOARD
// ==============================================================
function renderBoard() {
  const el = document.getElementById('board');
  el.innerHTML = '';

  const pos = positions[currentPly];
  // If user has played moves on the live board, show that position
  const hasUserMoves = (typeof liveBoard !== 'undefined') && liveBoard.userMoves.length > 0;
  const displayFen = hasUserMoves ? liveBoardFen() : pos?.fen;
  if (!displayFen || !pos) return;

  const g    = new Chess(displayFen);
  const grid = g.board();

  // Best move: from the PREVIOUS position - what you should have played
  // Only show when viewing the game position (no user moves)
  const bestUCI  = (!hasUserMoves && currentPly > 0) ? (evals[currentPly - 1]?.bestUCI || null) : null;
  const bestFrom = bestUCI && bestUCI.length >= 4 ? bestUCI.slice(0, 2) : null;
  const bestTo   = bestUCI && bestUCI.length >= 4 ? bestUCI.slice(2, 4) : null;

  const isBook   = !hasUserMoves && bookMoves[currentPly];
  const moveCls  = !hasUserMoves && currentPly > 0 ? classifyMove(currentPly) : null;

  // Map each move classification to its own board highlight colour prefix
  const HL_PREFIX = {
    brilliant:       'brilliant',
    good:            'good',
    inaccuracy:      'inaccuracy',
    mistake:         'mistake',
    blunder:         'blunder',
    neutral:         'neutral',
    book:            'book',
    'book-inaccuracy': 'inaccuracy',
    'book-blunder':    'blunder',
  };
  const hlPrefix = moveCls ? (HL_PREFIX[moveCls] || 'last') : 'last';

  // Last user move highlights
  const lastUserMove = hasUserMoves ? liveBoard.userMoves[liveBoard.userMoves.length - 1] : null;

  // Flip board when playing black
  const flipped = playerColor === 'b';

  // Live board interactive state
  const lb = (typeof liveBoard !== 'undefined') ? liveBoard : null;

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      const name = String.fromCharCode(97 + c) + (8 - r);

      // ── Move highlights ──
      if (hasUserMoves && lastUserMove) {
        // Highlight last user move in purple
        if (lastUserMove.from === name) sq.classList.add('user-move-from');
        if (lastUserMove.to === name) sq.classList.add('user-move-to');
      } else if (currentPly > 0) {
        if (pos.from === name) sq.classList.add(hlPrefix + '-from');
        if (pos.to   === name) sq.classList.add(hlPrefix + '-to');
      }

      if (bestFrom && name === bestFrom) sq.classList.add('best-from');
      if (bestTo   && name === bestTo)   sq.classList.add('best-to');

      // ── Live board interactive highlights ──
      if (lb) {
        if (lb.selected === name) sq.classList.add('tm-selected');
        if (lb.legalDests.includes(name)) sq.classList.add('tm-legal-dest');
      }

      // Always make squares clickable for the live board
      sq.style.cursor = 'pointer';
      sq.addEventListener('click', () => {
        if (typeof handleBoardClick === 'function') handleBoardClick(name);
      });

      const cell = grid[r][c];
      if (cell) {
        const img = pieceImg(cell.color, cell.type);
        // Thin personality-colored outline on player's own pieces
        // (skipped on phones — iOS Safari renders the multi-drop-shadow
        //  filter as a silhouette only, hiding the white piece itself)
        if (cell.color === playerColor && currentPersonality && window.innerWidth > 860) {
          img.classList.add('pers-piece');
        }
        sq.appendChild(img);
      }

      // Book icon on destination square
      if (isBook && currentPly > 0 && pos.to === name) {
        const icon = mkEl('span', 'book-icon');
        icon.textContent = '\u{1F4D6}';
        sq.appendChild(icon);
      }

      // Legal destination dot overlay
      if (lb && lb.legalDests.includes(name)) {
        const dot = mkEl('span', 'tm-dot');
        if (cell) dot.classList.add('tm-dot-capture');
        sq.appendChild(dot);
      }

      // Coordinate labels - always in visual corners
      if (ci === 0) { const l = mkEl('span', 'coord-label coord-rank'); l.textContent = 8 - r; sq.appendChild(l); }
      if (ri === 7) { const l = mkEl('span', 'coord-label coord-file'); l.textContent = String.fromCharCode(97 + c); sq.appendChild(l); }

      el.appendChild(sq);
    }
  }

  // ── Eval bar ──
  refreshEvalBar();
  highlightMove();
  updateExplainButtons();
}

// ==============================================================
//  EVAL BAR
// ==============================================================
// Cache for live board eval results: fen → { cp }
const _liveBoardEvalCache = {};
let _liveBoardEvalPending = null;

function refreshEvalBar() {
  const bar = document.getElementById('evalBarBlack');
  const top = document.getElementById('evalTop');
  const bot = document.getElementById('evalBot');

  const hasFreeMoves = (typeof liveBoard !== 'undefined') && liveBoard.userMoves.length > 0;

  if (hasFreeMoves) {
    // Free moves: use cached live eval or fetch async
    const fen = liveBoardFen();
    if (_liveBoardEvalCache[fen]) {
      _applyEvalBar(_liveBoardEvalCache[fen], bar, top, bot);
    } else {
      // Show loading state while fetching
      bar.style.height = '50%';
      bot.textContent = '...';
      top.textContent = '';
      // Avoid duplicate requests for the same FEN
      if (_liveBoardEvalPending !== fen) {
        _liveBoardEvalPending = fen;
        analyseAsync(fen).then(ev => {
          _liveBoardEvalCache[fen] = ev;
          _liveBoardEvalPending = null;
          // Only apply if still showing this FEN
          const currentFen = liveBoardFen();
          if (currentFen === fen) _applyEvalBar(ev, bar, top, bot);
        }).catch(() => { _liveBoardEvalPending = null; });
      }
    }
    return;
  }

  // Normal game position
  const ev = evals[currentPly];
  if (!ev) { bar.style.height = '50%'; bot.textContent = '?'; top.textContent = ''; return; }
  _applyEvalBar(ev, bar, top, bot);
}

function _applyEvalBar(ev, bar, top, bot) {
  if (!ev || ev.cp === undefined) { bar.style.height = '50%'; bot.textContent = '?'; top.textContent = ''; return; }
  const cp = Math.max(-2500, Math.min(2500, ev.cp));
  const whitePct = 50 + 50 * (2 / (1 + Math.exp(-0.005 * cp)) - 1);
  bar.style.height = (100 - Math.max(2, Math.min(98, whitePct))) + '%';

  const label = (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
  if (cp >= 0) { bot.textContent = label; top.textContent = ''; }
  else         { top.textContent = label; bot.textContent = ''; }
}
