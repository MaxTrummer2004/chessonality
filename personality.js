/* ============================================================
   personality.js - Chess Personality System
   8 unique personalities, questionnaire, game-based scoring
   ============================================================ */

'use strict';

// ── The 8 Chess Personalities ──────────────────────────────────
const PERSONALITIES = {
  anaconda: {
    id: 'anaconda',
    name: 'The Anaconda',
    emoji: '🐍',
    color: '#22c55e',
    colorDark: '#166534',
    gradient: 'linear-gradient(135deg, #0a3d1f 0%, #166534 40%, #22c55e 100%)',
    tagline: 'Slow. Patient. Deadly.',
    description: 'You constrict your opponent move by move, slowly improving your position until there\'s no escape. You don\'t need flashy tactics. Your quiet moves are more dangerous than any sacrifice.',
    traits: ['Positional', 'Patient', 'Precise'],
    playstyle: 'You prefer long, strategic games where you gradually outplay your opponent. You rarely blunder and your moves have a clear purpose.',
    famous: 'Karpov • Rubinstein'
  },
  eagle: {
    id: 'eagle',
    name: 'The Eagle',
    emoji: '🦅',
    color: '#3b82f6',
    colorDark: '#1e3a8a',
    gradient: 'linear-gradient(135deg, #0c1e3d 0%, #1e3a8a 40%, #3b82f6 100%)',
    tagline: 'See everything. Strike once.',
    description: 'You soar above the board and see what others miss. When the moment comes, you strike with surgical precision. One combination, one blow, game over.',
    traits: ['Tactical', 'Sharp', 'Decisive'],
    playstyle: 'You thrive in positions with tactical opportunities. Your calculation is your superpower, and you convert advantages cleanly.',
    famous: 'Kasparov • Alekhine'
  },
  fox: {
    id: 'fox',
    name: 'The Fox',
    emoji: '🦊',
    color: '#f59e0b',
    colorDark: '#92400e',
    gradient: 'linear-gradient(135deg, #451a03 0%, #92400e 40%, #f59e0b 100%)',
    tagline: 'Tricky. Creative. Unpredictable.',
    description: 'You play moves that make your opponent uncomfortable. You love unusual positions, creative ideas, and setting traps that look innocent but are deadly.',
    traits: ['Creative', 'Resourceful', 'Tricky'],
    playstyle: 'You like to create chaos and play in positions where creativity matters more than memorisation. You\'re dangerous even when losing.',
    famous: 'Tal • Rapport'
  },
  lion: {
    id: 'lion',
    name: 'The Lion',
    emoji: '🦁',
    color: '#e94560',
    colorDark: '#7f1d1d',
    gradient: 'linear-gradient(135deg, #3b0a0a 0%, #7f1d1d 40%, #e94560 100%)',
    tagline: 'Attack. Dominate. Conquer.',
    description: 'You play for the king from move one. Material is fuel for your attack. You sacrifice without hesitation when checkmate is in the air. Defence is for other people.',
    traits: ['Aggressive', 'Fearless', 'Dominant'],
    playstyle: 'You open aggressively and aim for quick, decisive attacks. You\'d rather win a brilliant game than a safe one.',
    famous: 'Morphy • Shirov'
  },
  owl: {
    id: 'owl',
    name: 'The Owl',
    emoji: '🦉',
    color: '#8b5cf6',
    colorDark: '#3b0764',
    gradient: 'linear-gradient(135deg, #1a0033 0%, #3b0764 40%, #8b5cf6 100%)',
    tagline: 'Deep thought. Quiet power.',
    description: 'You understand chess at a deeper level. Your preparation is thorough, your technique polished, and you rarely make the same mistake twice. Knowledge is your weapon.',
    traits: ['Methodical', 'Prepared', 'Technical'],
    playstyle: 'You know your openings deeply, play principled chess, and excel in technical positions. You study hard and it shows.',
    famous: 'Kramnik • Caruana'
  },
  shark: {
    id: 'shark',
    name: 'The Shark',
    emoji: '🦈',
    color: '#06b6d4',
    colorDark: '#164e63',
    gradient: 'linear-gradient(135deg, #042f2e 0%, #164e63 40%, #06b6d4 100%)',
    tagline: 'Smell blood. Never let go.',
    description: 'Once you get an advantage, it\'s over. You convert the smallest edge with relentless precision, grinding your opponent down until resistance is futile.',
    traits: ['Relentless', 'Clinical', 'Efficient'],
    playstyle: 'You excel at converting advantages. You don\'t need brilliance. Your consistency and technique make you incredibly hard to beat.',
    famous: 'Carlsen • Fischer'
  },
  phoenix: {
    id: 'phoenix',
    name: 'The Phoenix',
    emoji: '🔥',
    color: '#ff6b6b',
    colorDark: '#9a3412',
    gradient: 'linear-gradient(135deg, #2d0a00 0%, #9a3412 40%, #ff6b6b 100%)',
    tagline: 'From the ashes. Reborn.',
    description: 'You never give up. When others would resign, you find the one chance: the swindle, the trap, the miracle save. Your opponents learn to fear even their winning positions against you.',
    traits: ['Resilient', 'Tenacious', 'Clutch'],
    playstyle: 'You fight to the very end and thrive under pressure. You\'re at your best when things look worst.',
    famous: 'Lasker • Topalov'
  },
  turtle: {
    id: 'turtle',
    name: 'The Turtle',
    emoji: '🐢',
    color: '#94a3b8',
    colorDark: '#1e293b',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #64748b 100%)',
    tagline: 'Unbreakable. Impenetrable. Solid.',
    description: 'Your defence is a work of art. You make almost no mistakes, and opponents break themselves trying to crack your position. You don\'t need to attack. You just need to not lose.',
    traits: ['Solid', 'Defensive', 'Unshakeable'],
    playstyle: 'You play safe, solid chess with very few errors. You\'re incredibly hard to beat and thrive in drawish or defensive positions.',
    famous: 'Petrosian • Andersson'
  }
};

// Ordered array for iteration
const PERSONALITY_LIST = Object.values(PERSONALITIES);

// ── Dynamic questionnaire - 1-to-10 scale per question ────────
// Each question has a left label (value 1) and right label (value 10).
// Low values weight towards leftWeights, high values towards rightWeights.
// gameInfo: { opponent, colorLabel, result, totalMoves, openingLine }
function generateQuestionnaire(gi) {
  const opp = gi.opponent || 'your opponent';

  // Q1 - Control vs Chaos
  const q1 = {
    question: `How in control did you feel against ${opp}?`,
    labelLeft:  'Total chaos',
    labelRight: 'Fully in control',
    // Low (chaos) → fox, lion, phoenix.  High (control) → anaconda, owl, shark
    leftWeights:  { fox: 3, lion: 2, phoenix: 2 },
    rightWeights: { anaconda: 3, owl: 2, shark: 2 }
  };

  // Q2 - Opening knowledge
  const q2 = {
    question: 'How well did you know the opening?',
    labelLeft:  'Completely improvised',
    labelRight: 'Deeply prepared',
    leftWeights:  { fox: 2, lion: 3, phoenix: 1 },
    rightWeights: { owl: 4, anaconda: 2, shark: 1 }
  };

  // Q3 - Aggression vs Defence
  const q3 = {
    question: 'How aggressive were you in this game?',
    labelLeft:  'Purely defensive',
    labelRight: 'All-out attack',
    leftWeights:  { turtle: 4, phoenix: 2, anaconda: 1 },
    rightWeights: { lion: 4, eagle: 2, fox: 1 }
  };

  // Q4 - Risk taking
  const q4 = {
    question: 'How much risk did you take?',
    labelLeft:  'Played it safe',
    labelRight: 'Big risks',
    leftWeights:  { turtle: 3, anaconda: 3, owl: 1 },
    rightWeights: { fox: 3, lion: 2, phoenix: 2 }
  };

  // Q5 - Result-specific: resilience / dominance / precision
  let q5;
  if (gi.result === 'loss') {
    q5 = {
      question: 'How hard did you fight in this loss?',
      labelLeft:  'Gave up early',
      labelRight: 'Fought to the last move',
      leftWeights:  { owl: 2, anaconda: 1 },
      rightWeights: { phoenix: 4, turtle: 2, lion: 1 }
    };
  } else if (gi.result === 'win') {
    q5 = {
      question: 'How dominant did your win feel?',
      labelLeft:  'Barely scraped by',
      labelRight: 'Total domination',
      leftWeights:  { phoenix: 3, fox: 2, turtle: 1 },
      rightWeights: { shark: 4, eagle: 3, lion: 2 }
    };
  } else {
    q5 = {
      question: 'How close were you to winning this draw?',
      labelLeft:  'Lucky to survive',
      labelRight: 'Should have won',
      leftWeights:  { phoenix: 3, turtle: 3 },
      rightWeights: { eagle: 2, shark: 3, lion: 1 }
    };
  }

  return [q1, q2, q3, q4, q5];
}

// Active questionnaire (set by generateQuestionnaire each game)
let QUESTIONNAIRE = [];


// ── Compute personality from game data + questionnaire ──────────

function computeGameStats() {
  // Count errors for the player's side only
  let mistakes = 0, blunders = 0, goodMoves = 0;
  let wasLosingBadly = false;  // player was -200+ at some point
  let wasWinning = false;      // player was +200+ at some point
  let evalSwings = 0;          // big eval changes between consecutive plies
  let biggestComebackCp = 0;   // largest deficit player recovered from

  let worstEval = 0;  // worst eval from player's perspective
  let bestEval  = 0;

  for (let i = 1; i < positions.length; i++) {
    const mover = positions[i].turn === 'b' ? 'w' : 'b';
    const cls = classifyMove(i);

    if (mover === playerColor) {
      if (cls === 'mistake') mistakes++;
      if (cls === 'blunder' || cls === 'book-blunder') blunders++;
      if (cls === 'good' || cls === 'book') goodMoves++;
    }

    // Track eval from player's perspective
    if (evals[i]) {
      const playerEval = playerColor === 'w' ? evals[i].cp : -evals[i].cp;
      if (playerEval < -200) wasLosingBadly = true;
      if (playerEval > 200) wasWinning = true;
      if (playerEval < worstEval) worstEval = playerEval;
      if (playerEval > bestEval) bestEval = playerEval;
    }

    // Count eval swings (>150cp between consecutive moves)
    if (evals[i] && evals[i - 1]) {
      const swing = Math.abs(evals[i].cp - evals[i - 1].cp);
      if (swing > 150) evalSwings++;
    }
  }

  // Did player come back from behind?
  if (wasLosingBadly && bestEval > 0) {
    biggestComebackCp = Math.abs(worstEval) + bestEval;
  }

  // Determine result from player's perspective
  const lastG = new Chess(positions[positions.length - 1].fen);
  let result = 'unknown';
  if (lastG.in_checkmate()) {
    result = lastG.turn() === playerColor ? 'loss' : 'win';
  } else if (lastG.in_draw() || lastG.in_stalemate()) {
    result = 'draw';
  } else {
    // Infer from final eval
    const fe = evals[positions.length - 1];
    if (fe) {
      const pEval = playerColor === 'w' ? fe.cp : -fe.cp;
      if (pEval > 300) result = 'win';
      else if (pEval < -300) result = 'loss';
      else result = 'draw';
    }
  }

  // Book depth
  let bookEnd = 0;
  for (let i = bookMoves.length - 1; i >= 0; i--) { if (bookMoves[i]) { bookEnd = i; break; } }

  const totalMoves = Math.ceil((positions.length - 1) / 2);

  return {
    mistakes, blunders, goodMoves, totalMoves,
    bookDepth: Math.ceil(bookEnd / 2),
    result,
    wasLosingBadly, wasWinning,
    evalSwings,
    biggestComebackCp,
    worstEval, bestEval
  };
}

function scorePersonalitiesFromGame(stats) {
  const s = {};
  PERSONALITY_LIST.forEach(p => s[p.id] = 0);

  const errors = stats.mistakes + stats.blunders;
  const errorRate = errors / Math.max(stats.totalMoves, 1);

  // ── Clean play (few errors) ──
  if (errors === 0)     { s.anaconda += 4; s.turtle += 4; s.shark += 3; s.owl += 2; }
  else if (errors <= 2) { s.anaconda += 2; s.turtle += 2; s.shark += 2; s.owl += 1; }
  else if (errors <= 4) { s.fox += 1; s.phoenix += 1; }
  else                  { s.phoenix += 3; s.fox += 2; s.lion += 1; }

  // ── Deep book knowledge ──
  if (stats.bookDepth >= 8)      { s.owl += 4; s.anaconda += 1; }
  else if (stats.bookDepth >= 5) { s.owl += 2; }
  else if (stats.bookDepth <= 2) { s.fox += 1; s.lion += 1; }

  // ── Comeback from behind ──
  if (stats.wasLosingBadly && stats.result === 'win')  { s.phoenix += 5; s.fox += 2; }
  if (stats.wasLosingBadly && stats.result === 'draw')  { s.phoenix += 3; s.turtle += 2; }

  // ── Dominant win (always ahead) ──
  if (stats.wasWinning && !stats.wasLosingBadly && stats.result === 'win') {
    s.shark += 4; s.anaconda += 2;
  }

  // ── Chaotic game (many eval swings) ──
  if (stats.evalSwings > 6)      { s.fox += 4; s.lion += 2; s.phoenix += 2; }
  else if (stats.evalSwings > 3) { s.fox += 2; s.lion += 1; }
  else                           { s.anaconda += 2; s.turtle += 1; s.owl += 1; }

  // ── Long positional game ──
  if (stats.totalMoves > 40 && errors <= 3) { s.anaconda += 4; s.turtle += 2; }
  if (stats.totalMoves > 50)                { s.anaconda += 2; s.turtle += 2; }

  // ── Short decisive game ──
  if (stats.totalMoves <= 25 && stats.result === 'win') { s.lion += 4; s.eagle += 3; }

  // ── Clean win (no blunders) ──
  if (stats.blunders === 0 && stats.result === 'win') { s.eagle += 3; s.shark += 2; }

  // ── Good moves ratio ──
  const goodRatio = stats.goodMoves / Math.max(stats.totalMoves, 1);
  if (goodRatio > 0.6) { s.eagle += 2; s.owl += 2; }

  // ── Loss but fought well ──
  if (stats.result === 'loss' && errors <= 2) { s.turtle += 4; s.phoenix += 2; }

  // ── Many blunders but still won ──
  if (stats.blunders >= 3 && stats.result === 'win') { s.phoenix += 3; s.fox += 2; }

  return s;
}

function scorePersonalitiesFromQuestionnaire(answers) {
  const s = {};
  PERSONALITY_LIST.forEach(p => s[p.id] = 0);

  for (const ans of answers) {
    // ans is { questionIdx, value: 1-10 }
    const q = QUESTIONNAIRE[ans.questionIdx];
    if (!q) continue;

    // value 1 → 100% leftWeights, 0% rightWeights
    // value 10 → 0% leftWeights, 100% rightWeights
    const t = (ans.value - 1) / 9; // 0..1
    const leftMul  = 1 - t;
    const rightMul = t;

    if (q.leftWeights) {
      for (const [pid, w] of Object.entries(q.leftWeights)) {
        s[pid] = (s[pid] || 0) + w * leftMul;
      }
    }
    if (q.rightWeights) {
      for (const [pid, w] of Object.entries(q.rightWeights)) {
        s[pid] = (s[pid] || 0) + w * rightMul;
      }
    }
  }

  return s;
}

function determinePersonality(gameScores, questionnaireScores) {
  const combined = {};
  PERSONALITY_LIST.forEach(p => {
    // Game data weighted slightly more than questionnaire
    combined[p.id] = (gameScores[p.id] || 0) * 1.2 + (questionnaireScores[p.id] || 0);
  });

  // Sort by score descending
  const sorted = Object.entries(combined).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, v]) => sum + Math.max(0, v), 0) || 1;

  return {
    primary: PERSONALITIES[sorted[0][0]],
    secondary: PERSONALITIES[sorted[1][0]],
    scores: sorted.map(([id, score]) => ({
      personality: PERSONALITIES[id],
      score: Math.max(0, score),
      pct: Math.round(Math.max(0, score) / total * 100)
    }))
  };
}

// Save personality result to history (IndexedDB)
async function savePersonalityToHistory(personalityResult) {
  try {
    const all = await dbGetHistory();
    if (all.length > 0) {
      // Update the most recent entry with personality data
      const latest = all[0];
      latest.personality = personalityResult.primary.id;
      latest.personalityScores = personalityResult.scores.map(s => ({
        id: s.personality.id, pct: s.pct
      }));
      await dbSaveHistoryEntry(latest);
    }
  } catch (err) { console.warn('savePersonalityToHistory failed:', err); }
}

// Get aggregate personality across all games (async, uses IndexedDB)
async function getAggregatePersonality() {
  let history = [];
  try { history = await dbGetHistory(); } catch {}

  const totals = {};
  PERSONALITY_LIST.forEach(p => totals[p.id] = 0);

  let gamesWithPersonality = 0;
  for (const entry of history) {
    if (entry.personalityScores) {
      gamesWithPersonality++;
      for (const s of entry.personalityScores) {
        totals[s.id] = (totals[s.id] || 0) + s.pct;
      }
    }
  }

  if (gamesWithPersonality === 0) return null;

  const sorted = Object.entries(totals)
    .map(([id, total]) => ({ personality: PERSONALITIES[id], pct: Math.round(total / gamesWithPersonality) }))
    .sort((a, b) => b.pct - a.pct);

  return {
    primary: sorted[0].personality,
    totalGames: gamesWithPersonality,
    breakdown: sorted
  };
}
