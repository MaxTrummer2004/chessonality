/* ============================================================
   claude-api.js - Claude Haiku integration
   Template system keeps every API call small:
     ~150-250 input tokens, capped at 300 output tokens.
   No conversation history - each call is fully self-contained.
   ============================================================ */

'use strict';

// ---- Chess concept definitions injected into every move prompt ----
const CHESS_CONCEPTS = `
ALLOWED CHESS CONCEPTS - only these 10 may appear in your response:
1. Doubled or tripled pawns (structural weakness)
2. Isolated pawns (no friendly pawn on adjacent files)
3. Passed pawns (no enemy pawn can stop their promotion path)
4. Bishop pair (having both bishops vs only one)
5. Open files (no pawns of either color on a file)
6. King castling rights (gained or lost)
7. King safety (pawn shield, exposed king, castled status)
8. Material balance (who has more pieces, in plain words)
9. Piece activity (which side has more mobile pieces)
10. Space (pawn advancement into enemy half)
NEVER mention: weak squares, outposts, color complexes, fianchetto, prophylaxis, zugzwang, opposition, or any other positional term. Tactical terms (fork, pin, skewer, discovered attack) may only be used if the continuation explicitly confirms them.`.trim();

// ---- Hallucination guard - placed at top of every move/position template ----
// Claude must ground every claim in the explicit board data provided.
const GROUNDING_GUARD = `STRICT RULES (violations are never acceptable):
1. Only mention pieces and squares explicitly listed in the board positions below.
2. NEVER name a specific move unless it appears in: (a) the engine's top moves list, OR (b) the "WHAT HAPPENS NEXT" continuation lines.
2b. ENGINE VERDICT is the single source of truth for whether the played move was the engine's top choice. If it says "IS the engine's #1 choice" - never say the engine preferred something else. If it says "was NOT the engine's top choice" - never say it was. Do not contradict this line under any circumstances.
3. When the engine shows forced mate, you MUST mention it.
4. NEVER confuse "check" with "checkmate". Only call something checkmate if it is labelled "CHECKMATE IN ONE MOVE" in the data.
5. CASTLING STATUS: Read the "Castling facts" block verbatim. NEVER say a side "hasn't castled" if the facts say they have.
6. PIECE DEVELOPMENT: You may NOT claim any piece is "undeveloped" or "on its starting square" unless the piece list confirms it.
7. RESPONSE STRUCTURE: First sentence states the factual move assessment (what was played, what the engine preferred). Then 1-2 more sentences explaining the chess IDEAS behind the position. Read the continuation silently to find the SINGLE most important consequence. State that ONE outcome in plain language. NEVER chain multiple future consequences together. BAD: "your queen gets taken, your knight is lost, and your pieces are under pressure." GOOD: "This costs you a piece within a few moves." Keep it to ONE clear consequence - the most important one.
8. DETERMINISTIC POSITIONAL FACTS BLOCK: Inside *** DETERMINISTIC POSITIONAL FACTS *** markers you will find the ONLY 10 chess concepts you may discuss: (1) doubled/tripled pawns, (2) isolated pawns, (3) passed pawns, (4) bishop pair, (5) open files, (6) castling rights, (7) king safety, (8) material balance, (9) piece activity, (10) space. Pick the SINGLE most relevant one for the Structure section and base it entirely on the deterministic facts provided. NEVER invent any concept not in the list (no weak squares, no outposts, no color complexes). If nothing notable changed, describe the current state of the most relevant one.
9. NEVER invent tactics, sequences, or move-by-move narratives. Express the position as a chess IDEA, not as a list of moves. BAD: "After Nc3, Black castles, then Qd3 forces Rb8." GOOD: "The knight develops with tempo, preparing to pressure the weak c-pawn." Do NOT use filler phrases: "creates multiple threats", "puts pressure on", "gains initiative", "controls the center", "creates tactical opportunities", or equivalent vague generalizations. Be specific about ONE concrete chess idea.
9e. LOGICAL CONSISTENCY: Every claim must follow logically from the board state. NEVER claim a side "gave up the bishop pair" unless that side actually HAD both bishops before the move and now has zero or one. NEVER say a move "created doubled pawns" unless the pawn structure data confirms doubled pawns exist AFTER the move. NEVER attribute consequences to the WRONG side (e.g. saying "your opponent lost the bishop pair" when it was YOU who lost a bishop). Check which side captured what, and which side suffers the consequence.
9f. FOCUS ON THE MOVE, NOT THE FUTURE: The explanation should primarily be about the move itself - what it does RIGHT NOW on the board. The continuation is background context only. NEVER make the continuation the main subject of your explanation. BAD: "Within a few moves your queen gets taken, your knight is lost, and your remaining pieces are under heavy pressure." GOOD: "Capturing with the pawn instead of the queen leaves you with a weaker piece structure."
9c. ATTACK CLAIMS: NEVER invent attacks from piece geometry alone. A piece landing on a square does NOT mean it attacks adjacent pieces. You may ONLY claim a fork, pin, skewer, or attack if the continuation annotations explicitly confirm it (e.g. the annotation says "[captures queen]", "[forks king and rook]", or a capture actually happens on that square in the continuation). If the continuation does not show the attack materializing, do NOT claim it exists. STATE THE OUTCOME instead: "this loses your knight" or "this wins the exchange".
9d. EVAL NUMBERS: NEVER quote the raw evaluation number (e.g. "+2.3", "minus 2.6", "-1.8 pawns") in any section. You may say "the engine strongly favors Black" or "this gives White a clear advantage" but must not name a specific numerical score.
9b. MATERIAL CLAIMS: NEVER claim a side is materially ahead unless the "Material balance" line in the FACTS block explicitly says so. The verdict on that line is the EFFECTIVE balance - it already accounts for forced recaptures in the engine continuation. If it says "Material is equal" then NEVER say one side is winning material, even if a piece was just captured (the next move recaptures it). A recapture restores material - call the sequence a "trade" or "recapture", not a "material gain". NEVER write phrases like "you are up a minor piece" or "you have an extra knight" unless the EFFECTIVE Material balance line confirms it.
10. SECTION STRUCTURE: Use the 3 required ## section headers: Overview, Structure, Best Move - in that exact order. Never skip a section. Never merge sections. Never add a 4th section.
11. All three sections: prose only, 1-3 sentences each. NEVER use numbered lists, bullet points, or move-by-move sequences. No bold text.`.trim();

// ---- Global output formatting rules injected into every prompt ----
// SHORT version: for simple prompts (follow-up questions, book moves)
const FMT_SHORT = `Output rules: never use em-dashes (-) or en-dashes (–). Never use parenthetical qualifiers in brackets. Never use headers, bold text, or bullet points. Always finish your last sentence completely. Maximum 4 sentences total.`.trim();

// STRUCTURED version: 3-section format for move analysis
const FMT_STRUCTURED = `Output format (MANDATORY - no exceptions):
Write EXACTLY these 3 ## markdown section headers in this order. No bullet points. No bold text. No numbered lists. No em-dashes (-) or en-dashes (–). Always complete every sentence.
CRITICAL LENGTH RULE: Each section must be 230 characters maximum. Hard limit - stop before exceeding it.
AUDIENCE: Complete beginner. Use simple, everyday language. Describe what happens on the board in plain terms (e.g. "this loses a bishop" or "this puts pressure on the center"), NEVER list move sequences or use technical notation in your prose.
PIECE CHECK: Before writing, verify every piece you mention exists in the "Pieces on board" list above. NEVER say a player has a bishop, knight, rook, or queen that is not in that list.

## Overview
Max 230 characters. What move was played, and in one clause whether it was the right call or not. Focus on what the move ITSELF does on the board right now. You may mention ONE future consequence at most (e.g. "this gives away a piece", "this controls the center well"), but NEVER narrate a chain of future events. Keep it grounded in the present position.

## Structure
Max 230 characters. Pick EXACTLY ONE of these 10 concepts from the FACTS block and describe it: doubled/tripled pawns, isolated pawns, passed pawns, bishop pair, open files, castling rights, king safety, material balance, piece activity, or space. Use the deterministic facts. NEVER invent any other positional concept (no weak squares, no outposts, no color complexes). Pick the one most relevant to the move just played.

## Best Move
Max 230 characters. State the engine's preferred move and explain its benefit using EXACTLY ONE of the 10 allowed concepts. Read the BEST-MOVE LOOKAHEAD block (3 moves ahead) and pick the SINGLE most important benefit using this strict priority: (1) delivers checkmate, (2) wins material (queen > rook > minor piece > pawn), (3) saves your own material from being lost, (4) improves king safety, (5) preserves castling rights, (6) creates a passed pawn, (7) gains the bishop pair or opens a file for your rooks, (8) avoids doubled or isolated pawns, (9) activates a piece, (10) gains space. Always pick the HIGHEST priority benefit visible in the lookahead.
CRITICAL PRONOUN RULE: If this is the STUDENT'S OWN move, write "you could have played X". If this is the OPPONENT'S move, write "your opponent could have played X" - NEVER "you should have played X" for opponent's turn.
BANNED: listing move sequences, quoting brackets, inventing tactics, mentioning weak squares or outposts.
Two sentences maximum.`.trim();

// BEST-MOVE-ONLY version: for the "Analyze Move" button (just the best move)
const FMT_BESTMOVE = `Output format (MANDATORY - no exceptions):
Write EXACTLY one ## markdown section header. No bullet points. No bold text. No numbered lists. No em-dashes (-) or en-dashes (–). Always complete every sentence.
AUDIENCE: Complete beginner. Use simple, everyday language. NEVER list move sequences in your output.

## Best Move
Max 280 characters. State the engine's preferred move and explain its benefit using EXACTLY ONE of the 10 allowed concepts. Read the BEST-MOVE LOOKAHEAD block (3 moves ahead) and pick the SINGLE most important benefit using this strict priority: (1) delivers checkmate, (2) wins material (queen > rook > minor piece > pawn), (3) saves your own material from being lost, (4) improves king safety, (5) preserves castling rights, (6) creates a passed pawn, (7) gains the bishop pair or opens a file for your rooks, (8) avoids doubled or isolated pawns, (9) activates a piece, (10) gains space. Always pick the HIGHEST priority benefit visible in the lookahead.
CRITICAL PRONOUN RULE: If this is the STUDENT'S OWN move, write "you could have played X". If this is the OPPONENT'S move, write "your opponent could have played X" - NEVER "you should have played X" for opponent's turn.
BANNED: listing move sequences, quoting brackets, inventing tactics, mentioning weak squares or outposts.
Two to three sentences maximum.`.trim();

// LONG version: for paragraph-style templates (summary, improve, coach)
const FMT_LONG = `Output rules (no exceptions):
- Never use em-dashes (-) or en-dashes (–). Rewrite using a colon, a comma, or split into two sentences.
- Always complete your final sentence before stopping. Never cut off mid-word or mid-sentence.
- Write in warm, direct second-person (you/your).
- Reference specific personality names (e.g. "Fox instinct", "your Eagle energy") rather than generic phrases like "your playing style".`.trim();

// Helper: append player thoughts to a prompt.
// `thoughts` is [{label, value}] - already filtered to the right context by main.js.
function withThoughts(base, thoughts) {
  if (!thoughts || !Array.isArray(thoughts)) return base;
  const lines = thoughts.filter(t => t.value).map(t => `${t.label}: "${t.value}"`);
  if (!lines.length) return base;
  return base + `\nThe player shared these thoughts:\n${lines.join('\n')}\nIncorporate the relevant ones into your response.`;
}

// Helper: turn 'w'/'b' into a readable label
function colorName(c) { return c === 'b' ? 'Black' : 'White'; }

// Derives explicit, unambiguous castling/king-status facts from a FEN.
// This is injected verbatim so Claude cannot invent castling status.
function castlingFacts(fen) {
  try {
    const g     = new Chess(fen);
    const board = g.board();
    // Find king squares
    let wkSq = null, bkSq = null;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const c = board[r][f];
        if (!c || c.type !== 'k') continue;
        const sq = String.fromCharCode(97 + f) + (8 - r);
        if (c.color === 'w') wkSq = sq; else bkSq = sq;
      }
    }
    // FEN castling field (field 3 = index 2 after splitting by space)
    const fenParts   = fen.split(' ');
    const castleStr  = fenParts[2] || '-';
    const wCanK      = castleStr.includes('K');
    const wCanQ      = castleStr.includes('Q');
    const bCanK      = castleStr.includes('k');
    const bCanQ      = castleStr.includes('q');
    const wHasCastle = !wCanK && !wCanQ && wkSq !== 'e1';
    const bHasCastle = !bCanK && !bCanQ && bkSq !== 'e8';

    function kingStatus(sq, hasCastle, canK, canQ, color) {
      if (hasCastle) return `${color} king has already castled (now on ${sq}).`;
      if (sq === (color === 'White' ? 'e1' : 'e8') && (canK || canQ)) {
        return `${color} king is on ${sq} (has NOT yet castled; rights remain: ${canK ? 'kingside' : ''}${canK && canQ ? ' and ' : ''}${canQ ? 'queenside' : ''}).`;
      }
      // King moved but didn't castle (or rights expired)
      return `${color} king is on ${sq} (castling no longer possible: king has moved or rights lost).`;
    }

    return `Castling facts (DO NOT contradict these):\n  ${kingStatus(wkSq, wHasCastle, wCanK, wCanQ, 'White')}\n  ${kingStatus(bkSq, bHasCastle, bCanK, bCanQ, 'Black')}`;
  } catch { return ''; }
}

// Returns a compact, explicit piece list from a FEN so Claude never has to
// parse FEN notation itself (which causes hallucinated piece positions).
// Also appends castling facts so Claude cannot infer castling status incorrectly.
function boardDescription(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    const w = [], b = [];
    const sym = { p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const cell = board[rank][file];
        if (!cell) continue;
        const sq = String.fromCharCode(97 + file) + (8 - rank);
        (cell.color === 'w' ? w : b).push(sym[cell.type] + sq);
      }
    }
    const facts = castlingFacts(fen);
    return `Pieces on board -\n  White: ${w.join(' ')}\n  Black: ${b.join(' ')}\n${facts ? facts + '\n' : ''}CRITICAL: ONLY the pieces listed above exist. If a piece type (bishop, knight, etc.) is NOT listed for a side, that side does NOT have it. NEVER mention a piece that is not in this list.`;
  } catch { return `FEN: ${fen}`; }
}

// Computes explicit pawn structure facts from a FEN:
//   - Doubled / tripled pawns
//   - Isolated pawns (no friendly neighbor on adjacent files) - weak
//   - Passed pawns (no enemy pawn on same or adjacent files ahead of it)
// Injected verbatim so Claude doesn't have to reason about pawn structure.
function pawnStructureNotes(fen) {
  try {
    const g     = new Chess(fen);
    const board = g.board();
    // pw[f] / pb[f] = sorted list of rank numbers (1-8) for each file (0=a…7=h)
    const pw = Array.from({length: 8}, () => []);
    const pb = Array.from({length: 8}, () => []);
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[r][f];
        if (!cell || cell.type !== 'p') continue;
        (cell.color === 'w' ? pw : pb)[f].push(8 - r);
      }
    }
    // Sort each file's ranks ascending
    for (let f = 0; f < 8; f++) { pw[f].sort((a,b)=>a-b); pb[f].sort((a,b)=>a-b); }

    const fc = f => String.fromCharCode(97 + f);
    const notes = [];

    // ── Doubled / tripled ──
    const analyzeDoubled = (pawns, color) => {
      for (let f = 0; f < 8; f++) {
        if (pawns[f].length < 2) continue;
        const label = pawns[f].length >= 3 ? 'tripled' : 'doubled';
        const squares = pawns[f].map(r => fc(f)+r).join(' and ');
        notes.push(`${color} has ${label} pawns on the ${fc(f)}-file (${squares}) - a structural weakness`);
      }
    };
    analyzeDoubled(pw, 'White');
    analyzeDoubled(pb, 'Black');

    // ── Isolated ──
    const analyzeIsolated = (pawns, color) => {
      for (let f = 0; f < 8; f++) {
        if (!pawns[f].length) continue;
        const hasNeighbor = (f > 0 && pawns[f-1].length > 0) || (f < 7 && pawns[f+1].length > 0);
        if (!hasNeighbor && pawns[f].length === 1) {
          notes.push(`${color} has an isolated pawn on ${fc(f)}${pawns[f][0]} - weak because no friendly pawn on an adjacent file can defend it`);
        }
      }
    };
    analyzeIsolated(pw, 'White');
    analyzeIsolated(pb, 'Black');

    // ── Passed pawns ──
    const analyzePassed = (ownPawns, enemyPawns, color, direction) => {
      for (let f = 0; f < 8; f++) {
        if (!ownPawns[f].length) continue;
        const leadRank = direction === 'up' ? Math.max(...ownPawns[f]) : Math.min(...ownPawns[f]);
        let isPassed = true;
        for (let df = -1; df <= 1; df++) {
          const ef = f + df;
          if (ef < 0 || ef > 7) continue;
          for (const er of enemyPawns[ef]) {
            if (direction === 'up'   && er >= leadRank) { isPassed = false; break; }
            if (direction === 'down' && er <= leadRank) { isPassed = false; break; }
          }
          if (!isPassed) break;
        }
        if (isPassed) {
          notes.push(`${color} has a passed pawn on ${fc(f)}${leadRank} - no enemy pawn can block or capture it on its path to promotion`);
        }
      }
    };
    analyzePassed(pw, pb, 'White', 'up');
    analyzePassed(pb, pw, 'Black', 'down');

    if (!notes.length) return '';
    return `\nPawn structure facts (DO NOT contradict these - only claim weaknesses listed here):\n${notes.map(n => '  - ' + n).join('\n')}`;
  } catch { return ''; }
}

// ── Material balance - explicit count for both sides ──
// Standard piece values: P=1, N=3, B=3, R=5, Q=9
function materialBalance(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    const vals = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const pieceLabel = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
    const wCount = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    const bCount = { p: 0, n: 0, b: 0, r: 0, q: 0 };
    let wTotal = 0, bTotal = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const c = board[r][f];
        if (!c || c.type === 'k') continue;
        if (c.color === 'w') { wCount[c.type]++; wTotal += vals[c.type]; }
        else                 { bCount[c.type]++; bTotal += vals[c.type]; }
      }
    }
    const fmt = (cnt) => ['q','r','b','n','p']
      .filter(t => cnt[t] > 0)
      .map(t => `${cnt[t]} ${pieceLabel[t]}${cnt[t] > 1 ? 's' : ''}`)
      .join(', ');
    const diff = wTotal - bTotal;
    let verdict;
    if (diff === 0)       verdict = 'Material is equal.';
    else if (Math.abs(diff) === 1) verdict = `${diff > 0 ? 'White' : 'Black'} is up one pawn.`;
    else if (Math.abs(diff) === 2) verdict = `${diff > 0 ? 'White' : 'Black'} is up two pawns.`;
    else if (Math.abs(diff) === 3) verdict = `${diff > 0 ? 'White' : 'Black'} is up a minor piece (knight or bishop).`;
    else if (Math.abs(diff) === 5) verdict = `${diff > 0 ? 'White' : 'Black'} is up a rook.`;
    else if (Math.abs(diff) === 9) verdict = `${diff > 0 ? 'White' : 'Black'} is up a queen.`;
    else                    verdict = `${diff > 0 ? 'White' : 'Black'} is up ${Math.abs(diff)} points of material.`;
    return `Material balance (DO NOT contradict): White has ${fmt(wCount) || 'no pieces'} (${wTotal} pts). Black has ${fmt(bCount) || 'no pieces'} (${bTotal} pts). ${verdict}`;
  } catch { return ''; }
}

// ── King safety - pawn shield + king position ──
// Reports for both sides: castled or not, pawn shield count, king on starting square, etc.
function kingSafetyNotes(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    let wkSq = null, bkSq = null;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const c = board[r][f];
        if (!c || c.type !== 'k') continue;
        const sq = String.fromCharCode(97 + f) + (8 - r);
        if (c.color === 'w') wkSq = sq; else bkSq = sq;
      }
    }
    // Count own pawns directly in front of and adjacent to king (within 1 file, 1 rank ahead)
    const shield = (kingSq, color) => {
      if (!kingSq) return 0;
      const kf = kingSq.charCodeAt(0) - 97;
      const kr = parseInt(kingSq[1], 10);
      const dir = color === 'w' ? 1 : -1;
      let n = 0;
      for (let df = -1; df <= 1; df++) {
        for (let dr = 1; dr <= 2; dr++) {
          const f = kf + df, r = kr + dir * dr;
          if (f < 0 || f > 7 || r < 1 || r > 8) continue;
          const cell = board[8 - r][f];
          if (cell && cell.type === 'p' && cell.color === color) n++;
        }
      }
      return n;
    };
    const fenParts = fen.split(' ');
    const castleStr = fenParts[2] || '-';
    const wHasCastled = !castleStr.includes('K') && !castleStr.includes('Q') && wkSq !== 'e1';
    const bHasCastled = !castleStr.includes('k') && !castleStr.includes('q') && bkSq !== 'e8';
    const wShield = shield(wkSq, 'w');
    const bShield = shield(bkSq, 'b');
    const describe = (sq, castled, shield, color) => {
      let s = `${color} king on ${sq}, `;
      if (castled) s += 'has castled';
      else if ((color === 'White' && sq === 'e1') || (color === 'Black' && sq === 'e8')) s += 'still on starting square (uncastled)';
      else s += 'has moved without castling';
      s += `, pawn shield: ${shield} pawns nearby`;
      if (shield <= 1 && !castled) s += ' (exposed)';
      else if (shield >= 2 && castled) s += ' (safe)';
      return s;
    };
    return `King safety (DO NOT contradict): ${describe(wkSq, wHasCastled, wShield, 'White')}. ${describe(bkSq, bHasCastled, bShield, 'Black')}.`;
  } catch { return ''; }
}

// ── Piece activity - count legal moves available to each side's minor/major pieces ──
// More legal moves = more active pieces. This is a deterministic mobility metric.
function pieceActivityNotes(fen) {
  try {
    const fenParts = fen.split(' ');
    // Count mobility for the side to move first, then flip
    const sideToMove = fenParts[1];
    const countMobility = (testFen) => {
      const g = new Chess(testFen);
      const moves = g.moves({ verbose: true });
      // Only count moves of N, B, R, Q (not pawn or king - those are noisy)
      return moves.filter(m => ['n','b','r','q'].includes(m.piece)).length;
    };
    const mobMove = countMobility(fen);
    // Flip side to move to count opponent's mobility
    const flippedParts = fenParts.slice();
    flippedParts[1] = sideToMove === 'w' ? 'b' : 'w';
    const mobOpp = countMobility(flippedParts.join(' '));
    const wMob = sideToMove === 'w' ? mobMove : mobOpp;
    const bMob = sideToMove === 'b' ? mobMove : mobOpp;
    let verdict;
    const diff = wMob - bMob;
    if (Math.abs(diff) <= 3)        verdict = 'Both sides have roughly equal piece activity.';
    else if (Math.abs(diff) <= 8)   verdict = `${diff > 0 ? 'White' : 'Black'} has slightly more active pieces.`;
    else                            verdict = `${diff > 0 ? 'White' : 'Black'} has significantly more active pieces.`;
    return `Piece activity (DO NOT contradict): White's minor and major pieces have ${wMob} legal moves total; Black's have ${bMob}. ${verdict}`;
  } catch { return ''; }
}

// ── Space - measured by pawn advancement ──
// Counts squares "controlled" by pawns past the middle of the board.
function spaceNotes(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    let wSpace = 0, bSpace = 0;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const c = board[r][f];
        if (!c || c.type !== 'p') continue;
        const rank = 8 - r; // 1-8
        // White pawn past rank 4 = advanced into enemy half
        if (c.color === 'w' && rank >= 5) wSpace += (rank - 4);
        // Black pawn past rank 5 = advanced into enemy half
        if (c.color === 'b' && rank <= 4) bSpace += (5 - rank);
      }
    }
    let verdict;
    const diff = wSpace - bSpace;
    if (Math.abs(diff) <= 1)       verdict = 'Both sides have roughly equal space.';
    else if (Math.abs(diff) <= 3)  verdict = `${diff > 0 ? 'White' : 'Black'} has slightly more space.`;
    else                           verdict = `${diff > 0 ? 'White' : 'Black'} has a clear space advantage.`;
    return `Space (DO NOT contradict): White's space score is ${wSpace}, Black's is ${bSpace}. ${verdict}`;
  } catch { return ''; }
}

// Reports castling-rights changes, bishop-pair changes, and trades.
function chessConceptNotes(d) {
  const notes = [];
  const cn = c => c === 'w' ? 'White' : 'Black';
  const moverColor = d.mover;
  const moverName  = cn(moverColor);
  const oppColor   = moverColor === 'w' ? 'b' : 'w';
  const oppName    = cn(oppColor);

  try {
    if (!d.fenAfter) return '';
    const gBefore = new Chess(d.fen);
    const gAfter  = new Chess(d.fenAfter);
    const bBefore = gBefore.board();
    const bAfter  = gAfter.board();
    const count = (board, color, type) => {
      let n = 0;
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const c = board[r][f];
          if (c && c.color === color && c.type === type) n++;
        }
      return n;
    };

    // ── Bishop pair change ──
    const mBishB = count(bBefore, moverColor, 'b');
    const mBishA = count(bAfter,  moverColor, 'b');
    if (mBishB === 2 && mBishA === 1) {
      notes.push(`${moverName} gave up the bishop pair. In open positions two bishops are significantly stronger than a bishop and knight.`);
    }
    const oBishB = count(bBefore, oppColor, 'b');
    const oBishA = count(bAfter,  oppColor, 'b');
    if (oBishB === 2 && oBishA === 1) {
      notes.push(`${oppName} lost the bishop pair as a result of this move.`);
    }

    // ── Castling rights ──
    const fenBefore    = d.fen.split(' ');
    const fenAfter     = d.fenAfter.split(' ');
    const castleBefore = fenBefore[2] || '-';
    const castleAfter  = fenAfter[2]  || '-';
    const san = d.san || '';
    const isCastling = san.startsWith('O-O');
    if (!isCastling) {
      if (moverColor === 'w') {
        const hadRights = castleBefore.includes('K') || castleBefore.includes('Q');
        const hasRights = castleAfter.includes('K')  || castleAfter.includes('Q');
        if (hadRights && !hasRights) {
          notes.push(`${moverName} lost all remaining castling rights with this move.`);
        }
      } else {
        const hadRights = castleBefore.includes('k') || castleBefore.includes('q');
        const hasRights = castleAfter.includes('k')  || castleAfter.includes('q');
        if (hadRights && !hasRights) {
          notes.push(`${moverName} lost all remaining castling rights with this move.`);
        }
      }
    }
  } catch {}

  if (!notes.length) return '';
  return `\nMove-driven concept changes:\n${notes.map(n => '  - ' + n).join('\n')}`;
}

// ── Bishop pair status (current state, not change) ──
function bishopPairStatus(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    let wb = 0, bb = 0;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const c = board[r][f];
      if (!c || c.type !== 'b') continue;
      if (c.color === 'w') wb++; else bb++;
    }
    const wHas = wb >= 2;
    const bHas = bb >= 2;
    if (!wHas && !bHas) return '';
    let s = 'Bishop pair (DO NOT contradict): ';
    if (wHas && bHas)      s += 'Both sides still have the bishop pair.';
    else if (wHas)         s += 'White has the bishop pair, Black does not.';
    else                   s += 'Black has the bishop pair, White does not.';
    return s;
  } catch { return ''; }
}

// ── Open / semi-open files ──
// An OPEN file has no pawns of either color. A SEMI-OPEN file (for one side)
// has no pawns of that side but at least one enemy pawn.
function openFilesNotes(fen) {
  try {
    const g = new Chess(fen);
    const board = g.board();
    const wHas = Array(8).fill(false), bHas = Array(8).fill(false);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const c = board[r][f];
      if (!c || c.type !== 'p') continue;
      if (c.color === 'w') wHas[f] = true; else bHas[f] = true;
    }
    const open = [];
    for (let f = 0; f < 8; f++) {
      if (!wHas[f] && !bHas[f]) open.push(String.fromCharCode(97 + f));
    }
    if (!open.length) return '';
    return `Open files (DO NOT contradict): the ${open.join(', ')}-file${open.length > 1 ? 's are' : ' is'} fully open (no pawns of either color). Open files are valuable for rooks and queens.`;
  } catch { return ''; }
}

// ── BEST-MOVE LOOKAHEAD ──
// Plays the engine's best line (up to 3 plies) starting from preFen, and
// annotates each ply in plain English. This gives Claude a deterministic
// 3-move-ahead view of why the engine's preferred move is good.
//
// Inputs: preFen = position BEFORE the move was played, lineSAN = engine PV
// (whitespace-separated SAN moves; first move is the engine's #1 choice).
// Returns a multi-line string ready to inject as a *** BEST-MOVE LOOKAHEAD ***
// block, or '' if data is missing.
function bestMoveLookahead(preFen, lineSAN) {
  if (!preFen || !lineSAN) return '';
  const tokens = String(lineSAN).trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (!tokens.length) return '';

  const pieceNames = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  function countMaterial(g) {
    const board = g.board();
    let w = 0, b = 0;
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const c = board[r][f]; if (!c) continue;
      if (c.color === 'w') w += VAL[c.type]; else b += VAL[c.type];
    }
    return { w, b };
  }

  let g;
  try { g = new Chess(preFen); } catch { return ''; }
  const startMat = countMaterial(g);

  const lines = [];
  const moverNames = { w: 'White', b: 'Black' };
  let bestMoveLabel = tokens[0];
  let mateFound = false;
  let materialDelta = 0; // positive = White ahead vs start, negative = Black ahead

  for (let i = 0; i < tokens.length; i++) {
    const san = tokens[i];
    const moverColor = g.turn();
    let move;
    try { move = g.move(san, { sloppy: true }); } catch { move = null; }
    if (!move) {
      lines.push(`  Ply ${i + 1}: (could not parse "${san}")`);
      break;
    }
    const piece = pieceNames[move.piece] || 'piece';
    let desc = `${moverNames[moverColor]} plays ${move.san} (${piece} ${move.from}→${move.to})`;
    if (move.captured) {
      const cap = pieceNames[move.captured] || 'piece';
      desc += `, capturing ${moverNames[moverColor === 'w' ? 'b' : 'w']}'s ${cap}`;
    }
    if (g.in_checkmate())     { desc += ' - CHECKMATE'; mateFound = true; }
    else if (g.in_check())    { desc += ' (check)'; }
    else if (g.in_stalemate()){ desc += ' - stalemate (draw)'; }
    lines.push(`  Ply ${i + 1}: ${desc}`);
    if (g.in_checkmate() || g.in_stalemate()) break;
  }

  // Material delta after the lookahead
  const endMat = countMaterial(g);
  const startDiff = startMat.w - startMat.b;
  const endDiff   = endMat.w - endMat.b;
  materialDelta   = endDiff - startDiff; // positive = White gained material vs start

  let summary;
  if (mateFound) {
    summary = `RESULT: The best move leads to CHECKMATE within ${lines.length} plies.`;
  } else if (materialDelta > 0) {
    summary = `RESULT: After 3 plies White is up ${materialDelta} point${materialDelta === 1 ? '' : 's'} of material compared to the starting position.`;
  } else if (materialDelta < 0) {
    summary = `RESULT: After 3 plies Black is up ${-materialDelta} point${materialDelta === -1 ? '' : 's'} of material compared to the starting position.`;
  } else {
    summary = `RESULT: After 3 plies material is unchanged from the starting position.`;
  }

  return `\n\n*** BEST-MOVE LOOKAHEAD (engine's preferred line, 3 plies) ***
Engine's #1 move: ${bestMoveLabel}
${lines.join('\n')}
${summary}
PRIORITY HIERARCHY for the Best Move section: (1) checkmate, (2) winning material (queen > rook > minor piece > pawn), (3) saving your own material, (4) king safety, (5) castling rights, (6) passed pawn, (7) bishop pair / open file, (8) avoiding doubled or isolated pawns, (9) piece activity, (10) space. Pick the HIGHEST priority benefit visible in the lookahead above and base your Best Move sentence on that ONE benefit only.
*** END BEST-MOVE LOOKAHEAD ***`;
}

// Perspective header for move templates: tells Claude who played the move and
// which pronouns to use, preventing "your rook" on the opponent's piece.
function perspectiveHeader(d) {
  const moverName   = colorName(d.mover);
  const studentName = colorName(d.color);
  const oppName     = colorName(d.mover === 'w' ? 'b' : 'w');
  const isOwn       = d.mover === d.color;
  if (isOwn) {
    return `Student plays as: ${studentName}. This is the STUDENT'S OWN move.
PRONOUNS: "you/your" = ${studentName} (the student). "your opponent" = ${oppName}.
When discussing the engine's better alternative: say "you could have played [move] instead".`;
  } else {
    return `Student plays as: ${studentName}. This is the OPPONENT'S move (${moverName} moved).
PRONOUNS: "you/your" = ${studentName} (the student). "your opponent" = ${oppName} = the one who made this move.
When discussing the engine's better alternative for the opponent: say "your opponent could have played [move] instead" (NOT "you"). Do NOT say "you had [move] available" because the student did NOT move here.`;
  }
}

// Full move context: exact origin square, what was captured, check status, and
// resulting board. Explicit grounding eliminates hallucinations about positions.
function moveDetail(d) {
  const pieceNames = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
  const tn         = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  // ── Detect piece type (handle castling correctly) ──
  const sanClean = (d.san || '').replace(/[+#!?]/g, '');
  let pieceName;
  if (sanClean.startsWith('O-O-O')) {
    pieceName = `king (queenside castling: king ${d.from} → ${d.to}, rook also moves)`;
  } else if (sanClean.startsWith('O-O')) {
    pieceName = `king (kingside castling: king ${d.from} → ${d.to}, rook also moves)`;
  } else {
    const firstCh = sanClean[0];
    pieceName = pieceNames[firstCh] || 'pawn'; // lowercase first char = pawn in SAN
  }

  // ── Capture target ──
  let captureStr = '';
  if (d.san && d.san.includes('x') && d.fen) {
    try {
      const g      = new Chess(d.fen);
      const target = g.get(d.to);
      if (target) captureStr = `, capturing ${colorName(target.color)}'s ${tn[target.type]} on ${d.to}`;
    } catch {}
  }

  // ── En-passant flag ──
  const epStr = (d.san && d.san.includes('x') && !captureStr) ? ' (en-passant capture)' : '';

  // ── Check / checkmate status after the move ──
  let checkStr = '';
  if (d.fenAfter) {
    try {
      const g = new Chess(d.fenAfter);
      if (g.in_checkmate())    checkStr = `\nResult: This move delivers CHECKMATE.`;
      else if (g.in_check())   checkStr = `\nNote: After this move the ${g.turn() === 'w' ? 'White' : 'Black'} king is in check.`;
      else if (g.in_stalemate()) checkStr = `\nResult: This move causes stalemate (draw).`;
    } catch {}
  }

  // ── Promotion ──
  const promoMatch = sanClean.match(/=([QRBN])$/);
  const promoStr   = promoMatch ? ` (promotes to ${pieceNames[promoMatch[1]]})` : '';

  // ── Best-move verdict: compare stripping +/#/!/? so "Bg3" and "Bg3+" match ──
  const stripAnnot = s => (s || '').replace(/[+#!?]/g, '').trim();
  const playedCore = stripAnnot(d.san);
  const bestCore   = stripAnnot(d.best);
  let bestStr = '';
  if (d.best && d.best !== '?') {
    if (bestCore === playedCore) {
      bestStr = `\nENGINE VERDICT: The played move (${d.san}) IS the engine's #1 choice for this position. Do NOT say the engine preferred something else.`;
    } else {
      bestStr = `\nENGINE VERDICT: The played move (${d.san}) was NOT the engine's top choice. The engine preferred ${d.best} instead. Do NOT say the played move was the engine's preferred move.`;
    }
  }

  // ── Engine top moves for this position (before the move was played) ──
  const topMovesStr = d.topMoves
    ? `\nEngine's ranked move options for this position (BEFORE the move was played):\n${d.topMoves}\nIMPORTANT: These are what the engine considered for this position. Use the ENGINE VERDICT line above to decide whether the played move was #1 or not - do NOT infer that from this list independently. You may name move #1 as the best alternative (if the played move wasn't #1). Never name moves #3 or lower.`
    : '';

  // ── Checkmate-in-one detection (only mates, no checks) ──
  const threatBeforeStr = d.threatsBefore
    ? `\nBEFORE this move - ${d.threatsBefore}`
    : '';
  const threatAfterStr = d.threatsAfter
    ? `\nAFTER this move - ${d.threatsAfter}`
    : '';

  const before      = boardDescription(d.fen);
  const after       = d.fenAfter ? boardDescription(d.fenAfter) : '';
  const pawnBefore  = pawnStructureNotes(d.fen);
  const pawnAfter   = d.fenAfter ? pawnStructureNotes(d.fenAfter) : '';
  const conceptStr  = chessConceptNotes(d);

  // ── The 10 deterministic positional concepts (computed for AFTER the move) ──
  // These are the ONLY chess factors Claude is allowed to discuss.
  // Use the EFFECTIVE material balance - i.e. after the engine's continuation
  // settles (recaptures included) - when available, so Claude doesn't claim a
  // side is "up a piece" when the next move recaptures it. Falls back to the
  // raw post-move material balance if no continuation FEN is available.
  let matAfter = '';
  if (d.fenAfterContFinal) {
    const eff = materialBalance(d.fenAfterContFinal);
    if (eff) matAfter = eff + ' (this is the EFFECTIVE balance after the engine continuation finishes - use this verdict, NOT a snapshot taken before recaptures.)';
  }
  if (!matAfter && d.fenAfter) matAfter = materialBalance(d.fenAfter);
  const kingAfter  = d.fenAfter ? kingSafetyNotes(d.fenAfter)   : '';
  const actAfter   = d.fenAfter ? pieceActivityNotes(d.fenAfter): '';
  const spaceAfter = d.fenAfter ? spaceNotes(d.fenAfter)        : '';
  const bishopPair = d.fenAfter ? bishopPairStatus(d.fenAfter)  : '';
  const openFiles  = d.fenAfter ? openFilesNotes(d.fenAfter)    : '';

  // ── Pawn structure after the continuation's FIRST move ──
  let pawnAfterCont = '';
  if (d.fenAfterCont) {
    const raw = pawnStructureNotes(d.fenAfterCont);
    if (raw && raw !== pawnAfter) {
      pawnAfterCont = raw.replace(
        'Pawn structure facts (DO NOT contradict these - only claim weaknesses listed here):',
        'Pawn structure AFTER opponent\'s best response (DO NOT contradict these):'
      );
    }
  }

  // ── DETERMINISTIC POSITIONAL FACTS BLOCK ──
  // These are the ONLY 10 concepts Claude is permitted to mention in the
  // Structure section. Computed by code, not inferred by the model.
  const factsLines = [];
  if (pawnAfter)     factsLines.push(pawnAfter.trim());          // doubled/tripled, isolated, passed pawns
  if (pawnAfterCont) factsLines.push(pawnAfterCont.trim());      // pawn structure after opponent reply
  if (conceptStr)    factsLines.push(conceptStr.trim());         // castling rights, bishop-pair changes
  if (matAfter)      factsLines.push(matAfter);                  // material balance
  if (kingAfter)     factsLines.push(kingAfter);                 // king safety
  if (actAfter)      factsLines.push(actAfter);                  // piece activity
  if (spaceAfter)    factsLines.push(spaceAfter);                // space
  if (bishopPair)    factsLines.push(bishopPair);                // bishop pair status
  if (openFiles)     factsLines.push(openFiles);                 // open files
  const obsBlock = factsLines.length
    ? `\n\n*** DETERMINISTIC POSITIONAL FACTS - these are the ONLY 10 concepts you may discuss ***
The Structure section MUST be based on EXACTLY ONE of these ten factors and NOTHING else:
  1. Doubled/tripled pawns
  2. Isolated pawns
  3. Passed pawns
  4. Bishop pair
  5. Open files
  6. King castling rights
  7. King safety (pawn shield, exposed king)
  8. Material balance
  9. Piece activity (mobility)
  10. Space (pawn advancement)
You are FORBIDDEN from mentioning any other positional concept (no weak squares, no outposts, no color complexes, no fianchetto, no prophylaxis, etc.). Pick the SINGLE most relevant of the 10 for the Structure section.

${factsLines.join('\n')}
*** END FACTS ***`
    : '';

  // ── BEST-MOVE LOOKAHEAD (3 plies of engine's preferred line from preFen) ──
  // Lets Claude prioritize concrete benefits (mate > material > king safety > …)
  // when describing what the engine's best move would have achieved.
  const lookaheadStr = bestMoveLookahead(d.fen, d.bestLineSAN || '');

  // ── Best continuation AFTER the move ──
  // Each half-move annotated in plain English so Claude reads facts, not notation.
  const continuationStr = d.continuation
    ? `\nWHAT HAPPENS NEXT - Engine continuation (for YOUR internal understanding only):\n${d.continuation}\n\nHOW TO USE THIS: Read the continuation silently to understand the SINGLE most important outcome (e.g. a piece is lost, a checkmate is threatened, a trade occurs). Then express ONLY that one outcome in plain English. NEVER narrate multiple future events. NEVER say "your queen gets taken, then your knight is lost, then..." - just state the worst single consequence. Do NOT say "the eval shifted."`
    : '';

  return `${before}${pawnBefore}${threatBeforeStr}
Move played: ${colorName(d.mover)}'s ${pieceName} from ${d.from || '?'} → ${d.to || '?'}${captureStr}${epStr}${promoStr}.${checkStr}${bestStr}${topMovesStr}
Position AFTER the move:
${after}${threatAfterStr}${obsBlock}${lookaheadStr}${continuationStr}`;
}

// ---- Personality helper: returns a short flavour line or empty string ----
function persHint() {
  if (typeof currentPersonality !== 'undefined' && currentPersonality?.primary) {
    const p = currentPersonality.primary;
    return `\nThe player's personality is "${p.name.replace(/^The\s+/i,'')}". If the move fits their style, weave in a brief personal touch (e.g. "classic you", "right up your alley", "very much your style"). Keep it natural and short. Never force it if the move doesn't fit.`;
  }
  return '';
}

// ---- Prompt templates (one per explanation type) ----
const TEMPLATES = {

  position: (d) => {
    const studentColor = colorName(d.color);
    const toMoveColor  = d.turn === 'w' ? 'White' : 'Black';
    const isStudentTurn = d.turn === d.color;
    const oppColor     = d.color === 'w' ? 'Black' : 'White';
    const turnCtx = isStudentTurn
      ? `It is YOUR turn (${studentColor} to move). The engine's best moves listed below are moves YOU can play.`
      : `It is YOUR OPPONENT'S turn (${toMoveColor} to move). The engine's best moves listed below are moves YOUR OPPONENT can play - NOT you. NEVER say "you should play X" or suggest the student capture anything, because it is not the student's turn. Only describe what the opponent is likely to do based on the engine's top moves list.`;
    const pawnNotes = pawnStructureNotes(d.fen);
    return withThoughts(
`${GROUNDING_GUARD}
Chess coach explaining a position to a beginner.
The student is playing as ${studentColor}.
${turnCtx}
Engine evaluation: ${d.eval} (positive = White ahead; negative = Black ahead)
${boardDescription(d.fen)}${pawnNotes}

${d.threats || 'No checkmate in one move is available.'}
${d.topMoves ? `\nEngine's best moves for this position:\n${d.topMoves}\n` : ''}
${d.evalCtx ? d.evalCtx + '\n' : ''}${persHint()}

STRICT OUTPUT RULES:
- If a CHECKMATE IN ONE is listed above, mention it first.
- Do NOT mention centipawns, material numbers, or "pawns worth".
- You may ONLY name the engine's #1 and #2 moves.
- NEVER invent threats, plans, or tactical ideas not explicitly shown in the engine data above. If the engine lists a move, you may say the player (or opponent) will likely play that. Otherwise do not speculate.
- If the pawn structure notes list doubled or tripled pawns, you may mention them as a positional factor.
- CRITICAL: If it is the opponent's turn, NEVER say "you should play X" or "you can capture Y". Say what the OPPONENT is likely to do.

In 2 sentences, describe the position from ${studentColor}'s view. ${isStudentTurn ? `State the engine's best move for you naturally.` : `State what your opponent is most likely to play (from the engine's top moves) and why it is a concern.`} Use "you/your" for ${studentColor}.
${FMT_SHORT}`, d.thoughts);
  },

  good: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: GOOD move. Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow the pronoun rules above exactly.
Section guidance: Overview = state this was a good move and what it achieves in plain terms. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space) and describe it. Best Move = state the engine's preferred move and explain its benefit using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  brilliant: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: BRILLIANT MOVE (sacrifice). Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow the pronoun rules above exactly.
Section guidance: Overview = name what was sacrificed and call it brilliant. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space) and describe it. Best Move = explain how the sacrifice pays off using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  inaccuracy: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: INACCURACY. Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow the pronoun rules above EXACTLY.
Section guidance: Overview = state the engine's preferred move and that this was a small inaccuracy. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain why the engine's move is better using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  mistake: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: MISTAKE. Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns, material numbers, or "pawns worth". Follow the pronoun rules above EXACTLY.
Section guidance: Overview = state the engine's preferred move and that this was a mistake. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain what the engine's move achieves using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  blunder: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: BLUNDER. Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns, material numbers, or "pawns worth". Follow the pronoun rules above EXACTLY.
Section guidance: Overview = state the engine's preferred move and that this was a serious blunder. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain what the engine's move would have achieved using one of those same 6 concepts. Be blunt but kind.
${FMT_STRUCTURED}`, d.thoughts),

  neutral: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Eval went from ${d.eb} to ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow the pronoun rules above EXACTLY.
Section guidance: Overview = state what this move does and that it's a solid, neutral choice. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain what the engine suggests using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  book: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: BOOK MOVE (opening theory). Engine eval: ${d.ea}
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow pronoun rules exactly.
Section guidance: Overview = state this is a book move and what opening principle it follows. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain what the opening aims for in terms of one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  bookBad: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: dubious book move. Eval went from ${d.eb} to ${d.ea}.
${CHESS_CONCEPTS}
${persHint()}

Do NOT mention centipawns or material numbers. Follow pronoun rules exactly.
Section guidance: Overview = name the engine's preferred move and that this deviates from theory. Structure = pick exactly ONE concept from the FACTS block (doubled pawns, castling rights, king safety, material, piece activity, or space). Best Move = explain what the theory move achieves using one of those same 6 concepts.
${FMT_STRUCTURED}`, d.thoughts),

  summary: (d) => {
    const playerSide = colorName(d.color);
    const thoughts = d.thoughts || [];
    const lines = thoughts.filter(t => t.value).map(t => `${t.label}: "${t.value}"`);
    const thoughtStr = lines.length ? '\nPlayer reflections:\n' + lines.join('\n') : '';
    const persLine = (typeof currentPersonality !== 'undefined' && currentPersonality?.primary)
      ? `\nThe player's chess personality is "${currentPersonality.primary.name.replace(/^The\s+/i,'')}". Weave in 1-2 indirect style references (e.g. "very much your style", "fits how you typically play"). Do NOT name the personality directly.` : '';
    return `You are a chess coach writing a short game story for a beginner. Base every claim on the move list and turning-point data below. Do NOT invent moves, tactics, or positions not in the data.
The student was playing as ${playerSide}.
Moves: ${d.moves}
Result: ${d.result}
Key turning points:
${d.turns}${thoughtStr}${persLine}

STRICT RULES:
- ONLY reference moves and events listed in the data above.
- Do NOT name moves that are not in the move list or turning points.
- If unsure about a detail, omit it.

Write a game narrative using EXACTLY these 4 section headers (use ## markdown headers):

## The Opening Battle
1-2 sentences. How did the opening go based on the move list? Keep it factual.

## The Turning Point
2-3 sentences. What was the critical moment from the turning-point data? Name the specific move and eval change.

## How It Ended
1-2 sentences. What was the result and how was it decided?

## Your Takeaway
1 sentence. One concrete lesson from this game based on the data.

Speak from the student's (${playerSide}'s) perspective. No jargon. No bullet points.
${FMT_LONG}`;
  },

  // ---- Best-move-only (for the "Analyze Move" button) ----
  bestMoveOnly: (d) => withThoughts(
`${GROUNDING_GUARD}
Chess coach. A beginner is reviewing a game.
${perspectiveHeader(d)}
${moveDetail(d)}
Classification: ${d.cls ? d.cls.toUpperCase() : 'unknown'}. Eval went from ${d.eb} to ${d.ea}
${persHint()}

Do NOT mention centipawns, material numbers, or "pawns worth". Follow the pronoun rules above exactly.
${FMT_BESTMOVE}`, d.thoughts),

  // ---- Game highlights (3 short takeaways shown as overlay after analysis) ----
  highlights: (d) => {
    const persLine = (typeof currentPersonality !== 'undefined' && currentPersonality?.primary)
      ? `The player's chess personality is "${currentPersonality.primary.name.replace(/^The\s+/i,'')}". Make one highlight feel personal to their style without naming the personality directly (e.g. "very much your style of play").` : '';
    return `You are a chess coach. Return exactly 3 highlights based ONLY on the data below. Do NOT invent moves or events not in the data.
The player was ${colorName(d.color)}.

Moves: ${d.moves}
Result: ${d.result}
Book depth: ${d.bookEnd} plies out of ${d.totalPly}
Key moments:
${d.turns || 'No major mistakes.'}
${persLine}

Return ONLY a valid JSON array with exactly 3 objects, no other text. No em-dashes (-) anywhere. Each object has:
- "icon": one emoji (use varied ones like \u{1F6E1}\u{FE0F} \u{1F3AF} \u{2694}\u{FE0F} \u{1F3F0} \u{1F48E} \u{1F525} \u{26A1} \u{1F9E0} \u{2728} \u{1FA96} \u{1F451} \u{1F4AA})
- "title": 2-3 word title
- "sub": one short sentence about the player's game, based only on the data above

Example: [{"icon":"\u{1F6E1}\u{FE0F}","title":"Solid Defence","sub":"You held firm under heavy pressure."},{"icon":"\u{1F3AF}","title":"Key Tactic","sub":"Your knight sacrifice on move 18 was decisive."},{"icon":"\u{26A1}","title":"Fast Finish","sub":"You converted your advantage efficiently."}]`;
  },

  // ---- Improvement advice (called once after full analysis) ----
  improve: (d) => {
    const playerSide = colorName(d.color);
    const thoughts = d.thoughts || [];
    const lines = thoughts.filter(t => t.value).map(t => `${t.label}: "${t.value}"`);
    const thoughtStr = lines.length ? '\nThe player shared these reflections:\n' + lines.join('\n') : '';
    const persLine = (typeof currentPersonality !== 'undefined' && currentPersonality?.primary)
      ? `\nThe player's chess personality is "${currentPersonality.primary.name.replace(/^The\s+/i,'')}" (${currentPersonality.primary.tagline}). Make the advice feel personal to their style with 1-2 indirect references (e.g. "this is very much your kind of game", "fits your natural approach"). Do NOT name the personality directly.` : '';
    return `You are a warm but direct chess coach. A beginner just played a game as ${playerSide}.

Game result: ${d.result}
Book moves ended at ply ${d.bookEnd} (out of ${d.totalPly} plies).
Key mistakes:
${d.turns || 'No major mistakes found.'}${thoughtStr}${persLine}

STRICT RULES:
- ONLY reference mistakes and events listed in the data above.
- Do NOT invent moves, positions, or habits not supported by the data.
- If the data shows no major mistakes, say so honestly.

Write improvement advice using EXACTLY 3 sections with these ## markdown headers. Each section is 1-2 sentences. No bullet points. Be specific to this game's data.

## The Pattern to Break
Name the most costly mistake from the data above. Reference the specific move and eval change.

## Your Training Plan
One specific exercise that targets the mistake pattern above.

## What You Already Do Well
Name something positive from the data (e.g. strong opening depth, few mistakes). Be specific.

${thoughtStr ? 'If the player shared reflections, acknowledge them briefly.' : ''}
${FMT_LONG}`;
  }
};

// ---- Resolve API endpoint & credentials ----
function _getApiBase() {
  return (window.CP_CONFIG?.PROXY_URL || '').trim();
}
function _getLicenseKey() {
  return localStorage.getItem('cp-license-key') || '';
}

async function _callProxy(endpoint, prompt) {
  const proxyBase = _getApiBase();
  const licenseKey = _getLicenseKey();

  if (proxyBase) {
    // ── Production: call Cloudflare Worker ──────────────────────
    const headers = { 'Content-Type': 'application/json' };
    if (licenseKey) headers['X-License-Key'] = licenseKey;

    const res = await fetch(proxyBase + endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt })
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 402) {
      // Server-enforced free limit
      const err = new Error('free_limit_reached');
      err.code = 'free_limit_reached';
      throw err;
    }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.text || '(empty response)';

  } else {
    // ── Local dev fallback: call Anthropic directly ──────────────
    const apiKey = document.getElementById('apiKey')?.value?.trim() || '';
    if (!apiKey) throw new Error('No API key configured.');

    const isLong = endpoint === '/api/claude-long';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isLong ? 950 : 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text || '(empty response)';
  }
}

// ---- Public API call functions ----
async function callClaude(prompt, _apiKey) {
  return _callProxy('/api/claude', prompt);
}

async function callClaudeLong(prompt, _apiKey) {
  return _callProxy('/api/claude-long', prompt);
}

// ---- License key verification (calls worker) ----
async function verifyLicenseKey(key) {
  const proxyBase = _getApiBase();
  if (!proxyBase) {
    // Dev mode: accept any key starting with CP-
    return key.startsWith('CP-');
  }
  try {
    const res = await fetch(proxyBase + '/api/verify-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    const data = await res.json();
    return !!data.valid;
  } catch { return false; }
}
