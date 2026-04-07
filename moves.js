// ==============================================================
//  MOVE LIST
// ==============================================================
function renderMoveList() {
  const el = document.getElementById('moveList');
  el.innerHTML = '';

  for (let i = 1; i < positions.length; i++) {
    if (positions[i].turn !== 'b') continue;
    const row = mkEl('div', 'move-row');
    const num = mkEl('span', 'move-num');
    num.textContent = Math.ceil(i / 2) + '.';
    row.appendChild(num);
    row.appendChild(makeMoveCell(i));
    if (i + 1 < positions.length) row.appendChild(makeMoveCell(i + 1));
    el.appendChild(row);
    i++;
  }
}

function makeMoveCell(ply) {
  const cell = mkEl('span', 'move-cell');
  cell.dataset.ply = ply;
  cell.onclick = () => goTo(ply);

  const sanSpan = mkEl('span', 'move-san');
  sanSpan.textContent = positions[ply].san;
  cell.appendChild(sanSpan);

  const cls = classifyMove(ply);
  if (cls) cell.classList.add(cls);

  // Neutral: small brown dot annotation on the right
  if (cls === 'neutral') {
    const annot = mkEl('span', 'move-annot');
    annot.textContent = '\u00B7'; // ·
    cell.appendChild(annot);
  }

  // Brilliant: !! annotation is handled via CSS ::after, but we also add a shimmer effect
  if (cls === 'brilliant') {
    cell.classList.add('brilliant-shimmer');
  }

  return cell;
}

function highlightMove() {
  document.querySelectorAll('.move-cell').forEach(c =>
    c.classList.toggle('active', +c.dataset.ply === currentPly)
  );
}

// ==============================================================
//  MOVE CLASSIFICATION
// ==============================================================

// Material values for sacrifice detection (standard centipawn values)
const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Count total material for one side from a FEN
function _countMaterial(fen, color) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    let total = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (cell && cell.color === color) total += PIECE_VALUES[cell.type] || 0;
      }
    }
    return total;
  } catch { return 0; }
}

// Detect if a move is a sacrifice: the mover's material drops significantly
// relative to opponent's material change (i.e. they gave up more than they took)
function _isSacrifice(ply) {
  if (ply < 1 || !positions[ply] || !positions[ply - 1]) return false;
  const fenBefore = positions[ply - 1].fen;
  const fenAfter  = positions[ply].fen;
  const moverColor = positions[ply].turn === 'b' ? 'w' : 'b'; // who just moved
  const oppColor   = positions[ply].turn === 'b' ? 'b' : 'w';

  const moverBefore = _countMaterial(fenBefore, moverColor);
  const moverAfter  = _countMaterial(fenAfter, moverColor);
  const oppBefore   = _countMaterial(fenBefore, oppColor);
  const oppAfter    = _countMaterial(fenAfter, oppColor);

  const moverLost = moverBefore - moverAfter;   // what the mover gave up
  const oppLost   = oppBefore - oppAfter;        // what the opponent lost (captured by mover)

  // Net sacrifice: mover lost more material than they captured
  const netSacrifice = moverLost - oppLost;

  // Must be a real sacrifice: at least a minor piece worth of net material given up (250cp)
  // This catches piece sacrifices and exchange sacrifices (rook for minor ~170-180 net)
  return netSacrifice >= 150;
}

// Rough game phase: 'opening' (first 15 plies), 'endgame' (low material), else 'middlegame'
function _gamePhase(ply) {
  if (ply <= 15) return 'opening';
  const fen = positions[ply].fen;
  const totalMat = _countMaterial(fen, 'w') + _countMaterial(fen, 'b');
  // Endgame if total material (excluding kings) is roughly rook + minor or less per side
  if (totalMat <= 2600) return 'endgame';
  return 'middlegame';
}

// Check if a position is competitive (neither side is already winning big)
function _isCompetitive(ply) {
  if (!evals[ply - 1]) return false;
  const ev = evals[ply - 1];
  // If there's a forced mate, position is not competitive
  if (ev.mate !== null && ev.mate !== undefined) return false;
  // Position must be within ~300cp to count as competitive
  return Math.abs(ev.cp) <= 300;
}

// Detect brilliant move: sacrifice + competitive position + good move (low cp loss)
function isBrilliant(ply) {
  if (ply < 1) return false;
  if (!evals[ply] || !evals[ply - 1]) return false;

  const loss = cpLoss(ply);

  // Must be a good move (low cp loss - under 10cp, same as 'good')
  if (loss >= 10) return false;

  // Must be a sacrifice
  if (!_isSacrifice(ply)) return false;

  // Must be a competitive position
  if (!_isCompetitive(ply)) return false;

  // In endgame: must be the only good move (best move matches or loss is <10cp)
  // We approximate "only good move" by checking if loss is very small
  const phase = _gamePhase(ply);
  if (phase === 'endgame' && loss >= 10) return false;

  return true;
}

function classifyMove(ply) {
  if (ply < 1) return null;
  const isBook  = bookMoves[ply];
  const hasEval = evals[ply] && evals[ply - 1];

  if (isBook) {
    if (!hasEval) return 'book';
    const loss = cpLoss(ply);
    if (loss >= 200) return 'book-blunder';
    if (loss >= 100) return 'book-inaccuracy';
    return 'book';
  }

  if (!hasEval) return null;

  // Check brilliant BEFORE good (brilliant is a special case of good)
  if (isBrilliant(ply)) return 'brilliant';

  const loss = cpLoss(ply);
  if (loss <  10)  return 'good';       // essentially optimal (≤0.1 pawn)
  if (loss <  30)  return 'neutral';    // tiny imprecision (0.1–0.3 pawn)
  if (loss <  70)  return 'inaccuracy'; // 0.3–0.7 pawn lost
  if (loss < 150)  return 'mistake';    // 0.7–1.5 pawns lost

  // ≥ 150 cp lost: blunder, unless the side is still clearly winning/losing
  const beforeEval = evals[ply - 1].cp;
  const afterEval  = evals[ply].cp;
  const sameSign   = (beforeEval >= 0 && afterEval >= 0) || (beforeEval < 0 && afterEval < 0);
  if (sameSign && Math.abs(afterEval) >= 150) {
    return 'mistake'; // still winning/losing comfortably - downgrade to mistake
  }

  return 'blunder';
}

function cpLoss(ply) {
  if (ply < 1 || !evals[ply] || !evals[ply - 1]) return 0;

  // Guard: if the player played the engine's recommended best move,
  // cpLoss is 0 by definition. Any eval difference is just depth/source noise.
  // Check both SAN match and UCI match for robustness (SAN disambiguation can differ).
  const playedSan = positions[ply].san;
  const engineBestSan = evals[ply - 1].bestSAN;
  const engineBestUci = evals[ply - 1].bestUCI;
  const playedFrom = positions[ply].from;
  const playedTo   = positions[ply].to;
  if (engineBestSan && playedSan && engineBestSan === playedSan) return 0;
  if (engineBestUci && playedFrom && playedTo &&
      engineBestUci.slice(0,2) === playedFrom && engineBestUci.slice(2,4) === playedTo) return 0;

  const whiteJustMoved = positions[ply].turn === 'b';
  const before = evals[ply - 1].cp;
  const after  = evals[ply].cp;
  return Math.max(0, whiteJustMoved ? before - after : after - before);
}

function labelFor(cls) {
  return {
    brilliant:         'Brilliant',
    good:              'Good Move',
    neutral:           'Okay',
    mistake:           'Mistake',
    inaccuracy:        'Inaccuracy',
    blunder:           'Blunder',
    book:              'Book Move',
    'book-inaccuracy': 'Book Move \u26A0',
    'book-blunder':    'Book Move \u2715',
  }[cls] || 'Normal';
}

function fmtEval(ev) {
  if (!ev) return '?';
  if (ev.mate !== null && ev.mate !== undefined) {
    const n    = Math.abs(ev.mate);
    const side = ev.mate > 0 ? 'White' : 'Black';
    return `Forced mate in ${n} for ${side}`;
  }
  const cp = Math.max(-2500, Math.min(2500, ev.cp));
  return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(1);
}

// Returns a concise list of legal captures in this position, e.g. "Qd1 can capture Rd8"
// This lets Claude describe captures accurately instead of guessing from piece proximity.
function legalCapturesSummary(fen) {
  try {
    const g     = new Chess(fen);
    const moves = g.moves({ verbose: true }).filter(m => m.flags.includes('c') || m.flags.includes('e'));
    if (!moves.length) return 'No captures are legal in this position.';
    const pn = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
    const lines = moves.map(m => {
      const piece   = pn[m.piece]  || m.piece;
      const target  = pn[m.captured] || m.captured;
      const color   = m.color === 'w' ? 'White' : 'Black';
      const tcolor  = m.color === 'w' ? 'Black' : 'White';
      return `${color}'s ${piece} on ${m.from} can legally capture ${tcolor}'s ${target} on ${m.to}`;
    });
    return lines.join('\n');
  } catch { return ''; }
}

// Returns ONLY checkmate-in-one moves (game-ending moves).
// We intentionally do NOT list checks - they confuse the AI into recommending
// bad check moves over the engine's actual best move.
// Computed purely from chess.js - 100% accurate.
function threatsSummary(fen) {
  try {
    const g = new Chess(fen);
    const moves = g.moves({ verbose: true });
    const pn = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
    const mates = [];
    for (const m of moves) {
      const g2 = new Chess(fen);
      g2.move(m.san);
      if (g2.in_checkmate()) {
        const moverColor = m.color === 'w' ? 'White' : 'Black';
        const piece = pn[m.piece] || m.piece;
        mates.push(`${moverColor}'s ${piece} from ${m.from} to ${m.to} (${m.san}) - CHECKMATE, game over`);
      }
    }
    if (mates.length) {
      return 'CHECKMATE IN ONE MOVE available:\n' + mates.map(l => '  ' + l).join('\n');
    }
    return 'No checkmate in one move is available.';
  } catch { return ''; }
}

// Returns a plain-English danger summary for the position template
function evalContext(ev, playerColor) {
  if (!ev) return '';
  if (ev.mate !== null && ev.mate !== undefined) {
    const n    = Math.abs(ev.mate);
    const matingColor = ev.mate > 0 ? 'w' : 'b';
    if (matingColor === playerColor) {
      return `IMPORTANT: The engine sees a forced checkmate in ${n} move${n > 1 ? 's' : ''} for you. Emphasise this as the key fact.`;
    } else {
      return `IMPORTANT: The engine sees a forced checkmate in ${n} move${n > 1 ? 's' : ''} for your opponent. The king is NOT safe - warn the student clearly.`;
    }
  }
  const cp = ev.cp;
  if (Math.abs(cp) < 50)   return 'The position is roughly equal.';
  if (cp >  300) return 'White has a significant advantage.';
  if (cp < -300) return 'Black has a significant advantage.';
  return '';
}

// ==============================================================
