// ==============================================================
//  MOVE DESCRIPTION (hardcoded, always-available)
//  Generates a plain-English sentence for the currently selected
//  move based on SAN + pre/post FEN. No AI, no network.
//  Rendered into every element with class .move-quick-desc.
// ==============================================================
(function () {
  'use strict';

  var PIECE_NAMES = {
    p: 'pawn', n: 'knight', b: 'bishop',
    r: 'rook', q: 'queen', k: 'king'
  };

  function pieceName(letter) {
    if (!letter) return 'piece';
    return PIECE_NAMES[letter.toLowerCase()] || 'piece';
  }

  // Returns the piece letter at `square` in the given FEN, or null if empty.
  // Uppercase = white, lowercase = black.
  function pieceAt(fen, square) {
    if (!fen || !square || square.length < 2) return null;
    try {
      var board = fen.split(' ')[0];
      var rows = board.split('/');
      var file = square.charCodeAt(0) - 97;      // a=0 .. h=7
      var rank = 8 - parseInt(square[1], 10);    // rank 8 = row 0
      if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
      var row = rows[rank];
      var col = 0;
      for (var i = 0; i < row.length; i++) {
        var ch = row[i];
        if (ch >= '0' && ch <= '9') {
          col += parseInt(ch, 10);
        } else {
          if (col === file) return ch;
          col++;
        }
      }
    } catch (_) {}
    return null;
  }

  function checkSuffix(san, moverIsYou) {
    if (san.indexOf('#') !== -1) {
      return moverIsYou ? ' That\u2019s checkmate \u2014 you won the game.'
                        : ' That\u2019s checkmate.';
    }
    if (san.indexOf('+') !== -1) {
      return moverIsYou ? ' Check on their king.'
                        : ' Check on your king.';
    }
    return '';
  }

  function annotationBadge(san) {
    if (!san) return '';
    if (san.indexOf('??') !== -1) return ' (blunder)';
    if (san.indexOf('!!') !== -1) return ' (brilliant)';
    if (san.indexOf('?!') !== -1) return ' (dubious)';
    if (san.indexOf('!?') !== -1) return ' (interesting)';
    if (san.indexOf('?')  !== -1) return ' (mistake)';
    if (san.indexOf('!')  !== -1) return ' (good move)';
    return '';
  }

  // ply 1 = White's 1st move, ply 2 = Black's 1st reply, ...
  function moverColorFromPly(ply) {
    return (ply % 2 === 1) ? 'w' : 'b';
  }

  // Core formatter shared by game-move and custom-move descriptions.
  // opts: { san, fenBefore, subj, poss, oppPoss, isYou }
  function formatMove(opts) {
    var san = (opts.san || '').trim();
    if (!san) return '';
    var subj = opts.subj, poss = opts.poss, oppPoss = opts.oppPoss, isYou = !!opts.isYou;
    var clean = san.replace(/[!?]+/g, '');

    if (/^O-O-O/.test(clean)) return subj + ' castled queenside.' + checkSuffix(san, isYou) + annotationBadge(san);
    if (/^O-O/.test(clean))   return subj + ' castled kingside.'  + checkSuffix(san, isYou) + annotationBadge(san);

    var first = clean.charAt(0);
    var isPieceMove = 'NBRQK'.indexOf(first) !== -1;
    var moverLetter = isPieceMove ? first : 'P';
    var moverName = pieceName(moverLetter);

    var body = clean.replace(/[+#]+$/, '');
    var promoMatch = body.match(/=([NBRQ])/);
    if (promoMatch) body = body.replace(/=([NBRQ])/, '');
    var targetMatch = body.match(/([a-h][1-8])(?!.*[a-h][1-8])/);
    var target = targetMatch ? targetMatch[1] : '';

    var isCapture = clean.indexOf('x') !== -1;
    var text;
    if (isCapture) {
      var capturedLetter = opts.fenBefore ? pieceAt(opts.fenBefore, target) : null;
      if (!capturedLetter && moverLetter === 'P') capturedLetter = 'p';
      var capturedName = pieceName((capturedLetter || 'p').toLowerCase());
      if (moverLetter === 'P') {
        text = subj + ' captured ' + oppPoss + ' ' + capturedName + ' on ' + target + ' with ' + poss + ' pawn.';
      } else {
        text = subj + ' captured ' + oppPoss + ' ' + capturedName + ' on ' + target + ' with ' + poss + ' ' + moverName + '.';
      }
    } else {
      if (moverLetter === 'P') {
        text = subj + ' advanced ' + poss + ' pawn to ' + target + '.';
      } else {
        text = subj + ' moved ' + poss + ' ' + moverName + ' to ' + target + '.';
      }
    }
    if (promoMatch) {
      text = text.replace(/\.$/, '') + ', promoting to a ' + pieceName(promoMatch[1]) + '.';
    }
    text += checkSuffix(san, isYou);
    text += annotationBadge(san);
    return text;
  }

  // Describe a user-made (free-move) move. We don't assume "you vs opponent"
  // here — in free-move mode the user is exploring both sides — so we use
  // side names ("White" / "Black").
  function describeUserMove(userMove) {
    if (!userMove || !userMove.san || !userMove.fenBefore) return '';
    // Mover color = side to move in fenBefore.
    var turnField = (userMove.fenBefore.split(' ')[1] || 'w');
    var moverIsWhite = (turnField === 'w');
    var subj = moverIsWhite ? 'White' : 'Black';
    var poss = moverIsWhite ? 'White\u2019s' : 'Black\u2019s';
    var oppPoss = moverIsWhite ? 'Black\u2019s' : 'White\u2019s';
    var text = formatMove({
      san: userMove.san,
      fenBefore: userMove.fenBefore,
      subj: subj, poss: poss, oppPoss: oppPoss, isYou: false
    });
    if (!text) return '';
    return 'Variation: ' + text;
  }

  function describeMoveText(ply) {
    if (typeof positions === 'undefined' || !positions[ply] || ply < 1) return '';
    var pos = positions[ply];
    var prev = positions[ply - 1];
    var san = (pos.san || '').trim();
    if (!san) return '';

    var moverColor = moverColorFromPly(ply);
    var pc = (typeof playerColor !== 'undefined') ? playerColor : 'w';
    var isYou = (moverColor === pc);
    var subj = isYou ? 'You' : 'Your opponent';
    var poss = isYou ? 'your' : 'their';
    var oppPoss = isYou ? 'their' : 'your';
    return formatMove({
      san: san,
      fenBefore: prev ? prev.fen : null,
      subj: subj, poss: poss, oppPoss: oppPoss, isYou: isYou
    });
  }

  function updateMoveDescription() {
    var nodes = document.querySelectorAll('.move-quick-desc');
    if (!nodes || !nodes.length) return;
    var text;
    var hasFreeMoves = (typeof liveBoard !== 'undefined' && liveBoard.userMoves && liveBoard.userMoves.length > 0);
    if (hasFreeMoves) {
      var last = liveBoard.userMoves[liveBoard.userMoves.length - 1];
      text = describeUserMove(last) || 'Variation: move played.';
      if (liveBoard.userMoves.length > 1) {
        text += '  (' + liveBoard.userMoves.length + ' moves ahead of the game)';
      }
    } else if (typeof currentPly === 'undefined' || currentPly < 1) {
      text = 'Step through the moves to see what happened. Tap Explain for a deeper AI analysis.';
    } else {
      text = describeMoveText(currentPly);
      if (!text) text = '';
    }
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = text;
      nodes[i].classList.toggle('is-empty', !text);
    }
  }

  // When in free-move (variation) mode, override the Explain buttons so they
  // trigger analyzeLiveBoardPosition() instead of the default "Back to game
  // moves" label. Users still have Undo / Reset Board in the live-board
  // controls bar to get back to the game line.
  function patchExplainButtonsForFreeMode() {
    var hasFreeMoves = (typeof liveBoard !== 'undefined' && liveBoard.userMoves && liveBoard.userMoves.length > 0);
    var ids = ['explainBtn', 'explainBtnDesktop'];
    for (var i = 0; i < ids.length; i++) {
      var btn = document.getElementById(ids[i]);
      if (!btn) continue;
      var hint = btn.parentElement ? btn.parentElement.querySelector('.aic-hint') : null;
      if (hasFreeMoves) {
        btn.disabled = true;
        btn.classList.remove('btn-back-to-game');
        btn.classList.remove('btn-rewatch');
        btn.classList.remove('btn-analyze-variation');
        btn.innerHTML = 'Exploring variation';
        btn.onclick = null;
        if (hint) {
          hint.style.display = 'none';
          hint.textContent = '';
        }
      } else {
        btn.classList.remove('btn-analyze-variation');
      }
    }
  }

  // Expose globally
  window.describeMoveText = describeMoveText;
  window.updateMoveDescription = updateMoveDescription;

  // Patch updateExplainButtons so our description refreshes on every nav
  // without needing to edit explain.js. Runs once the function is defined.
  function hookOnce() {
    if (typeof window.updateExplainButtons !== 'function' ||
        window._mqdHooked) return;
    var original = window.updateExplainButtons;
    window.updateExplainButtons = function () {
      var r = original.apply(this, arguments);
      try { updateMoveDescription(); } catch (_) {}
      try { patchExplainButtonsForFreeMode(); } catch (_) {}
      return r;
    };
    window._mqdHooked = true;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      hookOnce();
      updateMoveDescription();
    });
  } else {
    hookOnce();
    updateMoveDescription();
  }
  // Retry hook a couple of times in case explain.js loads later
  setTimeout(hookOnce, 200);
  setTimeout(hookOnce, 800);
  setTimeout(updateMoveDescription, 800);
})();
