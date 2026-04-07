/* ============================================================
   engine.js - Dual-engine: Stockfish WASM + Lichess Cloud Eval
   ============================================================ */

'use strict';

const MODE = { STOCKFISH: 'stockfish', LICHESS: 'lichess' };
let activeMode     = MODE.LICHESS;
let sfWorker       = null;
let sfReady        = false;
let sfBusy         = false;
let sfResolve      = null;
let sfBestMove     = null;
let sfPvLine       = null;  // full PV line (space-separated UCI moves)
let sfEvalCp       = 0;
let sfEvalMate     = null;
let sfDepthReached = 0;
let sfInitPromise  = null;   // promise that resolves when initEngine() finishes

const SF_DEPTH   = 12;
const SF_TIMEOUT = 10000;   // 10 s hard cap per position
const LICHESS_URL = 'https://lichess.org/api/cloud-eval';

// Try these CDN sources in order
const SF_CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/stockfish.js@10.0.2/stockfish.js',
  'https://unpkg.com/stockfish.js@10.0.2/stockfish.js',
];


// ── Helpers ───────────────────────────────────────────────────

/*  UCI engines (Stockfish) report scores from the side-to-move perspective.
    Normalise to White's perspective so the eval bar is consistent.
    NOTE: Lichess cloud eval already returns from White's perspective -
    do NOT use this function on Lichess results.                          */
function normaliseCp(cp, fen) {
  const g = new Chess(fen);
  return g.turn() === 'b' ? -cp : cp;
}

/*  Lichess caches by the first 4 FEN fields only.
    Stripping the half-move clock and full-move number avoids cache misses. */
function fenFor4Fields(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

/*  Convert a UCI move string (e.g. "e2e4") to SAN via chess.js. */
function uciToSan(uci, fen) {
  if (!uci || uci.length < 4) return null;
  try {
    const g  = new Chess(fen);
    const mv = g.move({ from: uci.slice(0,2), to: uci.slice(2,4),
                        promotion: uci[4] || undefined });
    return mv ? mv.san : uci;
  } catch (_) { return uci; }
}


// ── Lichess rate limiter ──────────────────────────────────────
// Space Lichess requests ≥ 300 ms apart to avoid 429 / silent drops
let _lichessLastMs = 0;
async function lichessThrottle() {
  const wait = 300 - (Date.now() - _lichessLastMs);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lichessLastMs = Date.now();
}


// ── Stockfish initialisation ──────────────────────────────────

async function tryLoadStockfishFromUrl(cdnUrl) {
  console.log('[SF] Loading via importScripts:', cdnUrl);

  // Use importScripts so the worker resolves any relative asset paths
  // (e.g. .wasm files) against the CDN URL, not against a blob:// origin.
  // This is the key fix: fetching the code into a blob loses the base URL,
  // breaking WASM asset loading inside stockfish.js.
  const src     = `importScripts(${JSON.stringify(cdnUrl)});`;
  const blob    = new Blob([src], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  let w;
  try {
    w = new Worker(blobUrl);
  } finally {
    // Blob content is tiny and already copied into the Worker - safe to revoke now.
    URL.revokeObjectURL(blobUrl);
  }

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      w.terminate();
      reject(new Error('uciok timeout (20 s)'));
    }, 20000);
    w.onmessage = (e) => {
      if (String(e.data).includes('uciok')) { clearTimeout(t); resolve(); }
    };
    w.onerror = (e) => {
      clearTimeout(t);
      reject(new Error('Worker error: ' + (e.message || String(e))));
    };
    w.postMessage('uci');
  });

  // Just confirm the engine is responsive with isready/readyok.
  // Do NOT send setoption - this stockfish.js build has Hash locked at 16 MB
  // and silently hangs if given an out-of-range value.
  w.postMessage('isready');

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('readyok timeout (8 s)')), 8000);
    w.onmessage = (e) => {
      if (String(e.data).includes('readyok')) { clearTimeout(t); resolve(); }
    };
    w.onerror = (e) => { clearTimeout(t); reject(e); };
  });

  console.log('[SF] Engine ready ✓');
  return w;
}

async function tryLoadStockfish() {
  const errors = [];
  for (const url of SF_CDN_URLS) {
    try {
      return await tryLoadStockfishFromUrl(url);
    } catch (err) {
      console.warn('[SF] Failed from', url, '-', err.message);
      errors.push(err.message);
    }
  }
  throw new Error('All Stockfish CDN sources failed: ' + errors.join('; '));
}

async function initEngine() {
  window.engineStatus = { mode: MODE.LICHESS, ready: false, error: null };

  sfInitPromise = (async () => {
    try {
      sfWorker           = await tryLoadStockfish();
      sfWorker.onmessage = handleSfMessage;
      sfReady            = true;
      activeMode         = MODE.STOCKFISH;
      window.engineStatus = { mode: MODE.STOCKFISH, ready: true, error: null };
    } catch (err) {
      console.error('[SF] Could not load Stockfish:', err.message);
      activeMode = MODE.LICHESS;
      window.engineStatus = { mode: MODE.LICHESS, ready: true, error: err.message };
    }
    if (typeof onEngineReady === 'function') onEngineReady(window.engineStatus);
  })();

  return sfInitPromise;
}

/* Called by main.js so the analysis loop can await engine initialisation */
function waitForEngine() {
  return sfInitPromise || Promise.resolve();
}


// ── Stockfish UCI message handler ─────────────────────────────
// Some stockfish.js builds concatenate multiple UCI lines with \n in one postMessage.

function handleSfMessage(event) {
  const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
  for (const line of raw.split('\n')) {
    processSfLine(line.trim());
  }
}

function processSfLine(line) {
  if (!line) return;

  if (line.startsWith('info') && line.includes(' score ')) {
    if (line.includes(' score cp ')) {
      const m = line.match(/score cp (-?\d+)/);
      if (m) { sfEvalCp = parseInt(m[1], 10); sfEvalMate = null; }
    } else if (line.includes(' score mate ')) {
      const m = line.match(/score mate (-?\d+)/);
      if (m) { sfEvalMate = parseInt(m[1], 10); }
    }
    const dm = line.match(/\bdepth (\d+)/);
    if (dm) sfDepthReached = parseInt(dm[1], 10);
    // Capture full PV line (all UCI moves after "pv")
    const pvIdx = line.indexOf(' pv ');
    if (pvIdx !== -1) {
      sfPvLine = line.slice(pvIdx + 4).trim();
      const firstMove = sfPvLine.split(/\s+/)[0];
      if (firstMove) sfBestMove = firstMove;
    }
  }

  if (line.startsWith('bestmove')) {
    const parts = line.split(' ');
    if (parts[1] && parts[1] !== '(none)') sfBestMove = parts[1];
    sfBusy = false;
    if (sfResolve) { sfResolve(); sfResolve = null; }
  }
}


// ── Stockfish: analyse one position ──────────────────────────

async function stockfishAnalyse(fen) {
  if (!sfReady || sfBusy) return null;

  sfBusy         = true;
  sfBestMove     = null;
  sfPvLine       = null;
  sfEvalCp       = 0;
  sfEvalMate     = null;
  sfDepthReached = 0;

  sfWorker.postMessage('position fen ' + fen);
  sfWorker.postMessage('go depth ' + SF_DEPTH);

  // Hard timeout so a stalled worker never freezes the analysis loop
  const timeout = new Promise(resolve => setTimeout(() => {
    sfWorker.postMessage('stop');
    resolve();
  }, SF_TIMEOUT));

  await Promise.race([
    new Promise(resolve => { sfResolve = resolve; }),
    timeout
  ]);
  sfBusy = false;   // always reset - timeout branch never gets a bestmove message

  // Normalise: UCI score is side-to-move; convert to White's perspective
  let cp = sfEvalMate !== null
    ? (sfEvalMate > 0 ? 29000 : -29000)
    : sfEvalCp;
  cp = normaliseCp(cp, fen);

  // Normalise mate count to White's perspective (positive = White mates)
  let mateNorm = null;
  if (sfEvalMate !== null) {
    try { mateNorm = new Chess(fen).turn() === 'b' ? -sfEvalMate : sfEvalMate; } catch {}
  }

  // Convert full PV to SAN for continuation replay
  const pvUci = sfPvLine ? sfPvLine.split(/\s+/).slice(0, 8) : [];
  const pvSan = uciLineToSan(pvUci, fen);

  return {
    cp,
    mate:    mateNorm,
    bestSAN: uciToSan(sfBestMove, fen),
    bestUCI: sfBestMove,
    lineSAN: pvSan.join(' '),  // full PV in SAN
    depth:   sfDepthReached,
    cached:  true,
    source:  'stockfish'
  };
}


// ── Lichess Cloud Eval ────────────────────────────────────────

async function lichessAnalyse(fen) {
  await lichessThrottle();
  try {
    const shortFen = fenFor4Fields(fen);
    const url = `${LICHESS_URL}?fen=${encodeURIComponent(shortFen)}&multiPv=1`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });

    if (res.status === 404) {
      return { cp: 0, bestSAN: null, bestUCI: null, depth: 0, cached: false };
    }
    if (!res.ok) {
      console.warn('[Lichess] HTTP', res.status, '- FEN:', shortFen);
      return { cp: 0, bestSAN: null, bestUCI: null, depth: 0, cached: false };
    }

    const data = await res.json();
    const pv   = data.pvs?.[0];
    if (!pv) return { cp: 0, bestSAN: null, bestUCI: null, depth: 0, cached: false };

    // Lichess cloud eval already returns cp & mate from White's perspective
    // - do NOT apply normaliseCp (that's only for UCI/Stockfish).
    let cp = pv.cp   !== undefined ? pv.cp
           : pv.mate !== undefined ? (pv.mate > 0 ? 29000 : -29000)
           : 0;

    // Mate count is also already from White's perspective
    let mateNorm = pv.mate !== undefined ? pv.mate : null;

    const allUci = (pv.moves || '').trim().split(/\s+/).filter(Boolean);
    const uci = allUci[0] || null;
    // Convert full PV to SAN for continuation replay
    const pvSan = uciLineToSan(allUci.slice(0, 8), fen);

    return {
      cp,
      mate:    mateNorm,
      bestSAN: uciToSan(uci, fen),
      bestUCI: uci,
      lineSAN: pvSan.join(' '),  // full PV in SAN
      depth:   data.depth || 0,
      cached:  true,
      source:  'lichess'
    };
  } catch (err) {
    console.warn('[Lichess] Error:', err.message, '- FEN:', fenFor4Fields(fen));
    return { cp: 0, bestSAN: null, bestUCI: null, depth: 0, cached: false };
  }
}


// ── Public API (called by main.js) ───────────────────────────

/*
  Strategy (always cloud-first):
  1. Try Lichess cloud eval (depth 20-50, instant for cached positions).
  2. If Lichess doesn't have this position (cache miss / 404),
     fall back to local Stockfish WASM.
  3. If Stockfish is also unavailable, return the Lichess miss result.
*/
async function analyseAsync(fen) {
  // Always try Lichess cloud first - it's deeper and more reliable
  const lichess = await lichessAnalyse(fen);
  if (lichess.cached) return lichess;

  // Lichess cache miss - try local Stockfish
  if (sfInitPromise) await sfInitPromise;

  if (sfReady) {
    const sfResult = await stockfishAnalyse(fen);
    if (sfResult) {
      sfResult.source = 'stockfish-fallback';
      return sfResult;
    }
  }

  // No engine available at all - return the Lichess miss (cp:0)
  return lichess;
}

function setEngineMode(mode) {
  if (mode === MODE.STOCKFISH && !sfReady) return false;
  activeMode = mode;
  return true;
}

function getEngineMode()        { return activeMode; }
function isStockfishAvailable() { return sfReady; }


// ── Top engine lines (multiPv) for Claude grounding ──────────
// Returns an array of {rank, lineSAN, cp, mate} for the top N engine lines.
// lineSAN is a full continuation like "Qh5 f6 Qxf7#" (up to 4 moves).
// Uses Lichess cloud eval with multiPv. Falls back gracefully.

// Helper: convert a sequence of UCI moves to SAN, stepping through positions
function uciLineToSan(uciMoves, startFen) {
  const sans = [];
  try {
    const g = new Chess(startFen);
    for (const uci of uciMoves) {
      if (!uci || uci.length < 4) break;
      const mv = g.move({ from: uci.slice(0,2), to: uci.slice(2,4), promotion: uci[4] || undefined });
      if (!mv) break;
      sans.push(mv.san);
    }
  } catch {}
  return sans;
}

async function fetchTopMoves(fen, n = 3) {
  // Try Lichess multiPv first
  try {
    await lichessThrottle();
    const shortFen = fenFor4Fields(fen);
    const url = `${LICHESS_URL}?fen=${encodeURIComponent(shortFen)}&multiPv=${n}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (data.pvs && data.pvs.length > 0) {
        // Lichess cloud eval returns cp & mate from White's perspective already
        return data.pvs.map((pv, i) => {
          // Full continuation: convert up to 8 UCI moves to SAN
          const uciAll = (pv.moves || '').trim().split(/\s+/).slice(0, 8);
          const sanLine = uciLineToSan(uciAll, fen);
          const firstUci = uciAll[0] || null;

          let cp = pv.cp !== undefined ? pv.cp : (pv.mate !== undefined ? (pv.mate > 0 ? 29000 : -29000) : 0);
          // No flip needed - Lichess values are already White-relative
          let mate = pv.mate !== undefined ? pv.mate : null;
          return {
            rank: i + 1,
            moveSAN: sanLine[0] || uciToSan(firstUci, fen) || firstUci,
            lineSAN: sanLine.join(' ') || (uciToSan(firstUci, fen) || firstUci),
            moveUCI: firstUci,
            cp,
            mate
          };
        });
      }
    }
  } catch (e) {
    console.warn('[TopMoves] Lichess multiPv failed:', e.message);
  }

  // Fallback: run local Stockfish to get at least 1 line with a full PV
  try {
    if (sfInitPromise) await sfInitPromise;
    if (sfReady && !sfBusy) {
      console.log('[TopMoves] Lichess miss - running Stockfish fallback for PV');
      const sfResult = await stockfishAnalyse(fen);
      if (sfResult && sfResult.bestSAN) {
        let cp = sfResult.cp !== undefined ? sfResult.cp : 0;
        let mate = sfResult.mate !== undefined ? sfResult.mate : null;
        return [{
          rank: 1,
          moveSAN: sfResult.bestSAN,
          lineSAN: sfResult.lineSAN || sfResult.bestSAN,
          moveUCI: sfResult.bestUCI,
          cp,
          mate
        }];
      }
    }
  } catch (e2) {
    console.warn('[TopMoves] Stockfish fallback failed:', e2.message);
  }

  return [];
}

// Format top moves into a readable string for Claude prompts
function formatTopMoves(topMoves) {
  if (!topMoves || !topMoves.length) return '';
  const lines = topMoves.map(m => {
    let evalStr;
    if (m.mate !== null && m.mate !== undefined) {
      evalStr = `MATE IN ${Math.abs(m.mate)} for ${m.mate > 0 ? 'White' : 'Black'}`;
    } else {
      const v = (m.cp / 100).toFixed(1);
      evalStr = `eval ${m.cp >= 0 ? '+' : ''}${v}`;
    }
    return `  ${m.rank}. ${m.lineSAN} (${evalStr})`;
  });
  return lines.join('\n');
}

// Like formatTopMoves but traces each move with Chess.js to produce
// plain-English annotations for every half-move in the line.
// This gives Claude concrete, unambiguous descriptions like
// "Nxe5 [knight captures pawn on e5, giving check]" instead of raw SAN.
function annotateTopMoves(fen, topMoves) {
  if (!topMoves || !topMoves.length || !fen) return formatTopMoves(topMoves);
  const pn = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const cn = c => c === 'w' ? 'White' : 'Black';

  const lines = topMoves.map(m => {
    let evalStr;
    if (m.mate !== null && m.mate !== undefined) {
      evalStr = `MATE IN ${Math.abs(m.mate)} for ${m.mate > 0 ? 'White' : 'Black'}`;
    } else {
      const v = (m.cp / 100).toFixed(1);
      evalStr = `eval ${m.cp >= 0 ? '+' : ''}${v}`;
    }

    try {
      const g = new Chess(fen);
      const sanList = (m.lineSAN || '').trim().split(/\s+/).filter(Boolean).slice(0, 8);
      const annotated = [];

      for (const san of sanList) {
        // Find the verbose move object for this SAN
        const legal = g.moves({ verbose: true });
        const mv = legal.find(lm => lm.san === san) ||
                   legal.find(lm => lm.san.replace(/[+#]/g, '') === san.replace(/[+#]/g, ''));
        if (!mv) { annotated.push(san); break; } // can't parse further

        const mover     = cn(mv.color);
        const piece     = pn[mv.piece] || mv.piece;
        const captured  = mv.captured ? pn[mv.captured] : null;
        const isCheck   = san.includes('+') && !san.includes('#');
        const isMate    = san.includes('#');
        const isCastle  = san.startsWith('O-O');
        const isPromo   = mv.promotion ? `, promoting to ${pn[mv.promotion]}` : '';

        let desc;
        if (isMate) {
          desc = `${san} [${mover}'s ${piece} on ${mv.from} moves to ${mv.to}, CHECKMATE]`;
        } else if (isCastle) {
          desc = `${san} [${mover} castles]`;
        } else if (captured) {
          desc = `${san} [${mover}'s ${piece} on ${mv.from} captures ${captured} on ${mv.to}${isCheck ? ', giving check' : ''}${isPromo}]`;
        } else if (isCheck) {
          desc = `${san} [${mover}'s ${piece} on ${mv.from} moves to ${mv.to}, giving check${isPromo}]`;
        } else {
          desc = `${san} [${mover}'s ${piece} on ${mv.from} moves to ${mv.to}${isPromo}]`;
        }

        // Apply the move to advance board state
        g.move(san);

        // ── After landing: detect which enemy pieces this piece NOW attacks ──
        // Flip the active-side field in the FEN so chess.js lets the mover
        // move again from mv.to - this reveals exactly which enemy pieces the
        // landed piece attacks, with no inference from piece geometry.
        // Only do this for quiet moves (not captures/castles/mates, which already
        // have clear consequences).
        if (!captured && !isCastle && !isMate) {
          try {
            const fenParts = g.fen().split(' ');
            fenParts[1] = mv.color; // pseudo-turn: mover moves again
            const g2 = new Chess(fenParts.join(' '));
            const attacked = g2.moves({ verbose: true })
              .filter(am => am.from === mv.to && am.captured)
              .map(am => `${pn[am.captured] || am.captured} on ${am.to}`);
            if (attacked.length > 0) {
              desc = desc.slice(0, -1) + `, now attacking ${attacked.join(' and ')}]`;
            }
          } catch (_) { /* ignore - use desc as-is */ }
        }

        annotated.push(desc);
      }

      return `  ${m.rank}. ${annotated.join('  ')} (${evalStr})`;
    } catch {
      // Fallback to plain SAN if anything fails
      return `  ${m.rank}. ${m.lineSAN} (${evalStr})`;
    }
  });

  return lines.join('\n');
}


// ── Lichess Opening Explorer ──────────────────────────────────
// Check whether a played move (SAN) appears in the Lichess masters database
// for the position before that move (preFen).  Returns true/false.

let _openingLastMs = 0;
async function openingThrottle() {
  const wait = 150 - (Date.now() - _openingLastMs);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _openingLastMs = Date.now();
}

async function checkOpeningBook(preFen, moveSan) {
  if (!preFen || !moveSan) return false;
  await openingThrottle();
  try {
    const shortFen = fenFor4Fields(preFen);
    const url = `https://www.chessdb.cn/cdb.php?action=queryall&board=${encodeURIComponent(shortFen)}&json=1`;
    const res  = await fetch(url);
    if (!res.ok) return false;
    const data = await res.json();
    if (data.status !== 'ok' || !data.moves) return false;
    return data.moves.some(m => m.san === moveSan);
  } catch {
    return false;
  }
}

/*
  Sequential book-depth check:
  "If two players play a game whose first N moves have been played before,
   those N moves are book moves / theory."
  Walk from ply 1 forward. The FIRST move not in the DB ends the book phase.
  Cap at MAX_BOOK_PLIES (20 plies = 10 full moves) per the design rule.
  Returns a boolean array (one entry per ply, same length as positions).
*/
const MAX_BOOK_PLIES = 20;

async function findBookDepth(positions, onProgress) {
  const result  = new Array(positions.length).fill(false);
  const ceiling = Math.min(positions.length, MAX_BOOK_PLIES + 1);
  for (let i = 1; i < ceiling; i++) {
    if (onProgress) onProgress(i, positions.length);
    const isBook = await checkOpeningBook(positions[i - 1].fen, positions[i].san);
    if (isBook) {
      result[i] = true;
    } else {
      break;  // first deviation from theory - everything after is NOT book
    }
  }
  return result;
}
