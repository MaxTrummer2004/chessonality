// ==============================================================
//  GAME PLAN - generation + regen
// ==============================================================
async function generateImprovement(apiKey, thoughts) {
  const content = document.getElementById('improveContent');
  if (!content) return;
  content.className = 'prof-improve-result';
  content.innerHTML = '<span class="spinner"></span> Generating plan\u2026';

  const turns = [];
  for (let i = 1; i < positions.length; i++) {
    const cls = classifyMove(i);
    if (cls === 'mistake' || cls === 'blunder' || cls === 'book-blunder' || cls === 'brilliant') {
      const mv   = Math.ceil(i / 2);
      const side = positions[i].turn === 'b' ? 'White' : 'Black';
      turns.push(`Move ${mv} (${side}: ${positions[i].san}): ${labelFor(cls)}, ~${cpLoss(i)}cp lost`);
    }
  }

  let bookEnd = 0;
  for (let i = bookMoves.length - 1; i >= 0; i--) { if (bookMoves[i]) { bookEnd = i; break; } }

  const lastG = new Chess(positions[positions.length - 1].fen);
  let result = 'Game ended';
  if (lastG.in_checkmate())      result = lastG.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  else if (lastG.in_stalemate()) result = 'Draw by stalemate';
  else if (lastG.in_draw())      result = 'Draw';

  const prompt = TEMPLATES.improve({
    result,
    bookEnd,
    totalPly: positions.length - 1,
    turns: turns.length ? turns.slice(0, 8).join('\n') : null,
    thoughts,
    color: playerColor
  });

  try {
    const reply = await callClaudeLong(prompt, apiKey);
    const rich = renderAicRich(marked.parse(reply), null, 'full');
    content.className = 'prof-improve-result';
    content.innerHTML = _injectReplayBtn(rich);
    launchCoachPresentation(rich);
  } catch (err) {
    content.className = 'prof-improve-result dim';
    content.textContent = 'Could not generate: ' + err.message;
  }
}

async function regenerateGamePlan() {
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  const content = document.getElementById('improveContent');
  if (!hasAccess) {
    if (content) { content.className = 'prof-improve-result dim'; content.textContent = 'API key missing. Open Settings (\u2699) and add your Claude API key.'; }
    return;
  }
  if (positions.length < 3) {
    return;
  }
  generateImprovement(key, getContextThoughts('improve'));
}

// ==============================================================
//  EXPLAIN ACTIONS
// ==============================================================
function materialStr(fen) {
  const v = { p:1, n:3, b:3, r:5, q:9 };
  let w = 0, b = 0;
  for (const ch of fen.split(' ')[0]) {
    const l = ch.toLowerCase();
    if (v[l]) { if (ch === ch.toUpperCase()) w += v[l]; else b += v[l]; }
  }
  const d = w - b;
  return d > 0 ? `White up ${d} pts` : d < 0 ? `Black up ${-d} pts` : 'Equal material';
}

function setBadge(cls, text) {
  const el = document.getElementById('badgeArea');
  if (el) el.innerHTML = `<span class="badge badge-${cls}">${text}</span>`;
}

async function runExplain(promptText) {
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) {
    setNote('API key missing. Open Settings (\u2699) in the top right.', true);
    return;
  }
  setNote('<span class="spinner"></span> Asking Claude...', false, true);
  try {
    const reply = await callClaude(promptText, key);
    showClaudeResponse(reply);
  } catch (err) {
    setNote('Error: ' + err.message, true);
  }
}

function showClaudeResponse(text, isHtml) {
  // Legacy - now routes to the unified output panel
  setAicOutput(isHtml ? text : marked.parse(text), false);
}

// ── Active tab in the unified AI coach panel ──
let _aicActiveTab = 'move'; // always 'move' - position tab removed

// Toggle the collapsible "Add your thoughts" panel
function toggleAicThoughts() {
  const panel = document.getElementById('aicThoughtsPanel');
  const arrow = document.getElementById('aicThoughtsArrow');
  if (!panel) return;
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : '';
  if (arrow) arrow.textContent = open ? '\u25B6' : '\u25BC';
}

// Set the unified output panel content
function setAicOutput(html, isDim, placeholder) {
  const el = document.getElementById('aicOutput');
  const hint = document.getElementById('aicHint');
  if (isDim) {
    if (el) { el.style.display = 'none'; el.innerHTML = ''; }
    if (hint) { hint.style.display = ''; hint.textContent = placeholder || ''; }
  } else {
    const wasHidden = el && el.style.display === 'none';
    if (el) { el.style.display = ''; el.innerHTML = html; }
    if (hint) hint.style.display = 'none';
    // When output first becomes visible, scroll it into the center of the viewport
    // so the user sees the freshly generated explanation without manual scrolling.
    if (el && wasHidden) {
      requestAnimationFrame(() => {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      });
    }
  }
}

// ── Rich HTML renderer for ALL Claude output ──
// Converts marked.parse() HTML into visual cards with move chips, concept icons, etc.
// `cls` - optional move classification for badge (good/blunder/etc.)
// `mode` - 'compact' (move/position panel) or 'full' (breakdown/coach/improve)
function renderAicRich(rawHtml, cls, mode) {
  mode = mode || 'compact';

  // Strip em-dashes and en-dashes that Claude occasionally emits despite instructions
  rawHtml = rawHtml.replace(/\s*[-–]\s*/g, ', ');

  // Personality name color map (names without "The")
  const PERS_COLORS = {
    'Anaconda': '#22c55e', 'Eagle': '#3b82f6', 'Fox': '#f59e0b',
    'Lion': '#e94560',     'Owl': '#8b5cf6',   'Shark': '#06b6d4',
    'Phoenix': '#ff6b6b',  'Turtle': '#94a3b8'
  };

  function colorizePersonality(html) {
    return html.replace(/\b(Anaconda|Eagle|Fox|Lion|Owl|Shark|Phoenix|Turtle)\b/g, (match) => {
      const color = PERS_COLORS[match];
      return color ? `<span style="color:${color};font-weight:700">${match}</span>` : match;
    });
  }

  function chipify(html) {
    return html.replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)\b/g,
      (m) => `<span class="aic-move-chip">${m}</span>`);
  }

  function process(html) { return colorizePersonality(chipify(html)); }

  function conceptIcon(text) {
    const t = text.toLowerCase();
    // Check if heading already starts with an emoji - if so, return null (don't double up)
    if (/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}♟♞♝♜♛♚]/u.test(text.trim())) return null;
    if (t.includes('dna') || t.includes('identity'))          return '\u2657';
    if (t.includes('brilliant') || t.includes('sacrifice'))   return '\u2655';
    if (t.includes('checkmate') || t.includes('mate in'))     return '\u265A';
    if (t.includes('king safety') || t.includes('king is'))   return '\u2654';
    if (t.includes('piece activity') || t.includes('active')) return '\u2658';
    if (t.includes('pawn structure') || t.includes('pawn'))   return '\u2659';
    if (t.includes('opening') || t.includes('book'))          return '\u2659';
    if (t.includes('endgame'))                                 return '\u2654';
    if (t.includes('tactic') || t.includes('fork') || t.includes('pin') || t.includes('puzzle')) return '\u2658';
    if (t.includes('advantage') || t.includes('winning'))     return '\u2655';
    if (t.includes('mistake') || t.includes('blunder') || t.includes('pattern to break')) return '\u265A';
    if (t.includes('training') || t.includes('practice') || t.includes('exercise') || t.includes('play')) return '\u2658';
    if (t.includes('study') || t.includes('concept') || t.includes('learn')) return '\u2657';
    if (t.includes('master') || t.includes('champion'))       return '\u2655';
    if (t.includes('well') || t.includes('strength'))         return '\u2656';
    return '\u2654';
  }

  function getSectionMeta(headingText) {
    const t = (headingText || '').toLowerCase().trim();
    if (t === 'overview')     return { secCls: 'sec-overview',     icon: '\u2654', label: 'Overview' };
    if (t === 'structure')    return { secCls: 'sec-structure',     icon: '\u2659', label: 'Structure' };
    if (t === 'tactics')      return { secCls: 'sec-tactics',      icon: '\u2655', label: 'Best Move' };
    if (t === 'best move')    return { secCls: 'sec-tactics',      icon: '\u2655', label: 'Best Move' };
    if (t === 'continuation') return { secCls: 'sec-continuation',  icon: '\u2657', label: 'Continuation' };
    return null;
  }

  const div = document.createElement('div');
  div.innerHTML = rawHtml;

  // ── INLINE MODE: simple clean text, no sections/cards/slides ──
  if (mode === 'inline') {
    let text = '';
    for (const node of div.children) {
      const tag = node.tagName?.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') continue; // skip headers
      const content = node.innerHTML || node.textContent || '';
      if (content.trim()) text += `<div class="aic-sentence">${process(content)}</div>`;
    }
    if (!text) text = `<div class="aic-sentence">${process(rawHtml)}</div>`;
    return `<div class="aic-rich-block aic-inline">${text}</div>`;
  }

  // ── Group DOM children into sections (heading + following content) ──
  const sections = [];
  let curSec = null;
  for (const node of div.children) {
    const tag = node.tagName?.toLowerCase();
    const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4';
    if (isHeading) {
      if (curSec) sections.push(curSec);
      curSec = { heading: node, children: [] };
    } else {
      if (!curSec) curSec = { heading: null, children: [] };
      curSec.children.push(node);
    }
  }
  if (curSec) sections.push(curSec);

  // ── Detect named sections ──
  const namedSections = [];
  for (const sec of sections) {
    const headText = sec.heading?.textContent || '';
    const meta = getSectionMeta(headText);
    if (meta) {
      namedSections.push({ meta, headText, children: sec.children });
    }
  }

  // ── SLIDE DECK MODE: compact + 3 named sections → presentation ──
  if (mode === 'compact' && namedSections.length >= 3) {
    return _buildSlideDeck(namedSections, process, 'aic');
  }

  // ── FULL MODE: legacy card layout for breakdown/coach/improve ──
  let out = `<div class="aic-rich-block">`;

  if (cls) {
    const icons = { brilliant:'!!', good:'\u2713', inaccuracy:'?!', mistake:'?', blunder:'??', book:'\u2659', neutral:'\u00B7' };
    const icon = icons[cls] || '·';
    out += `<div class="aic-class-row"><span class="aic-move-badge ${cls}">${icon} ${cls.charAt(0).toUpperCase()+cls.slice(1)}</span></div>`;
  }

  sections.forEach((sec, i) => {
    const delay = `style="animation-delay:${i * 0.1}s"`;
    const headText = sec.heading?.textContent || '';
    const meta = getSectionMeta(headText);

    if (meta) {
      out += `<div class="aic-section-card ${meta.secCls}" ${delay}>`;
      out += `<div class="aic-sec-label"><span class="aic-sec-icon">${meta.icon}</span>${headText.toUpperCase()}</div>`;
      for (const child of sec.children) {
        const tag = child.tagName?.toLowerCase();
        if (tag === 'ol' || tag === 'ul') {
          const items = Array.from(child.querySelectorAll('li'));
          out += items.map((li, k) => `<div class="aic-step-line">${k + 1}. ${process(li.innerHTML)}</div>`).join('');
        } else if (tag === 'p' || !tag) {
          out += `<div class="aic-sec-body">${process(child.innerHTML || child.textContent)}</div>`;
        }
      }
      out += `</div>`;
    } else {
      let idx = i;
      if (sec.heading) {
        const icon = conceptIcon(headText);
        const iconHtml = icon ? `<span class="aic-section-icon">${icon}</span>` : '';
        out += `<div class="aic-section-head" ${delay}>${iconHtml}<span class="aic-section-text">${process(sec.heading.innerHTML)}</span></div>`;
        idx++;
      }
      sec.children.forEach((child, j) => {
        const tag = child.tagName?.toLowerCase();
        const cDelay = `style="animation-delay:${(i + j + 1) * 0.05}s"`;
        if (tag === 'ol') {
          const items = Array.from(child.querySelectorAll('li'));
          items.forEach((li, k) => {
            const liIcon = conceptIcon(li.textContent) || null;
            out += `<div class="aic-numbered-card" style="animation-delay:${(idx+k)*0.05}s"><span class="aic-num">${k+1}</span><div class="aic-num-content">${liIcon ? `<span class="aic-inline-icon">${liIcon}</span> ` : ''}${process(li.innerHTML)}</div></div>`;
          });
        } else if (tag === 'ul') {
          const items = Array.from(child.querySelectorAll('li'));
          items.forEach((li, k) => {
            const liIcon = conceptIcon(li.textContent) || '•';
            out += `<div class="aic-bullet-card" style="animation-delay:${(idx+k)*0.05}s"><span class="aic-bullet-icon">${liIcon}</span><div>${process(li.innerHTML)}</div></div>`;
          });
        } else if (tag === 'p') {
          const icon = (mode === 'full') ? conceptIcon(child.textContent) : null;
          out += `<div class="aic-sentence" ${cDelay}>${icon ? `<span class="aic-inline-icon">${icon}</span> ` : ''}${process(child.innerHTML)}</div>`;
        } else {
          out += `<div class="aic-sentence" ${cDelay}>${process(child.innerHTML || child.textContent)}</div>`;
        }
      });
    }
  });

  if (sections.length === 0) {
    out += `<div class="aic-sentence">${process(rawHtml)}</div>`;
  }

  out += `</div>`;
  return out;
}

// ══════════════════════════════════════════════
//  SHARED SLIDE DECK BUILDER
//  Used by BOTH analysis page and walkthrough.
//  Overview = 1 slide, Structure = 1 slide,
//  Tactics = multiple slides (one per continuation move).
// ══════════════════════════════════════════════
function _buildSlideDeck(namedSections, processFn, prefix) {
  prefix = prefix || 'aic';

  const SLIDE_CLS = {
    'sec-overview':     'slide-overview',
    'sec-structure':    'slide-structure',
    'sec-tactics':      'slide-tactics',
    'sec-continuation': 'slide-tactics'
  };

  // slides: { icon, label, cls, bodyHtml }
  const slides = [];

  for (const ns of namedSections) {
    const secKey = ns.meta.secCls;
    const slideCls = SLIDE_CLS[secKey] || 'slide-overview';

    if (secKey === 'sec-tactics') {
      // ── Best Move: single prose slide (same as Overview/Structure) ──
      const bodyParts = ns.children.map(c => {
        return `<div class="${prefix}-slide-text">${processFn(c.innerHTML || c.textContent || '')}</div>`;
      });
      slides.push({ icon: ns.meta.icon, label: ns.meta.label, cls: slideCls,
        bodyHtml: bodyParts.join('') || `<div class="${prefix}-slide-text">${processFn('No significant alternatives.')}</div>` });
    } else {
      // ── Overview / Structure: single slide ──
      const bodyParts = ns.children.map(c => {
        const tag = c.tagName?.toLowerCase();
        if (tag === 'ol' || tag === 'ul') {
          const items = Array.from(c.querySelectorAll('li'));
          return items.map((li, k) => `<div class="${prefix}-slide-text">${k + 1}. ${processFn(li.innerHTML)}</div>`).join('');
        }
        return `<div class="${prefix}-slide-text">${processFn(c.innerHTML || c.textContent || '')}</div>`;
      });
      slides.push({ icon: ns.meta.icon, label: ns.meta.label, cls: slideCls, bodyHtml: bodyParts.join('') });
    }
  }

  if (slides.length === 0) return '<div class="aic-sentence">No analysis available.</div>';

  const uid = Math.random().toString(36).slice(2, 7);
  const deckId = `${prefix}Deck${uid}`;

  let out = `<div class="${prefix}-slide-deck" id="${deckId}" data-slide="0">`;

  slides.forEach((s, i) => {
    out += `<div class="${prefix}-slide${i === 0 ? ' active' : ''}" data-idx="${i}">
      <div class="${prefix}-slide-header ${s.cls}">
        <span class="${prefix}-slide-icon">${s.icon}</span>
        <span class="${prefix}-slide-label">${s.label}</span>
        <span class="${prefix}-slide-counter">${i + 1} / ${slides.length}</span>
      </div>
      <div class="${prefix}-slide-body">${s.bodyHtml}</div>
    </div>`;
  });

  out += `<div class="${prefix}-slide-nav">
    <button class="${prefix}-slide-prev" onclick="_slideDeckNav(this,-1)" ${slides.length <= 1 ? 'disabled' : ''}>&#8592;</button>
    <div class="${prefix}-slide-dots">`;
  slides.forEach((s, i) => {
    out += `<span class="${prefix}-slide-dot${i === 0 ? ' active' : ''} ${s.cls}" data-idx="${i}" onclick="_slideDeckJump(this,${i})"></span>`;
  });
  out += `</div>
    <button class="${prefix}-slide-next" onclick="_slideDeckNav(this,1)">&#8594;</button>
  </div>`;
  out += `</div>`;
  return out;
}

// ── Unified slide deck navigation (used by both analysis page and walkthrough) ──
function _slideDeckShowSlide(deck, idx) {
  const slides = Array.from(deck.children).filter(el => el.hasAttribute('data-idx') && !el.classList.contains('aic-slide-nav') && !el.classList.contains('wt-slide-nav'));
  const navContainer = deck.querySelector('.aic-slide-dots, .wt-slide-dots');
  const dots = navContainer ? navContainer.querySelectorAll('[data-idx]') : [];
  const total = slides.length;
  if (idx < 0 || idx >= total) return;

  deck.setAttribute('data-slide', idx);
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));

  if (slides[idx]) slides[idx].classList.add('active');
  if (dots[idx]) dots[idx].classList.add('active');

  const prev = deck.querySelector('.aic-slide-prev, .wt-slide-prev');
  const next = deck.querySelector('.aic-slide-next, .wt-slide-next');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === total - 1;

  // Auto-scale short walkthrough content (header + body) to fill space
  const activeSlide = slides[idx];
  if (activeSlide) {
    const body = activeSlide.querySelector('.wt-slide-body');
    if (body) {
      const text = body.textContent.trim();
      const isShort = text.length < 120;
      body.classList.toggle('wt-body-short', isShort);
      activeSlide.classList.toggle('wt-slide-short', isShort);
    }
  }
}

function _slideDeckNav(btn, dir) {
  const deck = btn.closest('.aic-slide-deck, .wt-slide-deck');
  if (!deck) return;
  const cur = parseInt(deck.getAttribute('data-slide') || '0', 10);
  _slideDeckShowSlide(deck, cur + dir);
}

function _slideDeckJump(dot, idx) {
  const deck = dot.closest('.aic-slide-deck, .wt-slide-deck');
  if (!deck) return;
  _slideDeckShowSlide(deck, idx);
}

// Legacy compat: old walkthrough slide nav calls
function _wtSlideNav(btn, dir) { _slideDeckNav(btn, dir); }
function _wtSlideJump(dot, idx) { _slideDeckJump(dot, idx); }
function _wtShowSlide(deck, idx) { _slideDeckShowSlide(deck, idx); }

// ══════════════════════════════════════════════
//  BEST CONTINUATION SLIDESHOW
//  One slide per continuation move, with plain-English description.
// ══════════════════════════════════════════════

const PIECE_NAMES = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };

// Convert a SAN move + FEN (before the move) to a short plain-English sentence
function _sanToEnglish(san, fen) {
  if (!san || !fen) return san || '';
  if (san === 'O-O') return 'Castles kingside';
  if (san === 'O-O-O') return 'Castles queenside';
  try {
    const g = new Chess(fen);
    const mv = g.move(san);
    if (!mv) return san;
    const piece = PIECE_NAMES[mv.piece] || 'Pawn';
    const captured = mv.captured ? PIECE_NAMES[mv.captured] || 'piece' : null;
    const promo = mv.promotion ? (' promoting to ' + (PIECE_NAMES[mv.promotion] || 'Queen')) : '';
    const check = mv.san.endsWith('+') ? ', with check' : (mv.san.endsWith('#') ? ', checkmate' : '');
    const side = mv.color === 'w' ? 'White' : 'Black';
    if (captured) {
      return `${side} ${piece.toLowerCase()} captures ${captured.toLowerCase()} on ${mv.to}${promo}${check}`;
    }
    return `${side} ${piece.toLowerCase()} moves to ${mv.to}${promo}${check}`;
  } catch (_) { return san; }
}

// Cache for continuation slideshow HTML: key = "cont:<ply>" → HTML string
const _contSlideshowCache = {};

// Track which ply the continuation is currently showing (for board restore)
let _contActivePly = null;
let _contActiveMode = null; // 'analysis' or 'wt'

// Render a FEN onto a board element, with optional from/to highlights
function _renderFenOnBoard(boardEl, fen, fromSq, toSq) {
  if (!boardEl || !fen) return;
  boardEl.innerHTML = '';
  const g = new Chess(fen);
  const grid = g.board();
  const flipped = playerColor === 'b';

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      const name = String.fromCharCode(97 + c) + (8 - r);

      if (fromSq && name === fromSq) sq.classList.add('cont-from');
      if (toSq && name === toSq) sq.classList.add('cont-to');

      const cell = grid[r][c];
      if (cell) {
        const img = pieceImg(cell.color, cell.type);
        sq.appendChild(img);
      }

      // Coordinate labels
      if (ci === 0) { const l = mkEl('span', 'coord-label coord-rank'); l.textContent = 8 - r; sq.appendChild(l); }
      if (ri === 7) { const l = mkEl('span', 'coord-label coord-file'); l.textContent = String.fromCharCode(97 + c); sq.appendChild(l); }

      boardEl.appendChild(sq);
    }
  }
}

// Update the board to show a continuation position
function _contUpdateBoard(ply, slideIdx, mode) {
  const data = _contFensCache[ply];
  if (!data) return;

  // fens[slideIdx] = FEN before the move, fens[slideIdx+1] = FEN after the move
  const fenAfter = data.fens[slideIdx + 1] || data.fens[slideIdx];
  const san = data.sans[slideIdx];

  // Determine from/to squares for highlighting
  let fromSq = null, toSq = null;
  if (san && data.fens[slideIdx]) {
    try {
      const g = new Chess(data.fens[slideIdx]);
      const mv = g.move(san);
      if (mv) { fromSq = mv.from; toSq = mv.to; }
    } catch (_) {}
  }

  if (mode === 'analysis') {
    const boardEl = document.getElementById('board');
    if (boardEl) _renderFenOnBoard(boardEl, fenAfter, fromSq, toSq);
  } else if (mode === 'wt') {
    const container = document.getElementById('wtBoardClone');
    if (container) {
      let boardEl = container.querySelector('.board');
      if (!boardEl) {
        boardEl = document.createElement('div');
        boardEl.className = 'board wt-mini-board';
        container.innerHTML = '';
        container.appendChild(boardEl);
      }
      _renderFenOnBoard(boardEl, fenAfter, fromSq, toSq);
    }
  }
}

// Build continuation slideshow HTML from _contFensCache data
function _buildContSlideshow(ply) {
  const data = _contFensCache[ply];
  if (!data || !data.sans || data.sans.length === 0) return null;

  const slides = [];
  for (let i = 0; i < data.sans.length; i++) {
    const san = data.sans[i];
    const fen = data.fens[i]; // FEN before this move
    const desc = _sanToEnglish(san, fen);
    slides.push({ san, desc, idx: i });
  }
  if (slides.length === 0) return null;

  const uid = Math.random().toString(36).slice(2, 7);
  const deckId = 'contDeck' + uid;

  let html = `<div class="cont-slideshow" id="${deckId}" data-slide="0" data-ply="${ply}">`;
  html += `<div class="cont-slideshow-title">Best Continuation</div>`;

  slides.forEach((s, i) => {
    html += `<div class="cont-slide${i === 0 ? ' active' : ''}" data-idx="${i}">
      <div class="cont-slide-num">${i + 1} / ${slides.length}</div>
      <div class="cont-slide-move"><span class="aic-move-chip">${s.san}</span></div>
      <div class="cont-slide-desc">${s.desc}</div>
    </div>`;
  });

  html += `<div class="cont-slide-nav">
    <button class="cont-slide-prev" onclick="_contSlideNav(this,-1)" ${slides.length <= 1 ? 'disabled' : ''}>&#8592;</button>
    <div class="cont-slide-dots">`;
  slides.forEach((_, i) => {
    html += `<span class="cont-slide-dot${i === 0 ? ' active' : ''}" data-idx="${i}" onclick="_contSlideJump(this,${i})"></span>`;
  });
  html += `</div>
    <button class="cont-slide-next" onclick="_contSlideNav(this,1)">&#8594;</button>
  </div>`;
  html += `</div>`;
  return html;
}

function _contSlideShow(deck, idx) {
  const slides = Array.from(deck.querySelectorAll('.cont-slide[data-idx]'));
  const dots = deck.querySelectorAll('.cont-slide-dot[data-idx]');
  if (idx < 0 || idx >= slides.length) return;
  deck.setAttribute('data-slide', idx);
  slides.forEach(s => s.classList.remove('active'));
  dots.forEach(d => d.classList.remove('active'));
  if (slides[idx]) slides[idx].classList.add('active');
  if (dots[idx]) dots[idx].classList.add('active');
  const prev = deck.querySelector('.cont-slide-prev');
  const next = deck.querySelector('.cont-slide-next');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === slides.length - 1;

  // Update the board to show this continuation position
  const ply = parseInt(deck.getAttribute('data-ply') || '0', 10);
  if (_contActiveMode && ply) {
    _contUpdateBoard(ply, idx, _contActiveMode);
  }
}

function _contSlideNav(btn, dir) {
  const deck = btn.closest('.cont-slideshow');
  if (!deck) return;
  const cur = parseInt(deck.getAttribute('data-slide') || '0', 10);
  _contSlideShow(deck, cur + dir);
}

function _contSlideJump(dot, idx) {
  const deck = dot.closest('.cont-slideshow');
  if (!deck) return;
  _contSlideShow(deck, idx);
}

// Show continuation slideshow - analysis page
function handleShowContAnalysis() {
  const ply = currentPly;
  if (!_contFensCache[ply]) return;
  const cacheKey = 'cont:' + ply;
  if (!_contSlideshowCache[cacheKey]) {
    _contSlideshowCache[cacheKey] = _buildContSlideshow(ply);
  }
  const html = _contSlideshowCache[cacheKey];
  if (!html) return;

  _contActivePly = ply;
  _contActiveMode = 'analysis';

  const output = document.getElementById('aicOutput');
  if (!output) return;

  // Find or create the continuation container above the deck
  let contWrap = output.querySelector('.cont-wrap');
  if (!contWrap) {
    contWrap = document.createElement('div');
    contWrap.className = 'cont-wrap';
    output.insertBefore(contWrap, output.firstChild);
  }
  contWrap.innerHTML = html;
  const deck = contWrap.querySelector('.cont-slideshow');
  if (deck) _contSlideShow(deck, 0);

  // Swap button to "Hide" state
  const btn = output.querySelector('.cont-btn');
  if (btn) btn.style.display = 'none';
  const againBtn = output.querySelector('.cont-btn-again');
  if (againBtn) againBtn.style.display = '';
}

// Reset continuation slideshow for analysis page - restore board
function handleHideContAnalysis() {
  const output = document.getElementById('aicOutput');
  if (!output) return;
  const contWrap = output.querySelector('.cont-wrap');
  if (contWrap) contWrap.innerHTML = '';
  const btn = output.querySelector('.cont-btn');
  if (btn) btn.style.display = '';
  const againBtn = output.querySelector('.cont-btn-again');
  if (againBtn) againBtn.style.display = 'none';

  // Restore the original position on the board
  _contActiveMode = null;
  _contActivePly = null;
  renderBoard();
}

// Show continuation slideshow - walkthrough
function handleShowContWt(ply) {
  const cacheKey = 'cont:' + ply;
  if (!_contFensCache[ply]) return;
  if (!_contSlideshowCache[cacheKey]) {
    _contSlideshowCache[cacheKey] = _buildContSlideshow(ply);
  }
  const html = _contSlideshowCache[cacheKey];
  if (!html) return;

  _contActivePly = ply;
  _contActiveMode = 'wt';

  const body = document.getElementById('wtCoachBody');
  if (!body) return;

  let contWrap = body.querySelector('.cont-wrap');
  if (!contWrap) {
    contWrap = document.createElement('div');
    contWrap.className = 'cont-wrap';
    body.insertBefore(contWrap, body.firstChild);
  }
  contWrap.innerHTML = html;
  const deck = contWrap.querySelector('.cont-slideshow');
  if (deck) _contSlideShow(deck, 0);

  const btn = body.querySelector('.cont-btn');
  if (btn) btn.style.display = 'none';
  const againBtn = body.querySelector('.cont-btn-again');
  if (againBtn) againBtn.style.display = '';
}

function handleHideContWt(ply) {
  const body = document.getElementById('wtCoachBody');
  if (!body) return;
  const contWrap = body.querySelector('.cont-wrap');
  if (contWrap) contWrap.innerHTML = '';
  const btn = body.querySelector('.cont-btn');
  if (btn) btn.style.display = '';
  const againBtn = body.querySelector('.cont-btn-again');
  if (againBtn) againBtn.style.display = 'none';

  // Restore walkthrough board to the original move position
  _contActiveMode = null;
  _contActivePly = null;
  _wtCloneBoard(ply);
}

// Generate the "Show Continuation" button HTML (used by both analysis + walkthrough)
function _contButtonHtml(onclickShow, onclickHide) {
  return `<div class="cont-btn-wrap">
    <button class="cont-btn" onclick="${onclickShow}">Show Best Continuation</button>
    <button class="cont-btn-again" onclick="${onclickHide}" style="display:none">Hide Continuation</button>
  </div>`;
}

// ══════════════════════════════════════════════
//  MOVE PRESENTATION OVERLAY
//  Full-screen overlay showing the board + slide deck.
// ══════════════════════════════════════════════
function _ensureMpOverlay() {
  let ov = document.getElementById('mpOverlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'mpOverlay';
  ov.className = 'mp-overlay';
  ov.innerHTML = `
    <div class="mp-backdrop" onclick="closeMovePresentation()"></div>
    <div class="mp-layout">
      <div class="mp-board-side" id="mpBoardSide">
        <div class="mp-board-clone" id="mpBoardClone"></div>
        <div class="mp-move-label" id="mpMoveLabel"></div>
      </div>
      <div class="mp-content-side">
        <div class="mp-header">
          <div class="mp-badge" id="mpBadge"></div>
          <button class="mp-close" onclick="closeMovePresentation()" title="Close">&times;</button>
        </div>
        <div class="mp-body" id="mpBody"></div>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  document.addEventListener('keydown', _mpKeyHandler);
  return ov;
}

function _mpKeyHandler(e) {
  const ov = document.getElementById('mpOverlay');
  if (!ov || ov.style.display === 'none') return;
  if (e.key === 'Escape') closeMovePresentation();
  if (e.key === 'ArrowRight') {
    const deck = ov.querySelector('.aic-slide-deck');
    if (deck) _slideDeckNav(deck.querySelector('.aic-slide-next'), 1);
  }
  if (e.key === 'ArrowLeft') {
    const deck = ov.querySelector('.aic-slide-deck');
    if (deck) _slideDeckNav(deck.querySelector('.aic-slide-prev'), -1);
  }
}

// Render an arbitrary FEN into the overlay board (for Tactics continuation slides)
function _mpRenderFen(fen) {
  const container = document.getElementById('mpBoardClone');
  if (!container || !fen) return;
  container.innerHTML = '';

  const g = new Chess(fen);
  const grid = g.board();
  const flipped = playerColor === 'b';

  const boardEl = document.createElement('div');
  boardEl.className = 'board mp-mini-board';

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      const cell = grid[r][c];
      if (cell) sq.appendChild(pieceImg(cell.color, cell.type));
      boardEl.appendChild(sq);
    }
  }
  container.appendChild(boardEl);
}

// Clone the current board into the overlay (with move highlights)
function _mpCloneBoard(ply) {
  const container = document.getElementById('mpBoardClone');
  if (!container) return;
  container.innerHTML = '';

  const pos = positions[ply];
  const fen = pos ? pos.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const g = new Chess(fen);
  const grid = g.board();
  const flipped = playerColor === 'b';

  const boardEl = document.createElement('div');
  boardEl.className = 'board mp-mini-board';

  const moveCls = ply > 0 ? classifyMove(ply) : null;
  const isNeutral = moveCls === 'neutral';
  const isBrill = moveCls === 'brilliant';
  const hlPrefix = isBrill ? 'brilliant' : (isNeutral ? 'neutral' : 'last');

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      const name = String.fromCharCode(97 + c) + (8 - r);
      if (ply > 0 && pos) {
        if (pos.from === name) sq.classList.add(hlPrefix + '-from');
        if (pos.to === name)   sq.classList.add(hlPrefix + '-to');
      }
      const cell = grid[r][c];
      if (cell) sq.appendChild(pieceImg(cell.color, cell.type));
      boardEl.appendChild(sq);
    }
  }
  container.appendChild(boardEl);
}

let _mpActivePly = null; // the ply the presentation is showing

function _openMovePresentation(cachedHtml, isLoading, ply) {
  const usePly = ply || currentPly;
  _mpActivePly = usePly;
  const ov = _ensureMpOverlay();
  const body = document.getElementById('mpBody');
  const badge = document.getElementById('mpBadge');
  const label = document.getElementById('mpMoveLabel');

  // Clone the board for the played-move position
  _mpCloneBoard(usePly);

  // Move label
  const pos = positions[usePly];
  const moveNum = Math.ceil(usePly / 2);
  const side = pos.turn === 'b' ? 'White' : 'Black';
  if (label) label.textContent = `Move ${moveNum}. ${side}: ${pos.san}`;

  // Badge
  const cls = classifyMove(usePly) || 'neutral';
  const clsLabel = labelFor(cls);
  if (badge) badge.innerHTML = `<span class="badge badge-${cls}">${pos.san}: ${clsLabel}</span>`;

  // Store ply on the overlay element for slide nav callbacks
  ov.setAttribute('data-ply', usePly);

  // Body
  if (isLoading) {
    body.innerHTML = '<div class="mp-loading"><span class="spinner"></span> Analyzing this move\u2026</div>';
  } else if (cachedHtml) {
    body.innerHTML = cachedHtml;
    // Reset to first slide
    const deck = body.querySelector('.aic-slide-deck');
    if (deck) _slideDeckShowSlide(deck, 0);
  }

  // Show overlay
  ov.style.display = 'flex';
  ov.classList.remove('mp-fadeout');
  requestAnimationFrame(() => ov.classList.add('mp-visible'));
}

function closeMovePresentation() {
  _mpActivePly = null;
  const ov = document.getElementById('mpOverlay');
  if (!ov) return;
  ov.classList.remove('mp-visible');
  ov.classList.add('mp-fadeout');
  setTimeout(() => {
    ov.style.display = 'none';
    ov.classList.remove('mp-fadeout');
  }, 220);
}

function explainPosition(topMovesStr) {
  const pos = positions[currentPly];
  if (!pos) return;
  setExplainContext('position');
  const ev = evals[currentPly];
  const snap = {
    fen:           pos.fen,
    turn:          pos.turn,
    eval:          fmtEval(ev),
    evalCtx:       evalContext(ev, playerColor),
    threats:       threatsSummary(pos.fen),
    topMoves:      topMovesStr || '',
    material:      materialStr(pos.fen),
    color:         playerColor
  };
  pendingExplainPromptFn = () => TEMPLATES.position({ ...snap, thoughts: getContextThoughts('position') });
}

function explainMove(topMovesStr, continuationStr, fenAfterCont) {
  if (currentPly < 1) return;
  const pos = positions[currentPly];
  const evB = evals[currentPly - 1];
  const evA = evals[currentPly];
  if (!evB || !evA) return;

  setExplainContext('move');
  const cls  = classifyMove(currentPly) || 'neutral';
  const loss = cpLoss(currentPly);
  setBadge(cls, pos.san + ': ' + labelFor(cls));

  const mover = positions[currentPly].turn === 'b' ? 'w' : 'b';
  // Threats BEFORE the move (what the mover could have done)
  const threatsBefore = threatsSummary(positions[currentPly - 1].fen);
  // Threats AFTER the move (what the opponent can now do)
  const threatsAfter  = threatsSummary(pos.fen);
  const snap = {
    fen: positions[currentPly - 1].fen,
    fenAfter: pos.fen,
    fenAfterCont: fenAfterCont || null,
    fenAfterContFinal: window._lastFenAfterContFinal || null,
    from: pos.from, to: pos.to,
    san: pos.san, eb: fmtEval(evB), ea: fmtEval(evA),
    best: evB.bestSAN || '?', loss, cls,
    bestLineSAN: evB.lineSAN || evB.bestSAN || '',
    topMoves: topMovesStr || '',
    continuation: continuationStr || '',
    threatsBefore, threatsAfter,
    color: playerColor, mover
  };
  // Full prompt (same as walkthrough) - inline "Analyze Move" extracts Best Move slide only
  const _pickTemplate = () => {
    const d = { ...snap, thoughts: getContextThoughts('move') };
    if (snap.cls === 'book')                                    return TEMPLATES.book(d);
    if (snap.cls === 'book-inaccuracy' || snap.cls === 'book-blunder') return TEMPLATES.bookBad(d);
    return ({ brilliant: TEMPLATES.brilliant, good: TEMPLATES.good, neutral: TEMPLATES.neutral,
              mistake: TEMPLATES.mistake, blunder: TEMPLATES.blunder }[snap.cls] || TEMPLATES.neutral)(d);
  };
  pendingExplainPromptFn = _pickTemplate;
  _pendingFullPromptFn = _pickTemplate;
}

// ── Per-game explain cache (one AI response per move/position per game) ──
const _explainCache = {}; // key: "move:ply" or "pos:ply" → cached HTML
const _rawReplyCache = {}; // key: ply → raw Claude markdown reply (walkthrough full 3-section)
let _pendingFullPromptFn = null; // full 3-section prompt fn (for walkthrough)
const _contFensCache = {}; // key: ply → { fens: [fen0, fen1, ...], sans: [san1, san2, ...] }
function _explainKey(type, ply) { return type + ':' + ply; }

// Compute continuation FENs + SAN labels by replaying the top line from postFen.
// Returns { fens: [postFen, fenAfter1, fenAfter2, ...], sans: [san1, san2, ...] }
// fens[0] = position after the played move; fens[k] = position after continuation move k
// sans[k-1] = SAN notation of the move that leads to fens[k]
function _computeContFens(postFen, contMoves) {
  const fens = [postFen];
  const sans = [];
  if (!contMoves || !contMoves.length || !postFen) return { fens, sans };
  try {
    const line = (contMoves[0].lineSAN || '').trim().split(/\s+/).filter(Boolean);
    console.log('[ContFens] lineSAN raw:', contMoves[0].lineSAN, '→ tokens:', line);
    const g = new Chess(postFen);
    for (const san of line) {
      const mv = g.move(san);
      if (!mv) { console.warn('[ContFens] move parse failed:', san, 'in', g.fen()); break; }
      sans.push(mv.san);
      fens.push(g.fen());
    }
    console.log('[ContFens] result:', sans.length, 'continuation moves:', sans.join(' '));
  } catch (e) { console.warn('[ContFens] error:', e); }
  return { fens, sans };
}

function resetExplainCache() {
  Object.keys(_explainCache).forEach(k => delete _explainCache[k]);
  Object.keys(_rawReplyCache).forEach(k => delete _rawReplyCache[k]);
  Object.keys(_contFensCache).forEach(k => delete _contFensCache[k]);
  updateExplainButtons();
}

// Persist AI caches (explain + breakdown) to the game record in IndexedDB
async function _persistAiCache() {
  const gid = window._lastSavedGameId;
  if (!gid) return;
  try {
    const saved = await dbLoadGame(gid);
    if (!saved) return;
    saved.explainCache = { ..._explainCache };
    if (Object.keys(_rawReplyCache).length > 0) {
      saved.rawReplyCache = { ..._rawReplyCache };
    }
    if (_breakdownCachedHtml && _breakdownCacheKey) {
      saved.breakdownHtml = _breakdownCachedHtml;
      saved.breakdownKey  = _breakdownCacheKey;
    }
    if (Object.keys(_wtCache).length > 0) {
      saved.wtCache = { ..._wtCache };
    }
    await dbSaveGame(gid, saved);
  } catch (e) { console.warn('[AiCache] persist failed:', e); }
}

// Track which view is currently active (kept for compat with navigation.js / try-move.js)
let _activeAnalysisView = null;

// Sync explain button + output panel with current cache state
function updateExplainButtons() {
  const hasFreeMoves = liveBoard.userMoves.length > 0;
  const deckKey  = _explainKey('deck', currentPly);
  const noMove   = currentPly < 1;

  // Auto-build deck from walkthrough's raw reply cache if we don't have a deck yet
  if (!hasFreeMoves && !_explainCache[deckKey] && _rawReplyCache[currentPly]) {
    _explainCache[deckKey] = _buildAnalysisSlideDeck(_rawReplyCache[currentPly]);
  }

  const deckDone = !hasFreeMoves && !!_explainCache[deckKey];

  const btn = document.getElementById('explainBtn');
  const btnGroup = btn ? btn.closest('.aic-btn-group') : null;
  const hint = document.getElementById('aicHint');
  const output = document.getElementById('aicOutput');

  if (deckDone && output) {
    // Deck ready - hide button + hint, show response filling the space
    if (btnGroup) btnGroup.style.display = 'none';
    if (hint) hint.style.display = 'none';
    output.style.display = '';
    // Build deck + continuation button
    let deckHtml = '<div class="cont-wrap"></div>';
    if (_contFensCache[currentPly] && _contFensCache[currentPly].sans.length > 0) {
      deckHtml += _contButtonHtml('handleShowContAnalysis()', 'handleHideContAnalysis()');
    }
    deckHtml += _explainCache[deckKey];
    output.innerHTML = deckHtml;
    const deck = output.querySelector('.aic-slide-deck');
    if (deck) _slideDeckShowSlide(deck, 0);
  } else if (hasFreeMoves) {
    // User is exploring free moves - show greyed-out "Back to game" button
    if (btnGroup) btnGroup.style.display = '';
    if (btn) {
      btn.style.display = '';
      btn.disabled = false;
      btn.classList.add('btn-back-to-game');
      btn.innerHTML = '&#8592; Back to game moves';
      btn.onclick = function() { liveBoardUndoAll(); };
    }
    if (output) { output.style.display = 'none'; output.innerHTML = ''; }
    if (hint) { hint.style.display = 'none'; }
  } else {
    // No deck - show Explain button centered, hide output
    if (btnGroup) btnGroup.style.display = '';
    if (btn) {
      btn.style.display = '';
      btn.disabled = noMove;
      btn.classList.remove('btn-back-to-game');
      btn.innerHTML = 'Explain';
      btn.onclick = handleExplain;
    }
    if (output) { output.style.display = 'none'; output.innerHTML = ''; }
    if (hint) {
      hint.style.display = noMove ? '' : 'none';
      hint.textContent = noMove ? 'Select a move to get started.' : '';
    }
  }
}

// Single entry point - "Explain" button click (shows full 3-slide deck)
function handleExplain() {
  // No explain for free moves - the engine bar is enough
  if (liveBoard.userMoves.length > 0) return;
  if (currentPly < 1) return;

  _activeAnalysisView = 'move'; // compat

  // On mobile, always scroll the explain output into the center of the
  // viewport so the user sees the loading state / result without having
  // to manually scroll. Runs for both cache-hit and fresh-fetch paths.
  const _scrollExplainIntoView = () => {
    if (window.innerWidth > 860) return;
    const el =
      document.getElementById('aicOutput') ||
      document.getElementById('aiCoachPanel');
    if (!el) return;
    requestAnimationFrame(() => {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      // Retry once after content renders so the final card is centered too
      setTimeout(() => {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
      }, 350);
    });
  };

  const deckKey = _explainKey('deck', currentPly);
  if (_explainCache[deckKey]) {
    updateExplainButtons();
    _scrollExplainIntoView();
    return;
  }
  _scrollExplainIntoView();
  explainMoveAndAsk();
}

// Keep old name as alias for any external callers
function handleAicAsk() { handleExplain(); }

// ── Combined explain+ask for the new layout ──
async function explainMoveAndAsk() {
  if (currentPly < 1) {
    setMoveNote('Navigate to a move first.', true);
    return;
  }
  const deckKey = _explainKey('deck', currentPly);
  if (_explainCache[deckKey]) return; // already done - safeguard only

  // Also check raw reply cache (from walkthrough)
  if (_rawReplyCache[currentPly]) {
    _explainCache[deckKey] = _buildAnalysisSlideDeck(_rawReplyCache[currentPly]);
    updateExplainButtons();
    return;
  }

  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) { setMoveNote('API key missing. Open Settings.', true); return; }

  // Hide button group, show loading in the output area
  const explainBtn = document.getElementById('explainBtn');
  const btnGroup = explainBtn ? explainBtn.closest('.aic-btn-group') : null;
  if (btnGroup) btnGroup.style.display = 'none';
  const hint = document.getElementById('aicHint');
  if (hint) hint.style.display = 'none';
  const output = document.getElementById('aicOutput');
  if (output) {
    output.style.display = '';
    output.innerHTML = '<div class="aic-loading"><span class="spinner"></span> Analyzing\u2026</div>';
    // Scroll the explain box into the center of the viewport immediately on click,
    // so the user sees the loading state (and then the result) without manual scrolling.
    requestAnimationFrame(() => {
      try { output.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
    });
  }

  // Fetch engine top moves for the position BEFORE this move (what should have been played)
  // Annotated: each half-move gets a plain-English description so Claude can read them literally.
  const preFen = positions[currentPly - 1]?.fen;
  const evBefore = evals[currentPly - 1];
  let topMovesStr = '';
  if (preFen) {
    try {
      let topMoves = await fetchTopMoves(preFen, 3);
      // ── Reconcile: board arrow always shows evBefore.bestUCI ──
      // If Lichess returns a different #1, swap so Claude agrees with the board.
      if (topMoves.length > 0 && evBefore && evBefore.bestUCI) {
        const boardBest = evBefore.bestUCI;
        const fetchedBest = topMoves[0].moveUCI;
        if (fetchedBest && fetchedBest !== boardBest) {
          const matchIdx = topMoves.findIndex(m => m.moveUCI === boardBest);
          if (matchIdx > 0) {
            // Board's move is in the list but not #1 - swap it to front
            [topMoves[0], topMoves[matchIdx]] = [topMoves[matchIdx], topMoves[0]];
            topMoves.forEach((m, i) => m.rank = i + 1);
          } else if (matchIdx === -1) {
            // Board's move isn't in the Lichess list at all - inject it as #1
            const boardSAN = evBefore.bestSAN || uciToSan(boardBest, preFen) || boardBest;
            topMoves.unshift({
              rank: 1, moveSAN: boardSAN, lineSAN: evBefore.lineSAN || boardSAN,
              moveUCI: boardBest, cp: evBefore.cp, mate: evBefore.mate
            });
            topMoves = topMoves.slice(0, 3);
            topMoves.forEach((m, i) => m.rank = i + 1);
          }
        }
      }
      topMovesStr = annotateTopMoves(preFen, topMoves);
    } catch (e) { console.warn('[TopMoves] fetch failed:', e.message); }
  }
  // Fallback: if Lichess had no multiPv data, use the cached engine best move
  if (!topMovesStr && evBefore && evBefore.bestSAN) {
    topMovesStr = annotateTopMoves(preFen, [{
      rank: 1,
      moveSAN: evBefore.bestSAN,
      lineSAN: evBefore.lineSAN || evBefore.bestSAN,
      moveUCI: evBefore.bestUCI,
      cp: evBefore.cp,
      mate: evBefore.mate
    }]);
  }

  // Fetch best continuation AFTER the move (opponent's best reply - forks, piece wins, etc.)
  // Annotated: Claude gets "Nxe5 [knight captures pawn on e5, giving check]" not raw SAN.
  const postFen = positions[currentPly]?.fen;
  const evAfter = evals[currentPly];
  let continuationStr = '';
  let _contFirstUCI = null; // track first-move UCI so we can compute fenAfterCont
  let _rawContMoves = []; // keep raw contMoves for FEN replay
  if (postFen) {
    try {
      const contMoves = await fetchTopMoves(postFen, 3);
      _rawContMoves = contMoves;
      console.log('[Explain] contMoves for postFen:', contMoves.length, 'lines; top lineSAN:', contMoves[0]?.lineSAN);
      continuationStr = annotateTopMoves(postFen, contMoves);
      if (contMoves.length > 0) _contFirstUCI = contMoves[0].moveUCI || null;
    } catch (e) { console.warn('[Continuation] fetch failed:', e.message); }
  }
  if (!continuationStr && evAfter && evAfter.bestSAN) {
    continuationStr = annotateTopMoves(postFen, [{
      rank: 1,
      moveSAN: evAfter.bestSAN,
      lineSAN: evAfter.lineSAN || evAfter.bestSAN,
      moveUCI: evAfter.bestUCI,
      cp: evAfter.cp,
      mate: evAfter.mate
    }]);
    _contFirstUCI = _contFirstUCI || evAfter.bestUCI || null;
  }
  // Last-resort fallback: derive SAN from UCI if bestSAN is missing but bestUCI exists
  if (!continuationStr && evAfter && evAfter.bestUCI && postFen) {
    const derivedSAN = uciToSan(evAfter.bestUCI, postFen);
    if (derivedSAN) {
      continuationStr = annotateTopMoves(postFen, [{
        rank: 1,
        moveSAN: derivedSAN,
        lineSAN: derivedSAN,
        moveUCI: evAfter.bestUCI,
        cp: evAfter.cp,
        mate: evAfter.mate
      }]);
      _contFirstUCI = _contFirstUCI || evAfter.bestUCI;
    }
  }
  // Absolute fallback: inject a bare eval note so Claude never says "without annotations"
  if (!continuationStr && evAfter) {
    const cp = evAfter.cp;
    const evalNote = (cp !== undefined && cp !== null)
      ? `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)} (${cp > 60 ? 'White is better' : cp < -60 ? 'Black is better' : 'roughly equal'})`
      : 'unknown';
    continuationStr = `  (No continuation moves available for this position. Engine evaluation: ${evalNote}.)`;
  }

  // ── Compute the FEN after the continuation's first move ──
  // This lets moveDetail run pawnStructureNotes one half-move deeper, catching
  // structural changes (e.g. doubled pawns from bxc6) that bxc6 creates.
  let fenAfterCont = null;
  if (_contFirstUCI && postFen) {
    try {
      const g = new Chess(postFen);
      const mv = g.move({
        from: _contFirstUCI.slice(0, 2),
        to:   _contFirstUCI.slice(2, 4),
        promotion: _contFirstUCI[4] || undefined
      });
      if (mv) fenAfterCont = g.fen();
    } catch (_) { /* ignore - fenAfterCont stays null */ }
  }

  // Compute & cache continuation FENs for Tactics board slides
  if (!_rawContMoves.length && evAfter && (evAfter.lineSAN || evAfter.bestSAN)) {
    const fallbackLine = evAfter.lineSAN || evAfter.bestSAN;
    console.log('[Explain] fallback: using eval PV for contFens:', fallbackLine);
    _rawContMoves = [{ rank: 1, lineSAN: fallbackLine, moveUCI: evAfter.bestUCI, cp: evAfter.cp, mate: evAfter.mate }];
  }
  const _contData = _computeContFens(postFen, _rawContMoves);
  _contFensCache[currentPly] = _contData;

  // FEN after the FULL continuation line - lets Claude see the final material
  // balance once recaptures have settled (so it doesn't claim someone is up
  // material when the next move recaptures it).
  const fenAfterContFinal = (_contData && _contData.fens && _contData.fens.length > 1)
    ? _contData.fens[_contData.fens.length - 1]
    : null;
  window._lastFenAfterContFinal = fenAfterContFinal;

  explainMove(topMovesStr, continuationStr, fenAfterCont);
  if (!pendingExplainPromptFn) return;

  try {
    const reply = await callClaude(pendingExplainPromptFn(), key);
    // Cache raw reply for walkthrough to reuse
    _rawReplyCache[currentPly] = reply;
    // Build full 3-slide deck (identical to walkthrough), cache it for both buttons
    const deckHtml = _buildAnalysisSlideDeck(reply);
    const deckKey = _explainKey('deck', currentPly);
    _explainCache[deckKey] = deckHtml;
    // Show the deck starting at Overview (slide 0) - user navigates with dots/arrows
    if (output) {
      output.innerHTML = deckHtml;
      const deck = output.querySelector('.aic-slide-deck');
      if (deck) _slideDeckShowSlide(deck, 0);
    }
    updateExplainButtons();
    _persistAiCache();
  } catch (err) {
    if (output) output.innerHTML = `<div class="aic-error">Error: ${err.message}</div>`;
  }
}

// ── Build the full 3-slide deck from a raw Claude reply (identical to walkthrough) ──
// Returns HTML for the complete slide deck with navigation.
function _buildAnalysisSlideDeck(rawReply) {
  let html = marked.parse(rawReply).replace(/\s*[-–]\s*/g, ', ');

  function chipify(h) {
    return h.replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)\b/g,
      (m) => `<span class="aic-move-chip">${m}</span>`);
  }
  function getSectionMeta(headingText) {
    const t = (headingText || '').toLowerCase().trim();
    if (t === 'overview')     return { secCls: 'sec-overview',  icon: '\u2654', label: 'Overview' };
    if (t === 'structure')    return { secCls: 'sec-structure',  icon: '\u2659', label: 'Structure' };
    if (t === 'tactics')      return { secCls: 'sec-tactics',   icon: '\u2655', label: 'Best Move' };
    if (t === 'best move')    return { secCls: 'sec-tactics',   icon: '\u2655', label: 'Best Move' };
    if (t === 'continuation') return { secCls: 'sec-continuation', icon: '\u2657', label: 'Continuation' };
    return null;
  }

  const div = document.createElement('div');
  div.innerHTML = html;
  const namedSections = [];
  let curSec = null;
  for (const node of div.children) {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      if (curSec) namedSections.push(curSec);
      const meta = getSectionMeta(node.textContent);
      curSec = meta ? { meta, headText: node.textContent.trim(), children: [] } : null;
    } else if (curSec) {
      curSec.children.push(node);
    }
  }
  if (curSec) namedSections.push(curSec);

  if (namedSections.length === 0) return `<div class="aic-sentence">${chipify(html)}</div>`;
  return _buildSlideDeck(namedSections, chipify, 'aic');
}

// ── Show the slide deck navigated to a specific slide ──
// slideTarget: 'overview' (slide 0), 'structure' (slide 1), 'best move' (slide 2)
function _showDeckAtSlide(deckHtml, slideTarget) {
  const SLIDE_MAP = { 'overview': 0, 'position': 0, 'structure': 1, 'best move': 2, 'move': 2 };
  const idx = SLIDE_MAP[(slideTarget || '').toLowerCase()] || 0;

  // Parse to find the deck and jump to the right slide
  const wrap = document.createElement('div');
  wrap.innerHTML = deckHtml;
  const deck = wrap.querySelector('.aic-slide-deck');
  if (deck) {
    _slideDeckShowSlide(deck, idx);
    return wrap.innerHTML;
  }
  return deckHtml;
}

// ── Inline position explanation (for the "Explain Position" button) ──
// Keep old name as alias for compat
function handlePositionExplain() { handleExplain(); }

async function explainPositionAndAsk() {
  const cacheKey = _explainKey('pos', currentPly);
  if (_explainCache[cacheKey]) return; // already done - button is disabled, this is a safeguard

  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) { setNote('API key missing. Open Settings.', true); return; }
  setNote('<span class="spinner"></span> Asking Claude\u2026', false, true);

  // Fetch engine top moves for the current position (best continuations)
  const curFen = positions[currentPly]?.fen;
  const evCurrent = evals[currentPly];
  let topMovesStr = '';
  if (curFen) {
    try {
      const topMoves = await fetchTopMoves(curFen, 3);
      topMovesStr = formatTopMoves(topMoves);
    } catch (e) { console.warn('[TopMoves] fetch failed:', e.message); }
  }
  // Fallback: if Lichess had no multiPv data, use the cached engine best move
  if (!topMovesStr && evCurrent && evCurrent.bestSAN) {
    topMovesStr = formatTopMoves([{
      rank: 1,
      moveSAN: evCurrent.bestSAN,
      lineSAN: evCurrent.bestSAN,
      moveUCI: evCurrent.bestUCI,
      cp: evCurrent.cp,
      mate: evCurrent.mate
    }]);
  }

  explainPosition(topMovesStr);
  if (!pendingExplainPromptFn) return;
  try {
    const reply = await callClaude(pendingExplainPromptFn(), key);
    const rich  = renderAicRich(marked.parse(reply), null);
    _explainCache[cacheKey] = rich;
    if (_aicActiveTab === 'pos') setAicOutput(rich, false);
    updateExplainButtons();
    _persistAiCache();
  } catch (err) {
    setAicOutput('', true, 'Error: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════
//  COACH PRESENTATION MODE
//  Parses rich HTML into slides and shows them fullscreen.
//  One section = one slide. Click or Next → advance.
// ══════════════════════════════════════════════════════

let _cpoSlides = [];
let _cpoIdx    = 0;
let _cpoLastHtml = '';  // stored so "Present again" can replay without args

// Injects a "▶ Present again" button above rendered rich content
function _injectReplayBtn(html) {
  return `<button class="aic-replay-btn" onclick="launchCoachPresentation(_cpoLastHtml)">&#9654;&nbsp;Present again</button>${html}`;
}

// Parse rendered rich HTML into an array of slide objects:
// { header: html|null, badge: html|null, body: [html, ...] }
function buildCoachSlides(richHtml) {
  const wrap = document.createElement('div');
  wrap.innerHTML = richHtml;
  const block = wrap.querySelector('.aic-rich-block') || wrap;

  const slides  = [];
  let cur       = null;
  let badgeHtml = '';

  for (const node of Array.from(block.children)) {
    const isBadge = node.classList.contains('aic-eval-pill') ||
                    node.classList.contains('aic-class-row');
    const isHead  = node.classList.contains('aic-section-head');

    if (isBadge) {
      badgeHtml += node.outerHTML;     // collect badges for first/next slide
    } else if (isHead) {
      if (cur) slides.push(cur);
      cur = { header: node.outerHTML, badge: badgeHtml, body: [] };
      badgeHtml = '';
    } else {
      if (!cur) { cur = { header: null, badge: badgeHtml, body: [] }; badgeHtml = ''; }
      cur.body.push(node.outerHTML);
    }
  }
  if (cur) slides.push(cur);

  // If only one headerless slide (all content lumped together), split each body item into its own slide
  const hasHeaders = slides.some(s => s.header);
  if (!hasHeaders) {
    const all = slides.flatMap(s => s.body);
    return all.map(html => ({ header: null, badge: '', body: [html] }));
  }

  return slides;
}

function launchCoachPresentation(richHtml) {
  _cpoLastHtml = richHtml;
  _cpoSlides = buildCoachSlides(richHtml);
  if (!_cpoSlides.length) return;
  _cpoIdx = 0;

  // Build overlay once
  let overlay = document.getElementById('coachPresOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'coachPresOverlay';
    overlay.className = 'cpo-overlay';
    overlay.innerHTML = `
      <div class="cpo-card" id="cpoCard" onclick="event.stopPropagation()">
        <button class="cpo-close" onclick="closeCoachPresentation()" title="Close (Esc)">&#10005;</button>
        <div class="cpo-badge-area"  id="cpoBadge"></div>
        <div class="cpo-header-area" id="cpoHeader"></div>
        <div class="cpo-body"        id="cpoBody"></div>
        <div class="cpo-footer">
          <div class="cpo-dots" id="cpoDots"></div>
          <button class="cpo-next-btn" id="cpoNextBtn" onclick="cpoAdvance()">Next &#8594;</button>
        </div>
      </div>
      <div class="cpo-click-hint">click anywhere to continue</div>
    `;
    overlay.addEventListener('click', cpoAdvance);
    document.body.appendChild(overlay);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeCoachPresentation();
      if (e.key === 'ArrowRight' || e.key === ' ') {
        const o = document.getElementById('coachPresOverlay');
        if (o && o.style.display !== 'none') { e.preventDefault(); cpoAdvance(); }
      }
    });
  }

  overlay.style.display = 'flex';
  overlay.classList.remove('cpo-fadeout');
  _cpoRenderSlide(0);
}

function _cpoRenderSlide(idx) {
  const slide = _cpoSlides[idx];
  if (!slide) { closeCoachPresentation(); return; }
  _cpoIdx = idx;

  const card    = document.getElementById('cpoCard');
  const badgeEl = document.getElementById('cpoBadge');
  const headEl  = document.getElementById('cpoHeader');
  const bodyEl  = document.getElementById('cpoBody');
  const dotsEl  = document.getElementById('cpoDots');
  const nextEl  = document.getElementById('cpoNextBtn');

  // Animate card
  card.classList.remove('cpo-animate');
  void card.offsetWidth;
  card.classList.add('cpo-animate');

  badgeEl.innerHTML  = slide.badge  || '';
  badgeEl.style.display = slide.badge ? '' : 'none';

  headEl.innerHTML   = slide.header || '';
  headEl.style.display = slide.header ? '' : 'none';

  bodyEl.innerHTML   = slide.body.join('');
  bodyEl.scrollTop   = 0;

  // Progress dots
  dotsEl.innerHTML = _cpoSlides.map((_, i) =>
    `<span class="cpo-dot${i === idx ? ' active' : ''}"
      onclick="event.stopPropagation(); _cpoRenderSlide(${i})"></span>`
  ).join('');

  const isLast = idx === _cpoSlides.length - 1;
  nextEl.textContent = isLast ? 'Done \u2713' : 'Next \u2192';
  nextEl.classList.toggle('cpo-done', isLast);
}

function cpoAdvance() {
  if (_cpoIdx + 1 >= _cpoSlides.length) {
    closeCoachPresentation();
  } else {
    _cpoRenderSlide(_cpoIdx + 1);
  }
}

function closeCoachPresentation() {
  const overlay = document.getElementById('coachPresOverlay');
  if (!overlay || overlay.style.display === 'none') return;
  overlay.classList.add('cpo-fadeout');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('cpo-fadeout');
  }, 220);
}

function setMoveNote(text, dim = false, html = false) {
  if (_aicActiveTab !== 'move') return;
  // Show notes in the hint area (not the overlay)
  const hint = document.getElementById('aicHint');
  if (!hint) return;
  if (dim) { hint.style.display = ''; hint.textContent = text; }
  else { hint.style.display = ''; if (html) hint.innerHTML = text; else hint.textContent = text; }
}

// ── Full Game Breakdown cache - one result per loaded game ──
let _breakdownCachedHtml = null;  // cached rich HTML
let _breakdownCacheKey  = null;   // PGN hash used as key

function _bdCacheKey() {
  // Use move list as a simple fingerprint
  return positions.slice(1).map(p => p.san).join(',');
}

// ==============================================================
//  GAME WALKTHROUGH - interactive overlay with board + AI coach
// ==============================================================
let _wtSteps = [];       // array of walkthrough step objects
let _wtIdx = 0;          // current step index
let _wtActive = false;   // is walkthrough running
let _wtCache = {};       // cache AI explanations per step key

// Collect the top 3 best and worst 3 moves for the walkthrough
function _wtCollectHighlights() {
  const best = [], worst = [];
  for (let i = 1; i < positions.length; i++) {
    const mover = positions[i].turn === 'b' ? 'w' : 'b';
    if (mover !== playerColor) continue;
    const cls = classifyMove(i);
    if (!cls) continue;
    const loss = cpLoss(i);
    const moveNum = Math.ceil(i / 2);
    // Skip pure book moves in the first 6 moves - they're just theory, not teaching moments
    if (cls === 'book' && moveNum <= 6) continue;
    if (cls === 'brilliant') best.push({ ply: i, cls, loss, score: -1000 }); // brilliant always top
    else if (cls === 'good' || cls === 'book') best.push({ ply: i, cls, loss, score: loss });
    else if (cls === 'blunder') worst.push({ ply: i, cls, loss, score: loss });
    else if (cls === 'mistake') worst.push({ ply: i, cls, loss, score: loss });
  }
  // Sort: best = lowest loss (brilliant first); worst = highest loss
  best.sort((a, b) => a.score - b.score);
  worst.sort((a, b) => b.score - a.score);

  return { best: best.slice(0, 3), worst: worst.slice(0, 3) };
}

// Build the walkthrough steps: intro → worst moves → best moves → outro
function _wtBuildSteps() {
  const { best, worst } = _wtCollectHighlights();
  const steps = [];

  // Step 0: Intro
  steps.push({ type: 'intro', ply: 0 });

  // Worst moves (in game order)
  const worstSorted = worst.sort((a, b) => a.ply - b.ply);
  worstSorted.forEach(m => {
    steps.push({ type: 'move', ply: m.ply, cls: m.cls, loss: m.loss, category: 'worst', askThought: false });
  });

  // Best moves (in game order)
  const bestSorted = best.sort((a, b) => a.ply - b.ply);
  bestSorted.forEach(m => {
    steps.push({ type: 'move', ply: m.ply, cls: m.cls, loss: m.loss, category: 'best', askThought: false });
  });

  // Outro
  steps.push({ type: 'outro', ply: positions.length - 1 });

  return steps;
}

// Multiple choice options for "What were you thinking?"
function _wtThoughtOptions(step) {
  if (step.category === 'worst') {
    return [
      { id: 'didnt-see', text: "I didn't see the threat" },
      { id: 'time-pressure', text: "I was in time pressure" },
      { id: 'wrong-plan', text: "I had a different plan in mind" },
      { id: 'thought-good', text: "I thought it was a good move" }
    ];
  } else {
    return [
      { id: 'calculated', text: "I calculated it through" },
      { id: 'intuition', text: "It felt right intuitively" },
      { id: 'only-move', text: "It seemed like the only move" },
      { id: 'lucky', text: "Honestly, I got a bit lucky" }
    ];
  }
}

// Launch the walkthrough
function launchWalkthrough() {
  if (positions.length < 3) return;
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) { alert('API key missing. Open Settings.'); return; }

  _wtSteps = _wtBuildSteps();
  _wtIdx = 0;
  _wtActive = true;
  // Preserve any previously saved entries - only clear if no persisted cache exists

  // Build overlay if it doesn't exist
  let overlay = document.getElementById('wtOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'wtOverlay';
    overlay.className = 'wt-overlay';
    overlay.innerHTML = `
      <div class="wt-backdrop"></div>
      <div class="wt-layout">
        <div class="wt-board-spotlight" id="wtBoardSpot">
          <div class="wt-board-clone" id="wtBoardClone"></div>
          <div class="wt-board-nav">
            <span class="wt-move-label" id="wtMoveLabel"></span>
          </div>
        </div>
        <div class="wt-coach-panel" id="wtCoachPanel">
          <div class="wt-coach-header">
            <div class="wt-coach-avatar" id="wtCoachAvatar"></div>
            <div class="wt-coach-title" id="wtCoachTitle"></div>
            <button class="wt-close" onclick="closeWalkthrough()" title="Close walkthrough">&times;</button>
          </div>
          <div class="wt-coach-badge" id="wtCoachBadge"></div>
          <div class="wt-coach-body" id="wtCoachBody"></div>
          <div class="wt-thought-area" id="wtThoughtArea" style="display:none"></div>
          <div class="wt-coach-footer">
            <div class="wt-progress" id="wtProgress"></div>
            <div class="wt-actions">
              <button class="wt-btn-back" id="wtBtnBack" onclick="wtBack()">&#8592; Back</button>
              <button class="wt-btn-next" id="wtBtnNext" onclick="wtNext()">Next &#8594;</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.addEventListener('keydown', _wtKeyHandler);
  }

  overlay.style.display = 'flex';
  overlay.classList.remove('wt-fadeout');
  requestAnimationFrame(() => overlay.classList.add('wt-visible'));

  // iOS Safari: nudge the page so the address bar / bottom toolbar
  // collapse, giving the walkthrough the full viewport instead of
  // the cramped "small viewport" with browser chrome visible.
  if (window.innerWidth <= 860) {
    try {
      window.scrollTo(0, 1);
      setTimeout(() => window.scrollTo(0, 1), 50);
    } catch (e) {}
  }

  _wtRenderStep(0);
}

function _wtKeyHandler(e) {
  if (!_wtActive) return;
  if (e.key === 'Escape') closeWalkthrough();
  if (e.key === 'ArrowRight') wtNext();
  if (e.key === 'ArrowLeft') wtBack();
}

// Close walkthrough
function closeWalkthrough() {
  _wtActive = false;
  const overlay = document.getElementById('wtOverlay');
  if (!overlay) return;
  overlay.classList.remove('wt-visible');
  overlay.classList.add('wt-fadeout');
  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('wt-fadeout');
  }, 250);
}

// Navigate
function wtNext() {
  // If thought area is visible and unanswered, don't proceed (but skip btn exists)
  if (_wtIdx + 1 >= _wtSteps.length) {
    closeWalkthrough();
    return;
  }
  _wtRenderStep(_wtIdx + 1);
}
function wtBack() {
  if (_wtIdx <= 0) return;
  _wtRenderStep(_wtIdx - 1);
}

// Render a mini-board into the walkthrough spotlight
// Render an arbitrary FEN into the walkthrough board (for Tactics continuation slides)
function _wtRenderFen(fen) {
  const container = document.getElementById('wtBoardClone');
  if (!container || !fen) return;
  container.innerHTML = '';

  const g = new Chess(fen);
  const grid = g.board();
  const flipped = playerColor === 'b';

  const boardEl = document.createElement('div');
  boardEl.className = 'board wt-mini-board';

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      const cell = grid[r][c];
      if (cell) sq.appendChild(pieceImg(cell.color, cell.type));
      boardEl.appendChild(sq);
    }
  }
  container.appendChild(boardEl);
}

function _wtCloneBoard(ply) {
  // Navigate main board to this ply first (for consistency)
  goTo(ply);

  const container = document.getElementById('wtBoardClone');
  container.innerHTML = '';

  const pos = positions[ply];
  const fen = pos ? pos.fen : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const g = new Chess(fen);
  const grid = g.board();
  const flipped = playerColor === 'b';

  const boardEl = document.createElement('div');
  boardEl.className = 'board wt-mini-board';

  const moveCls = ply > 0 ? classifyMove(ply) : null;
  const isNeutral = moveCls === 'neutral';
  const isBrill = moveCls === 'brilliant';
  const hlPrefix = isBrill ? 'brilliant' : (isNeutral ? 'neutral' : 'last');

  for (let ri = 0; ri < 8; ri++) {
    for (let ci = 0; ci < 8; ci++) {
      const r = flipped ? 7 - ri : ri;
      const c = flipped ? 7 - ci : ci;
      const sq = document.createElement('div');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');

      const name = String.fromCharCode(97 + c) + (8 - r);

      // Last move highlight
      if (ply > 0 && pos) {
        if (pos.from === name) sq.classList.add(hlPrefix + '-from');
        if (pos.to === name)   sq.classList.add(hlPrefix + '-to');
      }

      const cell = grid[r][c];
      if (cell) {
        const img = pieceImg(cell.color, cell.type);
        sq.appendChild(img);
      }

      boardEl.appendChild(sq);
    }
  }

  container.appendChild(boardEl);
}

// Render a walkthrough step
function _wtRenderStep(idx) {
  _wtIdx = idx;
  const step = _wtSteps[idx];
  if (!step) return;

  const panel = document.getElementById('wtCoachPanel');
  const body = document.getElementById('wtCoachBody');
  const badge = document.getElementById('wtCoachBadge');
  const title = document.getElementById('wtCoachTitle');
  const avatar = document.getElementById('wtCoachAvatar');
  const thoughtArea = document.getElementById('wtThoughtArea');
  const moveLabel = document.getElementById('wtMoveLabel');
  const btnBack = document.getElementById('wtBtnBack');
  const btnNext = document.getElementById('wtBtnNext');
  const progress = document.getElementById('wtProgress');

  // Animate panel
  panel.classList.remove('wt-panel-animate');
  void panel.offsetWidth;
  panel.classList.add('wt-panel-animate');

  // Hide thought area by default
  thoughtArea.style.display = 'none';
  thoughtArea.innerHTML = '';

  // Progress dots
  progress.innerHTML = _wtSteps.map((_, i) =>
    `<span class="wt-dot${i === idx ? ' active' : ''}${i < idx ? ' done' : ''}"></span>`
  ).join('');

  // Back/Next buttons
  btnBack.style.display = idx > 0 ? '' : 'none';
  const isLast = idx === _wtSteps.length - 1;
  btnNext.innerHTML = isLast ? 'Finish &#10003;' : 'Next &#8594;';
  btnNext.classList.toggle('wt-btn-finish', isLast);

  // Personality
  const pers = currentPersonality?.primary;
  avatar.textContent = pers?.emoji || '\u2654';

  // Tag overlay with current step type so CSS can adjust per-slide
  const _wtOv = document.getElementById('wtOverlay');
  if (_wtOv) {
    _wtOv.classList.remove('wt-step-intro', 'wt-step-outro', 'wt-step-move');
    _wtOv.classList.add('wt-step-' + step.type);
  }

  if (step.type === 'intro') {
    _wtCloneBoard(0);
    title.textContent = 'Game Walkthrough';
    badge.innerHTML = '';
    moveLabel.textContent = 'Starting position';

    const result = _wtGetResult();
    const totalMoves = Math.ceil((positions.length - 1) / 2);
    const { best, worst } = _wtCollectHighlights();

    body.innerHTML = `
      <div class="wt-intro-card">
        <div class="wt-intro-icon">${pers?.emoji || '\u2658'}</div>
        <h2 class="wt-intro-title">Let's walk through your game</h2>
        <p class="wt-intro-sub">${totalMoves} moves played &middot; ${result}</p>
        <div class="wt-intro-plan">
          <div class="wt-plan-item wt-plan-worst"><span class="wt-plan-count">${worst.length}</span><span class="wt-plan-label">Critical moments</span></div>
          <div class="wt-plan-item wt-plan-best"><span class="wt-plan-count">${best.length}</span><span class="wt-plan-label">Best moments</span></div>
        </div>
        <p class="wt-intro-hint">I'll show you the key moments and explain what happened.</p>
      </div>`;

  } else if (step.type === 'outro') {
    _wtCloneBoard(positions.length - 1);
    title.textContent = 'Game Complete';
    badge.innerHTML = '';
    moveLabel.textContent = 'Final position';

    const result = _wtGetResult();
    body.innerHTML = `
      <div class="wt-outro-card">
        <div class="wt-outro-icon">\u2654</div>
        <h2 class="wt-outro-title">${result}</h2>
        <p class="wt-outro-sub">That's the walkthrough! You reviewed the key moments of your game.</p>
        <button class="wt-coach-cta" onclick="closeWalkthrough();openCoachPage()">
          <span class="wt-coach-cta-icon">\u2654</span>
          <span class="wt-coach-cta-text">
            <strong>Get Your Coaching Plan</strong>
            <span>Personalized tips based on your chess personality</span>
          </span>
          <span class="wt-coach-cta-arrow">→</span>
        </button>
      </div>`;

  } else if (step.type === 'move') {
    _wtCloneBoard(step.ply);
    const san = positions[step.ply].san;
    const moveNum = Math.ceil(step.ply / 2);
    const side = positions[step.ply].turn === 'b' ? 'White' : 'Black';
    moveLabel.textContent = `Move ${moveNum}. ${side}: ${san}`;

    // Badge - removed to save space (info already in header title)
    badge.innerHTML = '';

    // Title based on category
    if (step.category === 'worst') {
      title.textContent = step.cls === 'blunder' ? '\u265A Critical Blunder' : '\u265A Mistake';
    } else {
      title.textContent = step.cls === 'brilliant' ? '\u2655 Brilliant Move!' : '\u2713 Great Move';
    }

    // Load AI explanation (cached or fresh)
    const cacheKey = `wt:${step.ply}:${step.cls}`;
    const contBtnHtml = (_contFensCache[step.ply] && _contFensCache[step.ply].sans.length > 0)
      ? _contButtonHtml(`handleShowContWt(${step.ply})`, `handleHideContWt(${step.ply})`)
      : '';
    if (_wtCache[cacheKey]) {
      body.innerHTML = _wtCache[cacheKey] + '<div class="cont-wrap"></div>' + contBtnHtml;
    } else {
      body.innerHTML = '<div class="wt-loading"><span class="spinner"></span> Analyzing this move...</div>';
      _wtFetchExplanation(step, cacheKey).then(html => {
        if (_wtIdx === idx) { // still on same step
          // Re-check cont data (may have been computed during fetch)
          const freshContBtn = (_contFensCache[step.ply] && _contFensCache[step.ply].sans.length > 0)
            ? _contButtonHtml(`handleShowContWt(${step.ply})`, `handleHideContWt(${step.ply})`)
            : '';
          body.innerHTML = html + '<div class="cont-wrap"></div>' + freshContBtn;
        }
      });
    }
  }
}

function _wtGetResult() {
  const lastG = new Chess(positions[positions.length - 1].fen);
  if (lastG.in_checkmate()) return lastG.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  if (lastG.in_stalemate()) return 'Draw by stalemate';
  if (lastG.in_draw()) return 'Draw';
  return 'Game ended';
}

// ── Walkthrough slide renderer ──────────────────────────────────────
// Reuses the shared _buildSlideDeck with 'wt' prefix.
function _renderWtSlides(rawHtml) {
  rawHtml = rawHtml.replace(/\s*[-–]\s*/g, ', ');

  function chipify(html) {
    return html.replace(/\b([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|O-O-O|O-O)\b/g,
      (m) => `<span class="aic-move-chip">${m}</span>`);
  }

  function getSectionMeta(headingText) {
    const t = (headingText || '').toLowerCase().trim();
    if (t === 'overview')     return { secCls: 'sec-overview',     icon: '\u2654', label: 'Overview' };
    if (t === 'structure')    return { secCls: 'sec-structure',     icon: '\u2659', label: 'Structure' };
    if (t === 'tactics')      return { secCls: 'sec-tactics',      icon: '\u2655', label: 'Best Move' };
    if (t === 'best move')    return { secCls: 'sec-tactics',      icon: '\u2655', label: 'Best Move' };
    if (t === 'continuation') return { secCls: 'sec-continuation',  icon: '\u2657', label: 'Continuation' };
    return null;
  }

  const div = document.createElement('div');
  div.innerHTML = rawHtml;

  const namedSections = [];
  let curSec = null;
  for (const node of div.children) {
    const tag = node.tagName?.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      if (curSec) namedSections.push(curSec);
      const meta = getSectionMeta(node.textContent);
      curSec = meta ? { meta, headText: node.textContent.trim(), children: [] } : null;
    } else if (curSec) {
      curSec.children.push(node);
    }
  }
  if (curSec) namedSections.push(curSec);

  if (namedSections.length === 0) {
    return `<div class="wt-slides-fallback">${chipify(rawHtml)}</div>`;
  }

  return _buildSlideDeck(namedSections, chipify, 'wt');
}

// Fetch AI explanation for a walkthrough move
async function _wtFetchExplanation(step, cacheKey) {
  try {
    // ── Check shared raw reply cache (reuse analysis explanation) ──
    if (_rawReplyCache[step.ply]) {
      const html = _renderWtSlides(marked.parse(_rawReplyCache[step.ply]));
      _wtCache[cacheKey] = html;
      return html;
    }

    const key = document.getElementById('apiKey')?.value?.trim() || '';
    const pos = positions[step.ply];
    const evB = evals[step.ply - 1];
    const evA = evals[step.ply];
    if (!evB || !evA) return '<p>No engine evaluation available for this move.</p>';

    const mover = pos.turn === 'b' ? 'w' : 'b';

    // Get top moves for context - annotated so Claude gets plain-English move descriptions
    const preFen = positions[step.ply - 1]?.fen;
    let topMovesStr = '';
    if (preFen) {
      try {
        let topMoves = await fetchTopMoves(preFen, 3);
        // ── Reconcile: board arrow always shows evB.bestUCI ──
        if (topMoves.length > 0 && evB && evB.bestUCI) {
          const boardBest = evB.bestUCI;
          const fetchedBest = topMoves[0].moveUCI;
          if (fetchedBest && fetchedBest !== boardBest) {
            const matchIdx = topMoves.findIndex(m => m.moveUCI === boardBest);
            if (matchIdx > 0) {
              [topMoves[0], topMoves[matchIdx]] = [topMoves[matchIdx], topMoves[0]];
              topMoves.forEach((m, i) => m.rank = i + 1);
            } else if (matchIdx === -1) {
              const boardSAN = evB.bestSAN || uciToSan(boardBest, preFen) || boardBest;
              topMoves.unshift({
                rank: 1, moveSAN: boardSAN, lineSAN: evB.lineSAN || boardSAN,
                moveUCI: boardBest, cp: evB.cp, mate: evB.mate
              });
              topMoves = topMoves.slice(0, 3);
              topMoves.forEach((m, i) => m.rank = i + 1);
            }
          }
        }
        topMovesStr = annotateTopMoves(preFen, topMoves);
      } catch (e) { console.warn('[WT TopMoves]', e.message); }
    }
    if (!topMovesStr && evB.bestSAN) {
      topMovesStr = annotateTopMoves(preFen, [{
        rank: 1, moveSAN: evB.bestSAN, lineSAN: evB.lineSAN || evB.bestSAN,
        moveUCI: evB.bestUCI, cp: evB.cp, mate: evB.mate
      }]);
    }
    // Last-resort: derive SAN from UCI
    if (!topMovesStr && evB.bestUCI && preFen) {
      const derivedSAN = uciToSan(evB.bestUCI, preFen);
      if (derivedSAN) {
        topMovesStr = annotateTopMoves(preFen, [{
          rank: 1, moveSAN: derivedSAN, lineSAN: derivedSAN,
          moveUCI: evB.bestUCI, cp: evB.cp, mate: evB.mate
        }]);
      }
    }

    // Continuation after the move - what is the best reply?
    const postFen = pos.fen;
    let continuationStr = '';
    let _wtContFirstUCI = null;
    let _wtRawContMoves = [];
    try {
      const contMoves = await fetchTopMoves(postFen, 3);
      _wtRawContMoves = contMoves;
      continuationStr = annotateTopMoves(postFen, contMoves);
      if (contMoves.length > 0) _wtContFirstUCI = contMoves[0].moveUCI || null;
    } catch (e) { console.warn('[WT Continuation]', e.message); }
    if (!continuationStr && evA.bestSAN) {
      continuationStr = annotateTopMoves(postFen, [{
        rank: 1, moveSAN: evA.bestSAN, lineSAN: evA.lineSAN || evA.bestSAN,
        moveUCI: evA.bestUCI, cp: evA.cp, mate: evA.mate
      }]);
      _wtContFirstUCI = _wtContFirstUCI || evA.bestUCI || null;
    }
    if (!continuationStr && evA.bestUCI) {
      const derivedSAN = uciToSan(evA.bestUCI, postFen);
      if (derivedSAN) {
        continuationStr = annotateTopMoves(postFen, [{
          rank: 1, moveSAN: derivedSAN, lineSAN: derivedSAN,
          moveUCI: evA.bestUCI, cp: evA.cp, mate: evA.mate
        }]);
        _wtContFirstUCI = _wtContFirstUCI || evA.bestUCI;
      }
    }
    if (!continuationStr && evA) {
      const cp = evA.cp;
      const evalNote = (cp !== undefined && cp !== null)
        ? `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
        : 'unknown';
      continuationStr = `  (No continuation moves available. Engine evaluation: ${evalNote}.)`;
    }

    // Compute FEN after the continuation's first move (for deeper pawn structure analysis)
    let wtFenAfterCont = null;
    if (_wtContFirstUCI && postFen) {
      try {
        const g = new Chess(postFen);
        const mv = g.move({ from: _wtContFirstUCI.slice(0,2), to: _wtContFirstUCI.slice(2,4), promotion: _wtContFirstUCI[4] || undefined });
        if (mv) wtFenAfterCont = g.fen();
      } catch (_) {}
    }

    // Compute & cache continuation FENs for Tactics board slides
    if (!_wtRawContMoves.length && evA && (evA.lineSAN || evA.bestSAN)) {
      const wtFallbackLine = evA.lineSAN || evA.bestSAN;
      _wtRawContMoves = [{ rank: 1, lineSAN: wtFallbackLine, moveUCI: evA.bestUCI, cp: evA.cp, mate: evA.mate }];
    }
    const _wtContData = _computeContFens(postFen, _wtRawContMoves);
    _contFensCache[step.ply] = _wtContData;
    const wtFenAfterContFinal = (_wtContData && _wtContData.fens && _wtContData.fens.length > 1)
      ? _wtContData.fens[_wtContData.fens.length - 1]
      : null;

    // Compute threats for full context (same as main analysis)
    const wtThreatsBefore = threatsSummary(positions[step.ply - 1].fen);
    const wtThreatsAfter  = threatsSummary(pos.fen);

    const snap = {
      fen: positions[step.ply - 1].fen, fenAfter: pos.fen,
      fenAfterCont: wtFenAfterCont,
      fenAfterContFinal: wtFenAfterContFinal,
      from: pos.from, to: pos.to, san: pos.san,
      eb: fmtEval(evB), ea: fmtEval(evA),
      best: evB.bestSAN || '?', loss: step.loss, cls: step.cls,
      bestLineSAN: evB.lineSAN || evB.bestSAN || '',
      topMoves: topMovesStr, continuation: continuationStr,
      threatsBefore: wtThreatsBefore, threatsAfter: wtThreatsAfter,
      color: playerColor, mover, thoughts: []
    };

    // Pick the right template - full mapping including inaccuracy and bookBad
    const templateMap = {
      brilliant: TEMPLATES.brilliant, good: TEMPLATES.good,
      inaccuracy: TEMPLATES.inaccuracy,
      mistake: TEMPLATES.mistake, blunder: TEMPLATES.blunder,
      neutral: TEMPLATES.neutral, book: TEMPLATES.book,
      'book-inaccuracy': TEMPLATES.bookBad, 'book-blunder': TEMPLATES.bookBad
    };
    const tmpl = templateMap[step.cls] || TEMPLATES.neutral;
    const prompt = tmpl(snap);

    const reply = await callClaude(prompt, key);
    _rawReplyCache[step.ply] = reply; // share with analysis page
    const html = _renderWtSlides(marked.parse(reply));
    _wtCache[cacheKey] = html;
    _persistAiCache();
    return html;
  } catch (err) {
    return `<p class="wt-error">Could not analyze: ${err.message}</p>`;
  }
}

// Show the multiple-choice "What were you thinking?" prompt
function _wtShowThoughtPrompt(step) {
  const area = document.getElementById('wtThoughtArea');
  const options = _wtThoughtOptions(step);
  const question = step.category === 'worst'
    ? "What were you thinking when you played this?"
    : "What led you to this move?";

  area.style.display = '';
  area.innerHTML = `
    <div class="wt-thought-prompt">
      <div class="wt-thought-question">${question}</div>
      <div class="wt-thought-options">
        ${options.map(o => `<button class="wt-thought-btn" onclick="_wtSelectThought('${o.id}', '${_escAttr(o.text)}', ${_wtIdx})">${o.text}</button>`).join('')}
      </div>
      <button class="wt-thought-skip" onclick="_wtSkipThought()">Skip this question</button>
    </div>`;
}

function _escAttr(str) { return str.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

function _wtSkipThought() {
  const area = document.getElementById('wtThoughtArea');
  area.style.display = 'none';
}

// Handle thought selection - get AI response
async function _wtSelectThought(optionId, optionText, stepIdx) {
  if (stepIdx !== _wtIdx) return; // stale click
  const step = _wtSteps[stepIdx];
  const area = document.getElementById('wtThoughtArea');

  area.innerHTML = `
    <div class="wt-thought-response">
      <div class="wt-thought-selected">You said: "${optionText}"</div>
      <div class="wt-thought-ai-loading"><span class="spinner"></span> Coach is responding...</div>
    </div>`;

  try {
    const key = document.getElementById('apiKey')?.value?.trim() || '';
    const pos = positions[step.ply];
    const san = pos.san;
    const moveNum = Math.ceil(step.ply / 2);
    const cls = step.cls;
    const evB = evals[step.ply - 1];
    const evA = evals[step.ply];
    const preFen = positions[step.ply - 1]?.fen;

    // ── ENGINE VERDICT for context ──
    const stripAnnot = s => (s || '').replace(/[+#!?]/g, '').trim();
    const playedCore = stripAnnot(san);
    const bestCore   = stripAnnot(evB?.bestSAN || '');
    let verdictLine = '';
    if (evB?.bestSAN && evB.bestSAN !== '?') {
      verdictLine = (bestCore === playedCore)
        ? `ENGINE VERDICT: ${san} IS the engine's #1 choice for this position.`
        : `ENGINE VERDICT: ${san} was NOT the engine's top choice. The engine preferred ${evB.bestSAN} instead.`;
    }

    // ── Pawn structure + chess concept notes ──
    const mover = pos.turn === 'b' ? 'w' : 'b';
    const conceptD = {
      fen: preFen || pos.fen, fenAfter: pos.fen,
      from: pos.from, to: pos.to, san, mover, color: playerColor
    };
    const pawnNotes   = pos.fen ? pawnStructureNotes(pos.fen) : '';
    const conceptNote = chessConceptNotes(conceptD);
    const obsLines    = [pawnNotes, conceptNote].filter(Boolean).join('\n');

    // ── Eval summary ──
    const evalLine = (evB && evA)
      ? `Eval before: ${fmtEval(evB)}, Eval after: ${fmtEval(evA)}`
      : '';

    const prompt = `You are a warm chess coach responding to a beginner's reflection on their move.
${verdictLine ? verdictLine + '\n' : ''}Move ${moveNum}: ${san} (classified as ${labelFor(cls)})${evalLine ? '\n' + evalLine : ''}${obsLines ? '\n' + obsLines : ''}
The player said: "${optionText}"

In 2 sentences, respond to what they said. Be empathetic and specific.
- NEVER suggest the player should have moved their piece to a different square unless that exact square is named in the ENGINE VERDICT.
- If they made a mistake, acknowledge their reflection and briefly explain the real consequence (e.g. the engine preferred ${evB?.bestSAN || 'a different move'}, or a specific weakness created).
- If it was a good move, reinforce what they did well. Reference the specific move ${san} by name. Don't use em-dashes.
${FMT_SHORT}`;

    const reply = await callClaude(prompt, key);
    if (stepIdx !== _wtIdx) return; // moved on

    area.innerHTML = `
      <div class="wt-thought-response">
        <div class="wt-thought-selected">You said: "${optionText}"</div>
        <div class="wt-thought-ai-reply">${marked.parse(reply)}</div>
      </div>`;
  } catch (err) {
    area.innerHTML = `
      <div class="wt-thought-response">
        <div class="wt-thought-selected">You said: "${optionText}"</div>
        <div class="wt-thought-ai-reply">Thanks for sharing! Let's move on.</div>
      </div>`;
  }
}

// ── Full Game Breakdown page - now launches walkthrough directly ──
function goToFullGameBreakdown() {
  if (positions.length < 3) return;
  launchWalkthrough();
}

function _bdResetForm() {
  const content = document.getElementById('breakdownContent');
  if (content) {
    content.className = 'bd-result-content dim';
    content.textContent = 'Your AI-powered full game breakdown will appear here after you click Generate.';
  }
  const bdThoughts = document.querySelector('.bd-thoughts');
  if (bdThoughts) bdThoughts.style.display = '';
  const resultPanel = document.querySelector('.bd-result-panel');
  if (resultPanel) resultPanel.classList.remove('bd-result-fullscreen');
  // Remove any previously injected sticky header
  const fsHdr = document.querySelector('.bd-fs-header');
  if (fsHdr) fsHdr.remove();
}

function _bdShowResult(html) {
  // Always sync _cpoLastHtml so the "Present again" button works even after cache restore
  _cpoLastHtml = html;
  const content = document.getElementById('breakdownContent');
  if (content) {
    content.className = 'bd-result-content';
    content.innerHTML = _injectReplayBtn(html);
  }
  // Hide the form, go fullscreen
  const bdThoughts = document.querySelector('.bd-thoughts');
  if (bdThoughts) bdThoughts.style.display = 'none';
  const resultPanel = document.querySelector('.bd-result-panel');
  if (resultPanel) {
    resultPanel.classList.add('bd-result-fullscreen');
    if (!resultPanel.querySelector('.bd-fs-header')) {
      const persLabel = currentPersonality?.primary
        ? `${currentPersonality.primary.emoji} ${currentPersonality.primary.name}` : '';
      const fsHdr = document.createElement('div');
      fsHdr.className = 'bd-fs-header';
      fsHdr.innerHTML = `
        <button class="bd-fs-back" onclick="closeBdFullscreen()">&#8592; Back</button>
        <span class="bd-fs-title">Full Game Breakdown</span>
        ${persLabel ? `<span class="bd-fs-persona">${persLabel}</span>` : ''}
      `;
      resultPanel.insertBefore(fsHdr, resultPanel.firstChild);
    }
    resultPanel.scrollTop = 0;
  }
}

async function generateFullGameBreakdown() {
  if (positions.length < 3) return;
  const key = document.getElementById('apiKey')?.value?.trim() || '';
  const hasAccess = key || (window.CP_CONFIG?.PROXY_URL || '').trim();
  if (!hasAccess) { document.getElementById('breakdownContent').textContent = 'API key missing.'; return; }

  const content = document.getElementById('breakdownContent');
  content.className = 'bd-result-content';
  content.innerHTML = '<span class="spinner"></span> Generating full game breakdown\u2026';

  const turns = [];
  for (let i = 1; i < positions.length; i++) {
    const cls = classifyMove(i);
    if (cls === 'mistake' || cls === 'blunder' || cls === 'brilliant') {
      const mv   = Math.ceil(i / 2);
      const side = positions[i].turn === 'b' ? 'White' : 'Black';
      turns.push(`Move ${mv} (${side}: ${positions[i].san}) - ${labelFor(cls)}, ~${cpLoss(i)}cp lost`);
    }
  }

  const lastG = new Chess(positions[positions.length - 1].fen);
  let result = 'Game ended';
  if (lastG.in_checkmate())      result = lastG.turn() === 'w' ? 'Black wins by checkmate' : 'White wins by checkmate';
  else if (lastG.in_stalemate()) result = 'Draw by stalemate';
  else if (lastG.in_draw())      result = 'Draw';

  let moves = positions.slice(1).map((p, i) =>
    (i % 2 === 0 ? (Math.floor(i / 2) + 1) + '.' : '') + p.san
  ).join(' ');
  if (moves.length > 600) moves = moves.slice(0, 600) + '...';

  // Read user thoughts from breakdown page inputs
  const thoughts = [
    { label: 'Overall feeling', value: (document.getElementById('ctSumQ1Bd') || {}).value?.trim() || '' },
    { label: 'When things went wrong', value: (document.getElementById('ctSumQ2Bd') || {}).value?.trim() || '' },
    { label: 'Biggest mistake', value: (document.getElementById('ctSumQ3Bd') || {}).value?.trim() || '' },
    { label: 'What I would do differently', value: (document.getElementById('ctSumQ4Bd') || {}).value?.trim() || '' }
  ];

  const snap = {
    moves, result, color: playerColor,
    turns: turns.length ? turns.slice(0, 8).join('\n') : 'No major mistakes found.',
    thoughts
  };
  const prompt = TEMPLATES.summary(snap);

  try {
    const reply = await callClaudeLong(prompt, key);
    const rich = renderAicRich(marked.parse(reply), null, 'full');
    // Save to cache for this game
    _breakdownCachedHtml = rich;
    _breakdownCacheKey  = _bdCacheKey();
    _bdShowResult(rich);
    launchCoachPresentation(rich);
    _persistAiCache();
  } catch (err) {
    content.className = 'bd-result-content dim';
    content.textContent = 'Error: ' + err.message;
  }
}

function closeBdFullscreen() {
  // Just go back to the analysis page - breakdown is locked once generated
  goToAnalysis();
}

function explainFullGame() {
  // Legacy - redirect to breakdown page
  goToFullGameBreakdown();
}

