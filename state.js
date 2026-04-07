/* ============================================================
   main.js - Game state, board rendering, UI wiring
   Depends on: chess.js (global), engine.js, claude-api.js
   ============================================================ */

'use strict';

// ---- Personality piece colorizer ----
// Why brightness(0.5) first?
//   sepia(1) on pure white gives (255,255,239) - L≈98% in HSL, effectively still white.
//   saturate() and hue-rotate() have almost zero visual effect on near-white pixels.
//   brightness(0.5) pushes white → mid-gray (128,128,128), sepia then produces a
//   real medium warm-brown (≈173,154,120) at L≈57% which hue-rotate can shift to any
//   vivid color. brightness(2.0) at the end compensates to restore perceived brightness.
// For black player pieces we invert first so dark body → light body → same colorisation.
// Black outlines (L=0%) are unaffected by the middle transforms and stay dark throughout.
function persColorFilter(hex, isBlackPiece) {
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let hue = 0;
  if (d > 0.001) {
    if (max === r) hue = 60 * (((g - b) / d) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
    if (hue < 0) hue += 360;
  }
  // Sepia baseline hue ≈ 35°; rotate from there to reach target
  const rotate = Math.round(hue - 35);
  // Invert black pieces so their dark body becomes light before colorising
  const pre = isBlackPiece ? 'invert(1) ' : '';
  return `${pre}brightness(0.5) sepia(1) hue-rotate(${rotate}deg) saturate(900%) brightness(2.0)`;
}

// ---- Piece images (Lichess cburnett SVG set) ----
const PIECE_IMG_BASE = 'https://lichess1.org/assets/piece/cburnett/';
const PIECE_LETTER   = { p:'P', n:'N', b:'B', r:'R', q:'Q', k:'K' };

function pieceImg(color, type) {
  const img = document.createElement('img');
  img.src       = PIECE_IMG_BASE + color + PIECE_LETTER[type] + '.svg';
  img.className = 'piece-img';
  img.draggable = false;
  img.alt       = color + type;
  return img;
}

// ---- Game state ----
let positions      = [];  // [{fen, san, from, to, turn}]
let evals          = [];  // [{cp, bestSAN, bestUCI, ...} | null]
let bookMoves      = [];  // [bool] true if this ply is a book move
let currentPly     = 0;
let analysisActive = false;

// ---- Player color ----
let playerColor = 'w'; // 'w' = White, 'b' = Black

function setPlayerColor(c) {
  playerColor = c;
  document.getElementById('colorWhite').classList.toggle('active', c === 'w');
  document.getElementById('colorBlack').classList.toggle('active', c === 'b');
}

// ---- Active explain context ----
let explainCtx = null; // 'position' | 'move' | 'summary' | null

// Stores a function () => promptString, evaluated lazily at ask-time
// so thoughts filled in AFTER clicking the context button are captured.
let pendingExplainPromptFn = null;

// ==============================================================
//  HELPERS
// ==============================================================
function mkEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function setNote(text, dim = false, html = false) {
  // Route to hint area
  const hint = document.getElementById('aicHint');
  if (hint) {
    hint.style.display = '';
    if (html) hint.innerHTML = text; else hint.textContent = text;
    return;
  }
  const el = document.getElementById('explanation');
  if (!el) return;
  el.className = dim ? 'dim' : '';
  if (html) el.innerHTML = text; else el.textContent = text;
}

// Returns [{label, value}] for the given explain context
function getContextThoughts(ctx) {
  const configs = {
    position: [
      { id: 'ctPosQ1', label: 'What I see'           },
      { id: 'ctPosQ2', label: 'My plan'               },
      { id: 'ctPosQ3', label: 'Pieces that worry me'  },
      { id: 'ctPosQ4', label: 'What I would play'     }
    ],
    move: [
      { id: 'ctMoveQ1', label: 'Why I played this'           },
      { id: 'ctMoveQ2', label: 'Alternatives I considered'   },
      { id: 'ctMoveQ3', label: 'What I was worried about'    },
      { id: 'ctMoveQ4', label: 'What surprised me'           }
    ],
    summary: [
      { id: 'ctSumQ1', label: 'Overall feeling'             },
      { id: 'ctSumQ2', label: 'When things went wrong'      },
      { id: 'ctSumQ3', label: 'My biggest mistake'          },
      { id: 'ctSumQ4', label: 'What I would do differently' }
    ],
    improve: [
      { id: 'ctImpQ1', label: 'What I most want to improve' },
      { id: 'ctImpQ2', label: 'How much I study per week'   },
      { id: 'ctImpQ3', label: 'Topics I find hardest'       },
      { id: 'ctImpQ4', label: 'My current level / rating'   }
    ]
  };
  return (configs[ctx] || []).map(c => ({
    label: c.label,
    value: (document.getElementById(c.id) || {}).value?.trim() || ''
  }));
}

// Shows the contextual thought inputs for the given explain button context
// and reveals the Ask Claude button. Does NOT call Claude yet.
function setExplainContext(ctx) {
  explainCtx = ctx;
  const map = { position: 'ctPos', move: 'ctMove', summary: 'ctSum' };
  Object.values(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = map[ctx];
  if (target) {
    const el = document.getElementById(target);
    if (el) el.style.display = '';
  }
  // Show the Ask Claude button
  const btn = document.getElementById('askClaudeBtn');
  if (btn) btn.style.display = '';
}

// Called by the Ask Claude button - evaluates the stored prompt fn at this
// moment so any thoughts filled in after clicking the context button are used.
async function askClaude() {
  if (!pendingExplainPromptFn) {
    setNote('Click a context button first (Position / This Move / Summary).', true);
    return;
  }
  const promptText = pendingExplainPromptFn();
  await runExplain(promptText);
}

// ==============================================================
//  TAB SWITCHING
// ==============================================================
function switchRightTab(tab) {
  // Legacy no-op - tabs removed, single analysis page now
}

