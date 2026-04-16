// ==============================================================
//  DRAG-AND-DROP for the live analysis board (Lichess-style).
//  Integrates with try-move.js's liveBoard state + board.js render.
//  Uses pointer events so it works for mouse, touch, and pen.
//  Click-to-move behaviour is preserved: a tap without movement
//  falls through to the existing click handler in board.js.
// ==============================================================
(function () {
  'use strict';

  var THRESHOLD = 4; // px before we commit to a drag
  var state = null;

  function boardEl() { return document.getElementById('board'); }

  function isFlipped() {
    return (typeof playerColor !== 'undefined' && playerColor === 'b');
  }

  function squareFromPoint(x, y) {
    var b = boardEl();
    if (!b) return null;
    var rect = b.getBoundingClientRect();
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) return null;
    var sz = rect.width / 8;
    var col = Math.floor((x - rect.left) / sz);
    var row = Math.floor((y - rect.top) / sz);
    var flipped = isFlipped();
    var r = flipped ? 7 - row : row;
    var c = flipped ? 7 - col : col;
    if (r < 0 || r > 7 || c < 0 || c > 7) return null;
    return String.fromCharCode(97 + c) + (8 - r);
  }

  function squareElFor(sq) {
    var b = boardEl();
    if (!b || !sq) return null;
    var flipped = isFlipped();
    var file = sq.charCodeAt(0) - 97;
    var rank = 8 - parseInt(sq[1], 10);
    var ri = flipped ? 7 - rank : rank;
    var ci = flipped ? 7 - file : file;
    return b.children[ri * 8 + ci] || null;
  }

  function pieceImgAt(sq) {
    var el = squareElFor(sq);
    return el ? el.querySelector('img.piece-img') : null;
  }

  function clearHover() {
    var nodes = document.querySelectorAll('.square.drag-hover, .square.drag-origin');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('drag-hover');
      nodes[i].classList.remove('drag-origin');
    }
  }

  function setHover(sq) {
    var el = squareElFor(sq);
    if (el) el.classList.add('drag-hover');
  }

  function cleanup() {
    if (state) {
      if (state.clone && state.clone.parentNode) state.clone.parentNode.removeChild(state.clone);
      if (state.origImg) state.origImg.style.opacity = '';
    }
    clearHover();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function beginDrag(e) {
    if (!state) return;
    var img = state.origImg;
    if (!img) { state = null; return; }

    // Floating clone that follows the pointer
    var clone = img.cloneNode(true);
    var sz = state.sz;
    clone.classList.add('dragging-piece');
    clone.style.position = 'fixed';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = sz + 'px';
    clone.style.height = sz + 'px';
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '10000';
    clone.style.willChange = 'transform';
    clone.style.transform = 'translate3d(' +
      (e.clientX - sz / 2) + 'px,' + (e.clientY - sz / 2) + 'px,0) scale(1.08)';
    document.body.appendChild(clone);

    img.style.opacity = '0.25';
    var originEl = squareElFor(state.from);
    if (originEl) originEl.classList.add('drag-origin');

    state.clone = clone;
    state.dragging = true;
    state.suppressClick = true;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function onPointerDown(e) {
    // Primary button only for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    var b = boardEl();
    if (!b) return;
    // Must originate on the board
    if (!b.contains(e.target)) return;

    var sq = squareFromPoint(e.clientX, e.clientY);
    if (!sq) return;

    var fen = (typeof liveBoardFen === 'function') ? liveBoardFen() : null;
    if (!fen || typeof Chess === 'undefined') return;

    var g;
    try { g = new Chess(fen); } catch (_) { return; }

    // If a piece is already selected via click and user pointer-downs on a
    // legal destination, execute the move immediately (feels snappier than
    // waiting for the click event, and lets drag-to-same-piece still work).
    if (typeof liveBoard !== 'undefined' && liveBoard.selected &&
        liveBoard.legalDests.indexOf(sq) !== -1) {
      try { _executeLiveMove(liveBoard.selected, sq, fen, g); } catch (_) {}
      e.preventDefault();
      // Suppress the synthetic click that follows
      _suppressNextClick();
      return;
    }

    var piece = g.get(sq);
    if (!piece || piece.color !== g.turn()) {
      // Empty square or opponent piece — fall through to click handler
      return;
    }

    // Select and re-render so legal-dest dots appear
    try { _selectLivePiece(sq, g); } catch (_) { return; }
    try { renderBoard(); } catch (_) {}

    var rect = b.getBoundingClientRect();
    var sz = rect.width / 8;
    state = {
      from: sq,
      startX: e.clientX,
      startY: e.clientY,
      sz: sz,
      origImg: pieceImgAt(sq),
      clone: null,
      dragging: false,
      suppressClick: false,
      hoverSq: null,
      pointerId: e.pointerId
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    // Prevent the browser's default image-drag / text-select behaviour
    // but keep click events firing for the tap-to-select flow.
    if (e.target && e.target.tagName === 'IMG') e.preventDefault();
  }

  function onPointerMove(e) {
    if (!state) return;
    if (!state.dragging) {
      var dx = e.clientX - state.startX;
      var dy = e.clientY - state.startY;
      if (dx * dx + dy * dy < THRESHOLD * THRESHOLD) return;
      beginDrag(e);
    }
    if (state.clone) {
      var sz = state.sz;
      state.clone.style.transform = 'translate3d(' +
        (e.clientX - sz / 2) + 'px,' + (e.clientY - sz / 2) + 'px,0) scale(1.08)';
    }
    var sq = squareFromPoint(e.clientX, e.clientY);
    if (sq !== state.hoverSq) {
      // Clear only the hover class (keep drag-origin)
      var nodes = document.querySelectorAll('.square.drag-hover');
      for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('drag-hover');
      state.hoverSq = sq;
      if (sq && typeof liveBoard !== 'undefined' &&
          liveBoard.legalDests.indexOf(sq) !== -1) {
        setHover(sq);
      }
    }
    e.preventDefault();
  }

  function _suppressNextClick() {
    var block = function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      window.removeEventListener('click', block, true);
    };
    window.addEventListener('click', block, true);
    // Fallback: clear after a tick in case no click fires
    setTimeout(function () { window.removeEventListener('click', block, true); }, 400);
  }

  function onPointerUp(e) {
    if (!state) return;
    var dragged = state.dragging;
    var from = state.from;
    var shouldSuppress = state.suppressClick;
    var to = dragged ? squareFromPoint(e.clientX, e.clientY) : null;

    cleanup();

    if (dragged) {
      if (to && to !== from && typeof liveBoard !== 'undefined' &&
          liveBoard.legalDests.indexOf(to) !== -1) {
        var fen = liveBoardFen();
        try {
          var g = new Chess(fen);
          _executeLiveMove(from, to, fen, g);
        } catch (_) {}
      } else {
        // Dropped off-board or on illegal square — snap back / deselect
        liveBoard.selected = null;
        liveBoard.legalDests = [];
        try { renderBoard(); } catch (_) {}
      }
    }

    if (shouldSuppress) _suppressNextClick();
    state = null;
  }

  function onPointerCancel() {
    if (!state) return;
    cleanup();
    try {
      liveBoard.selected = null;
      liveBoard.legalDests = [];
      renderBoard();
    } catch (_) {}
    state = null;
  }

  function init() {
    var b = boardEl();
    if (!b) { setTimeout(init, 400); return; }
    // Delegate once on the board; squares are re-rendered but the container
    // persists, so the listener survives renderBoard() calls.
    b.addEventListener('pointerdown', onPointerDown);
    // Discourage native image drag and text selection on the board itself.
    b.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Retry in case the board is created later
  setTimeout(init, 600);
})();
