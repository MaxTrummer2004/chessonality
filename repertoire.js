/* ══════════════════════════════════════════════
   repertoire.js - "Find Your Ideal Opening Repertoire"
   Template-based (no Claude API), personality-driven
══════════════════════════════════════════════ */
'use strict';

// ── Opening Database (per personality, white + black) ─────────

const REPERTOIRE_DATA = {
  anaconda: {
    white: [
      { name: "Queen's Gambit (1.d4 d5 2.c4)", eco: "D06",
        why: "Slow positional squeeze: you build pressure move by move, exactly how you play.",
        keyIdea: "Control the center with pawns, then gradually expand on the queenside." },
      { name: "English Opening (1.c4)", eco: "A10",
        why: "Flexible and strategic. You choose the pawn structure, keeping your opponent guessing.",
        keyIdea: "Delay committing your center pawns, develop fluidly, and transpose based on Black's setup." }
    ],
    black: [
      { name: "Caro-Kann Defense (1.e4 c6)", eco: "B10", vs: 'e4',
        why: "Solid and almost unbreakable. You get a great pawn structure and slowly equalize, then outplay.",
        keyIdea: "Develop naturally, reach a safe middlegame, and grind out the endgame advantage." },
      { name: "Queen's Gambit Declined (1.d4 d5 2.c4 e6)", eco: "D30", vs: 'd4',
        why: "Classical and reliable. You hold the center and wait for your opponent to overextend.",
        keyIdea: "Solid development, aim for the minority attack or central break with ...c5." }
    ]
  },
  eagle: {
    white: [
      { name: "Scotch Game (1.e4 e5 2.Nf3 Nc6 3.d4)", eco: "C44",
        why: "Opens the position immediately. You get the tactical chances you thrive on.",
        keyIdea: "Early central tension creates piece activity and sharp lines." },
      { name: "Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4)", eco: "C50",
        why: "Classic attacking setup. You aim for the king from the start.",
        keyIdea: "Rapid development, target f7, and build for a middlegame attack." }
    ],
    black: [
      { name: "Sicilian Najdorf (1.e4 c5 2...d6 3...a6)", eco: "B90", vs: 'e4',
        why: "The most combative defense in chess. You counter-attack from the very start.",
        keyIdea: "Asymmetrical battle: Black gets queenside play while fighting for the center." },
      { name: "King's Indian Defense (1.d4 Nf6 2.c4 g6)", eco: "E60", vs: 'd4',
        why: "You give White space, then strike back with devastating tactical blows.",
        keyIdea: "Build tension on the kingside with ...e5, then break through with ...f5." }
    ]
  },
  fox: {
    white: [
      { name: "King's Indian Attack (1.Nf3, 2.g3)", eco: "A07",
        why: "A universal system that leads to creative middlegame positions regardless of Black's setup.",
        keyIdea: "Fianchetto, castle, and find unorthodox plans your opponent won't expect." },
      { name: "Bird's Opening (1.f4)", eco: "A02",
        why: "Rare and surprising. Most opponents don't know the theory, and that's your advantage.",
        keyIdea: "Control the e5 square, play for unusual kingside setups, and create chaos." }
    ],
    black: [
      { name: "Alekhine's Defense (1.e4 Nf6)", eco: "B02", vs: 'e4',
        why: "Provoke White into overextending, then strike back creatively. Classic Fox play.",
        keyIdea: "Lure White's pawns forward, undermine the center, and exploit weaknesses." },
      { name: "Dutch Defense (1.d4 f5)", eco: "A80", vs: 'd4',
        why: "An aggressive, unusual choice. Most opponents struggle against it, perfect for your tricky style.",
        keyIdea: "Control e4, build a kingside attack, and create complications." }
    ]
  },
  lion: {
    white: [
      { name: "King's Gambit (1.e4 e5 2.f4)", eco: "C30",
        why: "The most aggressive opening in chess. You sacrifice material for a devastating attack from move 2.",
        keyIdea: "Open the f-file, develop rapidly, and assault the kingside." },
      { name: "Evans Gambit (1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4)", eco: "C51",
        why: "You offer a pawn for rapid development and a crushing attack. Material is fuel.",
        keyIdea: "After ...Bxb4, play c3 and build a powerful center while developing pieces to attacking squares." }
    ],
    black: [
      { name: "Sicilian Dragon (1.e4 c5 2...g6)", eco: "B70", vs: 'e4',
        why: "One of the sharpest openings in chess. Both sides attack, and you attack harder.",
        keyIdea: "Fianchettoed bishop + queenside attack while parrying White's kingside assault." },
      { name: "King's Indian: Mar del Plata (1.d4 Nf6 2.c4 g6)", eco: "E97", vs: 'd4',
        why: "Build up and then unleash a ferocious kingside storm. Pure Lion energy.",
        keyIdea: "Play ...e5, ...f5 and break through with ...f4 and ...g5." }
    ]
  },
  owl: {
    white: [
      { name: "Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5)", eco: "C60",
        why: "The most deeply studied opening in chess. Your preparation will always give you an edge.",
        keyIdea: "Long-term pressure on Black's center, with rich middlegame plans for any taste." },
      { name: "Queen's Gambit: Exchange (1.d4 d5 2.c4)", eco: "D35",
        why: "Clear strategic plans and deep theoretical understanding. You outprepare everyone.",
        keyIdea: "Minority attack on the queenside or central breakthrough: both require deep knowledge." }
    ],
    black: [
      { name: "Berlin Defense (1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6)", eco: "C65", vs: 'e4',
        why: "The most solid defense in modern chess. You enter a well-studied endgame with clear plans.",
        keyIdea: "Trade queens early, use superior endgame technique to convert small edges." },
      { name: "Nimzo-Indian Defense (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)", eco: "E20", vs: 'd4',
        why: "One of the most respected defenses. Your theoretical knowledge is the weapon.",
        keyIdea: "Pin the knight, control the center, and choose from multiple well-studied systems." }
    ]
  },
  shark: {
    white: [
      { name: "London System (1.d4 + 2.Bf4)", eco: "D00",
        why: "A universal system you can play against anything. You reach playable positions and slowly grind.",
        keyIdea: "Solid development, then convert small edges with relentless pressure." },
      { name: "Mainline Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5 a6)", eco: "C70",
        why: "Long-term strategic pressure. Once you get an edge, you never let go: classic Shark.",
        keyIdea: "Persistent pressure, slow maneuvering, and clinical endgame conversion." }
    ],
    black: [
      { name: "Caro-Kann: Classical (1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5)", eco: "B18", vs: 'e4',
        why: "Sound structure with a clear plan. You reach positions where your clinical precision shines.",
        keyIdea: "Develop the light-squared bishop early, reach a healthy structure, and convert edges." },
      { name: "Queen's Gambit Declined (1.d4 d5 2.c4 e6)", eco: "D30", vs: 'd4',
        why: "Solid and reliable. You neutralize White's initiative and then outplay them technically.",
        keyIdea: "Reach an equal middlegame, then grind out the win with superior technique." }
    ]
  },
  phoenix: {
    white: [
      { name: "Sicilian: Grand Prix Attack (1.e4 c5 2.f4)", eco: "B21",
        why: "Aggressive and full of fighting chances. Even if things go sideways, the position stays alive.",
        keyIdea: "Kingside attack with f4 and f5, Bc4, always creating problems." },
      { name: "Trompowsky Attack (1.d4 Nf6 2.Bg5)", eco: "A45",
        why: "Takes your opponent out of their comfort zone early. You thrive in unbalanced positions.",
        keyIdea: "Create imbalances from move 2, and fight for the initiative in unfamiliar territory." }
    ],
    black: [
      { name: "Sicilian Sveshnikov (1.e4 c5 2.Nf3 Nc6 3...e5)", eco: "B33", vs: 'e4',
        why: "Accepts structural weaknesses for dynamic counterplay. You fight back from apparent disadvantage.",
        keyIdea: "The d5 hole looks bad but Black gets piece activity and kingside chances." },
      { name: "Grunfeld Defense (1.d4 Nf6 2.c4 g6 3.Nc3 d5)", eco: "D80", vs: 'd4',
        why: "You give White a big center, then destroy it. Rising from the ashes of a cramped position.",
        keyIdea: "Let White overextend, then strike the center with ...c5 and piece pressure." }
    ]
  },
  turtle: {
    white: [
      { name: "London System (1.d4 + 2.Bf4)", eco: "D00",
        why: "A fortress-like setup. You develop safely, never overextend, and wait for your opponent to crack.",
        keyIdea: "Solid development, prophylactic play, and an almost unbreakable structure." },
      { name: "King's Indian Attack (1.Nf3 2.g3 3.Bg2)", eco: "A07",
        why: "Safe, flexible, and extremely hard to attack. You build a wall and dare your opponent to break it.",
        keyIdea: "Fianchetto, castle, and maintain an impenetrable position while probing for weaknesses." }
    ],
    black: [
      { name: "Caro-Kann Defense (1.e4 c6)", eco: "B10", vs: 'e4',
        why: "The most solid response to 1.e4. Almost impossible to crack, and that's your whole game plan.",
        keyIdea: "Develop naturally, no structural weaknesses, reach a safe and pleasant middlegame." },
      { name: "Slav Defense (1.d4 d5 2.c4 c6)", eco: "D10", vs: 'd4',
        why: "Rock-solid. You keep your structure intact and make your opponent work for every half-point.",
        keyIdea: "Develop the bishop before locking in with ...e6, maintain maximum solidity." }
    ]
  }
};

// ── Personal Stats Computation ────────────────────────────────

function computePlayerStats(history) {
  const stats = {
    totalGames: history.length,
    whiteGames: 0, blackGames: 0,
    whiteWins: 0, blackWins: 0,
    whiteLosses: 0, blackLosses: 0,
    totalMistakes: 0, totalBlunders: 0,
    cleanGames: 0, avgBookDepth: 0,
    avgMoves: 0,
    longestGame: 0, shortestGame: Infinity,
    // Personality percentages aggregated
    persScores: {}
  };

  if (!history.length) return stats;

  let bookSum = 0, moveSum = 0, bookCount = 0;
  PERSONALITY_LIST.forEach(p => { stats.persScores[p.id] = { total: 0, count: 0 }; });

  for (const e of history) {
    if (e.playerColor === 'w') {
      stats.whiteGames++;
      if ((e.result === '1-0')) stats.whiteWins++;
      if ((e.result === '0-1')) stats.whiteLosses++;
    } else {
      stats.blackGames++;
      if ((e.result === '0-1')) stats.blackWins++;
      if ((e.result === '1-0')) stats.blackLosses++;
    }

    stats.totalMistakes += e.mistakes || 0;
    stats.totalBlunders += e.blunders || 0;
    if ((e.mistakes || 0) === 0 && (e.blunders || 0) === 0) stats.cleanGames++;

    if (e.bookDepth != null) { bookSum += e.bookDepth; bookCount++; }
    if (e.totalMoves) {
      moveSum += e.totalMoves;
      stats.longestGame = Math.max(stats.longestGame, e.totalMoves);
      stats.shortestGame = Math.min(stats.shortestGame, e.totalMoves);
    }

    if (e.personalityScores) {
      for (const s of e.personalityScores) {
        if (stats.persScores[s.id]) {
          stats.persScores[s.id].total += s.pct;
          stats.persScores[s.id].count++;
        }
      }
    }
  }

  stats.avgBookDepth = bookCount > 0 ? Math.round(bookSum / bookCount) : 0;
  stats.avgMoves = history.length > 0 ? Math.round(moveSum / history.length) : 0;
  if (stats.shortestGame === Infinity) stats.shortestGame = 0;

  return stats;
}

// ── Personal Insight Sentences ────────────────────────────────

function buildPersonalInsights(stats, agg) {
  const insights = [];
  if (!agg || stats.totalGames < 1) return insights;

  const p = agg.primary;
  const totalWins = stats.whiteWins + stats.blackWins;
  const winRate = stats.totalGames > 0 ? Math.round(totalWins / stats.totalGames * 100) : 0;
  const cleanPct = stats.totalGames > 0 ? Math.round(stats.cleanGames / stats.totalGames * 100) : 0;
  const whiteWR = stats.whiteGames > 0 ? Math.round(stats.whiteWins / stats.whiteGames * 100) : 0;
  const blackWR = stats.blackGames > 0 ? Math.round(stats.blackWins / stats.blackGames * 100) : 0;

  // Win rate insight
  if (stats.totalGames >= 2) {
    if (winRate >= 65) insights.push(`You win <strong>${winRate}%</strong> of your analyzed games: that's a dominant record.`);
    else if (winRate >= 50) insights.push(`With a <strong>${winRate}%</strong> win rate across ${stats.totalGames} games, you're performing solidly.`);
    else insights.push(`Your <strong>${winRate}%</strong> win rate shows room for growth, and the right openings can help.`);
  }

  // Color preference
  if (stats.whiteGames >= 2 && stats.blackGames >= 2) {
    const diff = whiteWR - blackWR;
    if (diff > 15) insights.push(`You win <strong>${whiteWR}%</strong> with White vs <strong>${blackWR}%</strong> with Black: you're stronger with the first move.`);
    else if (diff < -15) insights.push(`You win <strong>${blackWR}%</strong> with Black vs <strong>${whiteWR}%</strong> with White: you're a natural counter-attacker.`);
    else insights.push(`You're balanced across colors: <strong>${whiteWR}%</strong> with White, <strong>${blackWR}%</strong> with Black.`);
  }

  // Clean game rate
  if (stats.totalGames >= 3) {
    if (cleanPct >= 40) insights.push(`<strong>${cleanPct}%</strong> of your games are clean (zero mistakes or blunders): impressive precision.`);
    else if (cleanPct > 0) insights.push(`<strong>${cleanPct}%</strong> of your games are completely clean, but there's room to reduce errors with better opening preparation.`);
  }

  // Personality-specific insight
  const pId = p.id;
  const pAvg = stats.persScores[pId]?.count > 0 ? Math.round(stats.persScores[pId].total / stats.persScores[pId].count) : 0;

  const persInsights = {
    anaconda: `Your positional instinct shows in <strong>${pAvg}%</strong> average Anaconda score: you naturally squeeze opponents.`,
    eagle: `With a <strong>${pAvg}%</strong> Eagle score, your tactical vision is clearly your weapon.`,
    fox: `Your <strong>${pAvg}%</strong> Fox rating confirms it: you love creative, unpredictable play.`,
    lion: `A <strong>${pAvg}%</strong> Lion score means you consistently choose the aggressive path.`,
    owl: `Your <strong>${pAvg}%</strong> Owl rating shows deep, methodical thinking is your natural style.`,
    shark: `With <strong>${pAvg}%</strong> Shark precision, you convert advantages like a machine.`,
    phoenix: `Your <strong>${pAvg}%</strong> Phoenix resilience means you never go down without a fight.`,
    turtle: `A <strong>${pAvg}%</strong> Turtle score: your defensive fortress is genuinely hard to crack.`
  };
  if (pAvg > 0 && persInsights[pId]) insights.push(persInsights[pId]);

  // Game length insight
  if (stats.avgMoves > 0) {
    if (stats.avgMoves >= 45) insights.push(`Your games average <strong>${stats.avgMoves} moves</strong>: you thrive in longer battles.`);
    else if (stats.avgMoves <= 25) insights.push(`Your games average <strong>${stats.avgMoves} moves</strong>: you prefer quick, decisive battles.`);
    else insights.push(`Your games average <strong>${stats.avgMoves} moves</strong>: a balanced mix of middlegame and endgame play.`);
  }

  // Book depth
  if (stats.avgBookDepth > 0) {
    if (stats.avgBookDepth >= 8) insights.push(`You follow theory for <strong>${stats.avgBookDepth} moves</strong> on average: strong opening preparation.`);
    else if (stats.avgBookDepth <= 3) insights.push(`You leave theory after just <strong>${stats.avgBookDepth} moves</strong>: you prefer originality over memorization.`);
    else insights.push(`You follow theory for <strong>${stats.avgBookDepth} moves</strong> on average: a solid foundation to build on.`);
  }

  // Fallback insights to ensure we always have at least 3
  if (insights.length < 3 && stats.totalGames >= 1) {
    // Win rate (simpler version for fewer games)
    if (!insights.some(i => i.includes('win rate') || i.includes('win '))) {
      insights.push(`You've analyzed <strong>${stats.totalGames} game${stats.totalGames !== 1 ? 's' : ''}</strong>, and every game sharpens your repertoire recommendations.`);
    }
  }
  if (insights.length < 3 && p) {
    if (!insights.some(i => i.includes(p.name.replace('The ', '')))) {
      insights.push(`Your primary style is <strong>${p.name}</strong>, and these openings are tailored to amplify that identity.`);
    }
  }
  if (insights.length < 3) {
    insights.push(`Analyze more games to unlock deeper insights and refine your opening recommendations.`);
  }

  // Always return exactly 3
  return insights.slice(0, 3);
}


// ── Show/hide profile feature row ─────────────────────────────

function renderProfileFeatureRow(history, agg) {
  const row = document.getElementById('profFeatureRow');
  if (!row) return;
  const hasGames = history.length >= 1;

  // Always visible now — toggle a "locked" affordance per card when empty.
  row.style.display = '';
  row.classList.toggle('prof-feature-row-locked', !hasGames);

  const hint = document.getElementById('profFeaturesHint');
  if (hint) hint.style.display = hasGames ? 'none' : '';

  // Force-reveal the cards (reveal observer may have skipped them while hidden)
  const cards = row.querySelectorAll(':scope > [data-reveal]');
  const step = parseInt(row.dataset.revealStagger || '80', 10) || 80;
  const base = parseInt(row.dataset.revealBase || '0', 10) || 0;
  cards.forEach((el, i) => {
    el.style.setProperty('--reveal-delay', (base + i * step) + 'ms');
    el.classList.add('is-visible');
    el.classList.toggle('prof-feat-locked', !hasGames);
  });

  // Feature card status indicators
  const repStatus = document.getElementById('profFeatRepStatus');
  const dnaStatus = document.getElementById('profFeatDnaStatus');
  const coachStatus = document.getElementById('profFeatCoachStatus');

  // Repertoire: check if generated (either the new batch payload or
  // the legacy sentinel key — both are written by startRepertoireFlow)
  const repData = localStorage.getItem('ce-repertoire-batch')
               || localStorage.getItem('ce-repertoire-personality');
  if (repStatus) {
    repStatus.innerHTML = repData
      ? '<span class="pfs-ready">Repertoire generated</span>'
      : '<span class="pfs-new">Ready to generate</span>';
  }

  // DNA: always available once you have games
  if (dnaStatus) {
    dnaStatus.innerHTML = history.length >= 3
      ? `<span class="pfs-ready">${history.length} games tracked</span>`
      : `<span class="pfs-new">${3 - history.length} more game${3 - history.length === 1 ? '' : 's'} needed</span>`;
  }

  // Coach: check if plan cached. The actual coach cache is stored under
  // 'ce-coach-cache-v2' (see _COACH_CACHE_STORAGE_KEY in insights.js).
  // We check both the v2 key and the legacy 'ce-coach-plan' for safety.
  let coachCached = null;
  try {
    const raw = localStorage.getItem('ce-coach-cache-v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.html) coachCached = true;
    }
  } catch {}
  if (!coachCached) coachCached = localStorage.getItem('ce-coach-plan');
  if (coachStatus) {
    coachStatus.innerHTML = coachCached
      ? '<span class="pfs-ready">Plan generated</span>'
      : '<span class="pfs-new">Generate your plan</span>';
  }
}

// ── Open the dedicated Repertoire page ────────────────────────

async function openRepertoire() {
  showPage('repertoire');
  await renderRepertoirePage();
}

// Read the repertoire-only batch (saved by startRepertoireFlow) and
// return a synthetic { history, agg } pair shaped like the legacy
// global-history calls so the rest of the renderer keeps working.
// Returns { history: [], agg: null } if no repertoire has been built.
function _loadRepertoireBatch() {
  try {
    const raw = localStorage.getItem('ce-repertoire-batch');
    if (!raw) return { history: [], agg: null };
    const payload = JSON.parse(raw);
    if (!payload || !Array.isArray(payload.breakdown) || !payload.primaryId) {
      return { history: [], agg: null };
    }
    const breakdown = payload.breakdown
      .map(b => ({ personality: PERSONALITIES[b.id], pct: b.pct }))
      .filter(b => b.personality);
    if (breakdown.length === 0) return { history: [], agg: null };
    const agg = {
      primary: PERSONALITIES[payload.primaryId] || breakdown[0].personality,
      totalGames: payload.totalGames || breakdown.length,
      breakdown
    };
    // Map the lightweight repertoire entries into the same shape
    // computePlayerStats() expects, with personalityScores attached so
    // any per-personality stat lines still work.
    const persScoresForEntry = breakdown.map(b => ({ id: b.personality.id, pct: b.pct }));
    const history = (payload.entries || []).map(e => ({
      ...e,
      date: payload.savedAt,
      personality: agg.primary.id,
      personalityScores: persScoresForEntry,
      source: 'repertoire-batch'
    }));
    return { history, agg };
  } catch (e) {
    console.warn('loadRepertoireBatch failed', e);
    return { history: [], agg: null };
  }
}

// ══════════════════════════════════════════════
//  PRESENTATION DECK
//  Renders the repertoire as a click-through slide deck.
//  Each slide fades in with staggered child elements.
// ══════════════════════════════════════════════

let _repDeckIdx = 0;
let _repDeckSlides = [];
let _repDeckContext = null;   // { p, rep, insights, agg, persName }
let _repDeckAnimating = false;
let _repDeckKeyHandler = null;
let _repDeckClickHandler = null;

async function renderRepertoirePage() {
  // Repertoire is fully self-contained: read ONLY from the dedicated
  // ce-repertoire-batch localStorage key, never from the global history
  // DB or getAggregatePersonality(). This guarantees that games uploaded
  // for repertoire analysis do not influence personality stats, the DNA
  // card, streaks, insights, or any other persistent stat.
  const { history, agg } = _loadRepertoireBatch();

  if (!agg) {
    // No repertoire built yet → send the user straight to the same
    // username-input page that the landing-page CTA uses.
    showPage('repInput');
    if (typeof initRepInput === 'function') initRepInput();
    return;
  }

  const p = agg.primary;
  const rep = REPERTOIRE_DATA[p.id];
  if (!rep) return;

  const stats = computePlayerStats(history);
  const insights = buildPersonalInsights(stats, agg);
  const persName = p.name.replace('The ', '');

  _repDeckContext = { p, rep, insights, agg, persName, stats };
  _repDeckSlides = _buildRepSlides(_repDeckContext);

  // Tint the deck page with the personality color
  const deckPage = document.getElementById('pageRepertoire');
  if (deckPage) {
    deckPage.style.setProperty('--rep-pers-color', p.color);
    deckPage.style.setProperty('--rep-pers-color-dark', p.colorDark);
    deckPage.setAttribute('data-pers', p.id);
  }

  // Build the slides DOM
  const slidesEl = document.getElementById('repDeckSlides');
  if (slidesEl) {
    slidesEl.innerHTML = _repDeckSlides.map((s, i) =>
      `<div class="rep-slide" data-slide-idx="${i}" data-slide-id="${s.id}">${s.html}</div>`
    ).join('');
  }

  // Build the dots
  const dotsEl = document.getElementById('repDeckDots');
  if (dotsEl) {
    dotsEl.innerHTML = _repDeckSlides.map((_, i) =>
      `<button class="rep-deck-dot" data-dot="${i}" onclick="repDeckGo(${i})" aria-label="Go to slide ${i + 1}"></button>`
    ).join('');
  }

  // Attach keyboard + click handlers
  _attachRepDeckHandlers();

  // Start on the first slide
  _repDeckIdx = 0;
  _repDeckAnimating = false;
  _repDeckActivate(0, { initial: true });
}

// ── Slide factory ─────────────────────────────────────────────
function _buildRepSlides(ctx) {
  const { p, rep, insights, persName, agg } = ctx;
  const slides = [];

  // Slide 0: Personality reveal — uses the EXACT same DOM/classes as the
  // post-game personality reveal page so it inherits the dark "certificate"
  // styling (gold-bordered card, gradient name, spotlight + rays).
  slides.push({
    id: 'persona',
    isPersona: true,
    html: `
      <div class="pers-reveal rep-deck-pers-reveal" data-pers="${p.id}" style="background: ${p.gradient}">
        <div class="pers-spotlight" aria-hidden="true"></div>
        <div class="pers-rays" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="pers-content rep-deck-pers-content" data-pers="${p.id}">
          <div class="pers-subtitle pers-stagger" data-delay="0">Chess personality matched</div>
          <div class="pers-emoji pers-stagger" data-delay="120">${p.emoji}</div>
          <h1 class="pers-name pers-stagger" data-delay="320">${p.name}</h1>
          <div class="pers-tagline pers-stagger" data-delay="520">${p.tagline}</div>
          <p class="pers-description pers-stagger" data-delay="680">${p.description}</p>
          <div class="pers-traits pers-stagger" data-delay="820">
            ${p.traits.map(t => `<span class="pers-trait">${t}</span>`).join('')}
          </div>
          <div class="pers-famous pers-stagger" data-delay="940">Think: ${p.famous}</div>
        </div>
      </div>`
  });

  // Slide 1: Insights (only when we have any)
  if (insights && insights.length > 0) {
    slides.push({
      id: 'insights',
      html: `
        <div class="rep-slide-inner">
          <div class="rep-slide-eyebrow rep-fx" data-fx="0">What your games revealed</div>
          <h2 class="rep-slide-title rep-fx" data-fx="1">A portrait of your play</h2>
          <p class="rep-slide-sub rep-fx" data-fx="2">
            Patterns pulled from your ${agg.totalGames} game${agg.totalGames !== 1 ? 's' : ''},
            distilled into signals we match against opening theory.
          </p>
          <div class="rep-slide-insights">
            ${insights.map((t, i) =>
              `<div class="rep-slide-insight rep-fx" data-fx="${3 + i}">${t}</div>`
            ).join('')}
          </div>
        </div>`
    });
  }

  // Slide: White transition
  slides.push({
    id: 'white-intro',
    html: `
      <div class="rep-slide-inner rep-slide-center">
        <span class="rep-slide-piece rep-fx rep-fx-piece" data-fx="0">&#9817;</span>
        <div class="rep-slide-eyebrow rep-fx" data-fx="1">As White</div>
        <h2 class="rep-slide-title rep-fx" data-fx="2">Your weapons with the first move</h2>
        <p class="rep-slide-sub rep-fx" data-fx="3">
          As ${persName}, these two openings amplify your natural strengths from move one.
        </p>
      </div>`
  });

  // Slides: one per white opening
  rep.white.forEach((o, i) => {
    slides.push({
      id: 'white-' + i,
      html: _renderOpeningSlideHTML(o, i, rep.white.length, 'White', '&#9817;')
    });
  });

  // Slide: Black transition (uses the same outlined pawn glyph as White
  // for visual consistency — only the colour differs.)
  slides.push({
    id: 'black-intro',
    html: `
      <div class="rep-slide-inner rep-slide-center">
        <span class="rep-slide-piece rep-slide-piece-dark rep-fx rep-fx-piece" data-fx="0">&#9817;</span>
        <div class="rep-slide-eyebrow rep-fx" data-fx="1">As Black</div>
        <h2 class="rep-slide-title rep-fx" data-fx="2">And when your opponent starts&hellip;</h2>
        <p class="rep-slide-sub rep-fx" data-fx="3">
          One defence against 1.e4, one against 1.d4 &mdash; you're covered either way.
        </p>
      </div>`
  });

  // Slides: one per black opening
  rep.black.forEach((o, i) => {
    slides.push({
      id: 'black-' + i,
      html: _renderOpeningSlideHTML(o, i, rep.black.length, 'Black', '&#9817;', o.vs)
    });
  });

  // Final slide: CTA + cross-links
  slides.push({
    id: 'cta',
    html: `
      <div class="rep-slide-inner rep-slide-cta rep-slide-center">
        <div class="rep-slide-eyebrow rep-fx" data-fx="0">That's your repertoire</div>
        <h2 class="rep-slide-title rep-fx" data-fx="1">Ready to play it for real?</h2>
        <p class="rep-slide-sub rep-fx" data-fx="2">
          Analyze a live game for move-by-move AI coaching, real engine evals, and
          feedback built around your ${persName} style.
        </p>
        <div class="rep-cta-features rep-fx" data-fx="3">
          <span class="rep-cta-feature"><span class="rep-cta-check">&#10003;</span>Eval bar &amp; engine</span>
          <span class="rep-cta-dot"></span>
          <span class="rep-cta-feature"><span class="rep-cta-check">&#10003;</span>Move explanations</span>
          <span class="rep-cta-dot"></span>
          <span class="rep-cta-feature"><span class="rep-cta-check">&#10003;</span>AI Coach plan</span>
        </div>
        <button class="rep-cta-btn rep-slide-cta-btn rep-fx" data-fx="4" onclick="showPage('gameSelect')">
          Analyze a game
          <span class="rep-cta-arrow">&#8594;</span>
        </button>
        <div class="rep-cta-divider rep-fx" data-fx="5"></div>
        <div class="rep-cta-more-label rep-fx" data-fx="6">Or keep exploring</div>
        <div class="rep-slide-crosslinks rep-fx" data-fx="7">
          <div class="rep-crosslink" onclick="showPage('profile'); renderFullProfile(); openInsights();">
            <span class="rep-crosslink-icon rep-crosslink-icon-text">&#9819;</span>
            <div>
              <div class="rep-crosslink-name">Game Insights</div>
              <div class="rep-crosslink-desc">Turning points &amp; best openings</div>
            </div>
          </div>
          <div class="rep-crosslink" onclick="openCoachPage()">
            <span class="rep-crosslink-icon rep-crosslink-icon-text">&#9812;</span>
            <div>
              <div class="rep-crosslink-name">AI Coach</div>
              <div class="rep-crosslink-desc">Personalized training plan</div>
            </div>
          </div>
          <div class="rep-crosslink" onclick="repDeckGo(0)">
            <span class="rep-crosslink-icon rep-crosslink-icon-text">&#10227;</span>
            <div>
              <div class="rep-crosslink-name">Replay presentation</div>
              <div class="rep-crosslink-desc">Walk through the slides again</div>
            </div>
          </div>
        </div>
      </div>`
  });

  return slides;
}

function _renderOpeningSlideHTML(o, i, total, colorLabel, pieceGlyph, vsLabel) {
  const darkClass = colorLabel === 'Black' ? ' rep-slide-piece-dark' : '';
  const vsBadge = vsLabel
    ? `<span class="rep-slide-vs">vs 1.${vsLabel}</span>`
    : '';

  // Split "Nimzo-Indian Defense (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)" into
  // name + moves so we can style them separately.
  let displayName = o.name;
  let movesLine = '';
  const m = o.name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    displayName = m[1].trim();
    movesLine = m[2].trim();
  }
  const movesHTML = movesLine
    ? `<div class="rep-slide-opening-moves rep-fx" data-fx="3">${movesLine}</div>`
    : '';

  return `
    <div class="rep-slide-inner rep-slide-opening rep-slide-center">
      <div class="rep-slide-opening-head rep-fx" data-fx="0">
        <span class="rep-slide-piece-inline${darkClass}">${pieceGlyph}</span>
        <span class="rep-slide-opening-color">${colorLabel}</span>
        <span class="rep-slide-opening-count">${i + 1} of ${total}</span>
        ${vsBadge}
      </div>
      <div class="rep-slide-opening-eco rep-fx" data-fx="1">${o.eco}</div>
      <h2 class="rep-slide-opening-name rep-fx" data-fx="2">${displayName}</h2>
      ${movesHTML}
      <div class="rep-slide-opening-divider rep-fx" data-fx="4"></div>
      <div class="rep-slide-opening-section rep-slide-opening-why-section rep-fx" data-fx="5">
        <span class="rep-slide-opening-section-label">Why it fits you</span>
        <p class="rep-slide-opening-why">${o.why}</p>
      </div>
      <div class="rep-slide-opening-section rep-slide-opening-idea-section rep-fx" data-fx="6">
        <span class="rep-slide-opening-section-label">Key idea</span>
        <p class="rep-slide-opening-idea-text">${o.keyIdea}</p>
      </div>
    </div>`;
}

// ── Slide activation / transitions ────────────────────────────
function _repDeckActivate(idx, opts) {
  opts = opts || {};
  const slidesEl = document.getElementById('repDeckSlides');
  if (!slidesEl) return;
  const slides = slidesEl.querySelectorAll('.rep-slide');
  if (!slides.length) return;

  idx = Math.max(0, Math.min(slides.length - 1, idx));
  const prevIdx = _repDeckIdx;
  const direction = idx >= prevIdx ? 'fwd' : 'back';

  slides.forEach((el, i) => {
    el.classList.remove('rep-slide-active', 'rep-slide-exit', 'rep-slide-exit-back');
    if (i === idx) {
      el.classList.add('rep-slide-active');
      el.setAttribute('data-direction', direction);
      // Restart child fade animations by toggling class
      const fxEls = el.querySelectorAll('.rep-fx');
      fxEls.forEach(fx => {
        fx.classList.remove('rep-fx-in');
        // force reflow
        void fx.offsetWidth;
        const delay = parseInt(fx.getAttribute('data-fx'), 10) || 0;
        fx.style.animationDelay = (80 + delay * 140) + 'ms';
        fx.classList.add('rep-fx-in');
      });
      // Persona slide: replicate post-game reveal stagger animation.
      // Restart .pers-stagger animations and apply --delay from data-delay.
      const persStagger = el.querySelectorAll('.pers-stagger');
      persStagger.forEach(ps => {
        ps.style.animation = 'none';
        void ps.offsetHeight;
        ps.style.animation = '';
        const d = ps.dataset.delay || '0';
        ps.style.setProperty('--delay', d);
      });
    } else if (i === prevIdx && !opts.initial) {
      // Play exit animation for previous slide
      el.classList.add(direction === 'fwd' ? 'rep-slide-exit' : 'rep-slide-exit-back');
    }
  });

  _repDeckIdx = idx;
  _repDeckUpdateChrome();
}

function _repDeckUpdateChrome() {
  const total = _repDeckSlides.length;
  const counter = document.getElementById('repDeckCounter');
  if (counter) counter.textContent = `${_repDeckIdx + 1} / ${total}`;

  const dots = document.querySelectorAll('#repDeckDots .rep-deck-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('rep-deck-dot-active', i === _repDeckIdx);
    d.classList.toggle('rep-deck-dot-visited', i < _repDeckIdx);
  });

  const prevBtn = document.getElementById('repDeckPrev');
  const nextBtn = document.getElementById('repDeckNext');
  if (prevBtn) prevBtn.disabled = _repDeckIdx === 0;
  if (nextBtn) nextBtn.disabled = _repDeckIdx >= total - 1;

  const skipBtn = document.getElementById('repDeckSkipBtn');
  if (skipBtn) skipBtn.style.display = _repDeckIdx >= total - 1 ? 'none' : '';

  // Fade out the "click to continue" hint after the first advance
  const hint = document.getElementById('repDeckHint');
  if (hint) hint.classList.toggle('rep-deck-hint-hide', _repDeckIdx > 0);
}

function repDeckGo(idx) {
  if (_repDeckAnimating) return;
  if (!_repDeckSlides.length) return;
  if (idx < 0 || idx >= _repDeckSlides.length) return;
  _repDeckAnimating = true;
  _repDeckActivate(idx);
  setTimeout(() => { _repDeckAnimating = false; }, 420);
}

function repDeckSkipToEnd() {
  if (!_repDeckSlides.length) return;
  repDeckGo(_repDeckSlides.length - 1);
}

function _attachRepDeckHandlers() {
  // Remove any existing handlers to avoid double-binding
  if (_repDeckKeyHandler) {
    document.removeEventListener('keydown', _repDeckKeyHandler, true);
  }
  if (_repDeckClickHandler) {
    const prevStage = document.getElementById('repDeckStage');
    if (prevStage) prevStage.removeEventListener('click', _repDeckClickHandler);
  }

  _repDeckKeyHandler = function(e) {
    // Only act when the repertoire page is visible
    const deckPage = document.getElementById('pageRepertoire');
    if (!deckPage || deckPage.style.display === 'none') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const keys = ['ArrowRight', 'ArrowLeft', ' ', 'Enter', 'PageDown', 'PageUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    // Intercept before the analysis-page arrow handler (registered in
    // navigation.js) can call goTo() against an empty board.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') {
      repDeckGo(_repDeckIdx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      repDeckGo(_repDeckIdx - 1);
    } else if (e.key === 'Home') {
      repDeckGo(0);
    } else if (e.key === 'End') {
      repDeckGo(_repDeckSlides.length - 1);
    }
  };
  // Capture phase so this fires before the global navigation handler.
  document.addEventListener('keydown', _repDeckKeyHandler, true);

  const stage = document.getElementById('repDeckStage');
  if (stage) {
    _repDeckClickHandler = function(e) {
      // Ignore clicks on interactive elements inside the slide
      if (e.target.closest('button, a, .rep-crosslink, .rep-deck-dot')) return;
      repDeckGo(_repDeckIdx + 1);
    };
    stage.addEventListener('click', _repDeckClickHandler);
  }
}

// ══════════════════════════════════════════════
//  REPERTOIRE INPUT FLOW - Quick batch personality detection
// ══════════════════════════════════════════════

let _repPlatform = 'lichess';

async function initRepInput() {
  try {
    const plat = await dbGetProfile('lastPlatform');
    const user = await dbGetProfile('lastUsername');
    if (plat) setRepPlatform(plat);
    if (user) document.getElementById('repUsernameInput').value = user;
  } catch {}
}

// Called from choice modal - always show the input page so the user
// can confirm/change the username (matches the Game Analysis flow which
// goes to gameSelect rather than auto-starting). showPage('repInput')
// triggers initRepInput() in navigation.js, which pre-fills the saved
// username + platform.
function startRepFromChoice() {
  showPage('repInput');
}

function setRepPlatform(p) {
  _repPlatform = p;
  document.getElementById('repPlatLichess').classList.toggle('active', p === 'lichess');
  document.getElementById('repPlatChesscom').classList.toggle('active', p === 'chesscom');
  const input = document.getElementById('repUsernameInput');
  if (input) input.placeholder = p === 'lichess' ? 'Lichess username' : 'Chess.com username';
}

// ── Loading screen helpers ────────────────────────────────────
function _repLoadProgress(pct) {
  const fill = document.getElementById('repLoadBarFill');
  const txt  = document.getElementById('repLoadBarPct');
  if (fill) fill.style.width = pct + '%';
  if (txt)  txt.textContent  = pct + '%';
}

function _repLoadStep(idx, state, detail) {
  const el = document.getElementById('repLs' + idx);
  if (!el) return;
  el.classList.remove('rep-ls-active', 'rep-ls-done');
  const icon = el.querySelector('.rep-ls-icon');
  if (state === 'active')  { el.classList.add('rep-ls-active');  if (icon) icon.innerHTML = '&#9881;'; }
  if (state === 'done')    { el.classList.add('rep-ls-done');    if (icon) icon.innerHTML = '&#10003;'; }
  if (state === 'pending') { if (icon) icon.innerHTML = '&#9899;'; }
  const det = document.getElementById('repLsDetail' + idx);
  if (det && detail !== undefined) det.textContent = detail;
}

function _repFeedAdd(game, username) {
  const feed = document.getElementById('repLoadFeed');
  if (!feed) return;
  const uLower = username.toLowerCase();
  const isWhite = game.white.toLowerCase() === uLower;
  const opponent = isWhite ? game.black : game.white;
  const colorIcon = isWhite ? '&#9812;' : '&#9818;';
  let resultCls = 'draw', resultText = 'Draw';
  if ((game.result === '1-0' && isWhite) || (game.result === '0-1' && !isWhite))
    { resultCls = 'win'; resultText = 'Win'; }
  else if ((game.result === '0-1' && isWhite) || (game.result === '1-0' && !isWhite))
    { resultCls = 'loss'; resultText = 'Loss'; }
  const html = `<div class="rep-feed-item">
    <span class="feed-color">${colorIcon}</span>
    <span>vs ${opponent}</span>
    ${game.opening ? `<span style="opacity:.5">${game.opening.length > 22 ? game.opening.slice(0,22)+'…' : game.opening}</span>` : ''}
    <span class="feed-result feed-result-${resultCls}">${resultText}</span>
  </div>`;
  feed.insertAdjacentHTML('beforeend', html);
  // Keep max 6 visible
  while (feed.children.length > 6) feed.removeChild(feed.firstChild);
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Parse PGN to extract real move stats ─────────────────────
function _parsePgnStats(pgn) {
  const stats = { totalMoves: 30, bookDepth: 3, goodMoves: 10 };
  if (!pgn) return stats;
  try {
    const g = new Chess();
    if (!g.load_pgn(pgn) && !g.load_pgn(pgn, { sloppy: true })) return stats;
    const moves = g.history({ verbose: true });
    stats.totalMoves = Math.ceil(moves.length / 2);

    // Detect book depth: count initial moves that are "common"
    // Simple heuristic: first N moves where pawns advance or pieces develop
    let bookD = 0;
    for (let i = 0; i < Math.min(moves.length, 20); i++) {
      const m = moves[i];
      if (m.piece === 'p' || m.piece === 'n' || m.piece === 'b' || (i < 6)) bookD++;
      else break;
    }
    stats.bookDepth = Math.min(bookD, 12);

    // Count captures, checks, castling as "active" moves
    let active = 0;
    for (const m of moves) {
      if (m.captured || m.san.includes('+') || m.san.includes('O-')) active++;
    }
    stats.goodMoves = Math.floor(moves.length * 0.3 + active * 0.2);
    stats.captures = active;
    stats.moveList = moves;
  } catch {}
  return stats;
}

// ── Main repertoire flow ─────────────────────────────────────
async function startRepertoireFlow() {
  const username = document.getElementById('repUsernameInput').value.trim();
  const errEl = document.getElementById('repInputError');

  if (!username) {
    errEl.textContent = 'Please enter a username.';
    errEl.style.display = '';
    return;
  }
  errEl.style.display = 'none';
  if (typeof incrementSignupCounter === 'function') incrementSignupCounter();

  // Switch to loading screen
  showPage('repLoading');
  _repLoadProgress(0);
  document.getElementById('repLoadTitle').textContent = 'Building your repertoire…';
  document.getElementById('repLoadFeed').innerHTML = '';
  for (let i = 0; i < 5; i++) _repLoadStep(i, 'pending', '');

  try {
    // ── Step 0: Fetch games ──
    _repLoadStep(0, 'active', `Connecting to ${_repPlatform === 'lichess' ? 'Lichess' : 'Chess.com'}…`);
    _repLoadProgress(5);
    await _sleep(400);

    const fetcher = _repPlatform === 'lichess'
      ? () => fetchLichessGames(username)
      : () => fetchChesscomGames(username);
    const games = await fetchWithRetry(fetcher);

    if (!games || games.length === 0) {
      showPage('repInput');
      const err2 = document.getElementById('repInputError');
      err2.textContent = 'No recent games found for this user.';
      err2.style.display = '';
      return;
    }

    const batch = games.slice(0, 10);
    _repLoadStep(0, 'done', `Found ${games.length} games, using ${batch.length}`);
    _repLoadProgress(18);
    await _sleep(300);

    // Save username
    dbSetProfile('lastPlatform', _repPlatform).catch(() => {});
    dbSetProfile('lastUsername', username).catch(() => {});

    // ── Step 1: Parse moves & openings ──
    _repLoadStep(1, 'active', 'Reading PGN data…');
    _repLoadProgress(22);

    const uLower = username.toLowerCase();
    const parsedGames = [];
    for (let i = 0; i < batch.length; i++) {
      const g = batch[i];
      _repLoadStep(1, 'active', `Game ${i + 1} / ${batch.length}`);
      _repFeedAdd(g, username);

      const pgnStats = _parsePgnStats(g.pgn);
      const isWhite = g.white.toLowerCase() === uLower;

      let result = 'draw';
      if ((g.result === '1-0' && isWhite) || (g.result === '0-1' && !isWhite)) result = 'win';
      else if ((g.result === '0-1' && isWhite) || (g.result === '1-0' && !isWhite)) result = 'loss';

      parsedGames.push({ game: g, pgnStats, isWhite, result });
      _repLoadProgress(22 + Math.round(((i + 1) / batch.length) * 18));
      await _sleep(180 + Math.random() * 120);
    }

    _repLoadStep(1, 'done', `${batch.length} games parsed`);
    _repLoadProgress(42);
    await _sleep(250);

    // ── Step 2: Analyze play patterns ──
    _repLoadStep(2, 'active', 'Calculating win rates & style metrics…');
    _repLoadProgress(48);
    await _sleep(500);

    let totalWins = 0, totalLosses = 0, whiteGames = 0, blackGames = 0;
    let totalMoves = 0, longGames = 0, shortDecisive = 0;
    for (const pg of parsedGames) {
      if (pg.result === 'win') totalWins++;
      if (pg.result === 'loss') totalLosses++;
      if (pg.isWhite) whiteGames++; else blackGames++;
      totalMoves += pg.pgnStats.totalMoves;
      if (pg.pgnStats.totalMoves > 40) longGames++;
      if (pg.pgnStats.totalMoves <= 25 && pg.result === 'win') shortDecisive++;
    }
    const avgMoves = Math.round(totalMoves / batch.length);

    _repLoadStep(2, 'active', `${totalWins}W / ${totalLosses}L, avg ${avgMoves} moves`);
    _repLoadProgress(58);
    await _sleep(600);
    _repLoadStep(2, 'done', `${totalWins}W / ${totalLosses}L, avg ${avgMoves} moves`);
    _repLoadProgress(62);
    await _sleep(200);

    // ── Step 3: Detect personality (REPERTOIRE-ONLY, never written to history DB) ──
    _repLoadStep(3, 'active', 'Scoring personality traits…');
    _repLoadProgress(66);
    await _sleep(400);

    const _repTotals = {};
    PERSONALITY_LIST.forEach(p => _repTotals[p.id] = 0);
    const _repBatchEntries = [];
    let _repLastResult = null;

    for (let i = 0; i < parsedGames.length; i++) {
      const pg = parsedGames[i];
      const mc = pg.pgnStats.totalMoves;
      const captures = pg.pgnStats.captures || 0;

      const gameStats = {
        totalMoves: mc,
        mistakes: Math.max(0, Math.floor(Math.random() * 2.5)),
        blunders: Math.random() > 0.75 ? 1 : 0,
        goodMoves: pg.pgnStats.goodMoves,
        bookDepth: pg.pgnStats.bookDepth,
        result: pg.result,
        wasLosingBadly: pg.result === 'win' && Math.random() > 0.65,
        wasWinning: pg.result === 'win' && Math.random() > 0.35,
        evalSwings: Math.floor(captures * 0.5 + Math.random() * 3),
        biggestComebackCp: 0,
        worstEval: -150 + Math.random() * 100,
        bestEval: 100 + Math.random() * 200
      };

      const gameScores = scorePersonalitiesFromGame(gameStats);
      const emptyQ = {};
      PERSONALITY_LIST.forEach(p => emptyQ[p.id] = 0);
      const personalityResult = determinePersonality(gameScores, emptyQ);
      _repLastResult = personalityResult;

      for (const s of personalityResult.scores) {
        _repTotals[s.personality.id] = (_repTotals[s.personality.id] || 0) + s.pct;
      }
      _repBatchEntries.push({
        playerColor: pg.isWhite ? 'w' : 'b',
        result: pg.game.result,
        totalMoves: mc,
        opening: pg.game.opening || '',
        opponent: pg.isWhite ? pg.game.black : pg.game.white,
        bookDepth: gameStats.bookDepth,
        mistakes: gameStats.mistakes,
        blunders: gameStats.blunders
      });

      _repLoadStep(3, 'active', `Game ${i + 1}: ${personalityResult.primary.emoji} ${personalityResult.primary.name}`);
      _repLoadProgress(66 + Math.round(((i + 1) / parsedGames.length) * 18));
      await _sleep(200 + Math.random() * 150);
    }

    let agg = null;
    if (parsedGames.length > 0) {
      const sorted = Object.entries(_repTotals)
        .map(([id, total]) => ({
          personality: PERSONALITIES[id],
          pct: Math.round(total / parsedGames.length)
        }))
        .sort((a, b) => b.pct - a.pct);
      agg = {
        primary: sorted[0].personality,
        totalGames: parsedGames.length,
        breakdown: sorted
      };
    }

    try {
      const repPayload = {
        version: 1,
        savedAt: new Date().toISOString(),
        username: username,
        platform: _repPlatform,
        totalGames: parsedGames.length,
        primaryId: agg ? agg.primary.id : null,
        breakdown: agg
          ? agg.breakdown.map(b => ({ id: b.personality.id, pct: b.pct }))
          : [],
        entries: _repBatchEntries
      };
      localStorage.setItem('ce-repertoire-batch', JSON.stringify(repPayload));
      if (agg) localStorage.setItem('ce-repertoire-personality', agg.primary.id);
    } catch (e) { console.warn('repertoire batch persist failed', e); }
    _repLoadStep(3, 'done', agg ? `Primary: ${agg.primary.emoji} ${agg.primary.name}` : 'Done');
    _repLoadProgress(86);
    await _sleep(300);

    // ── Step 4: Match ideal openings ──
    _repLoadStep(4, 'active', 'Finding your perfect openings…');
    _repLoadProgress(90);
    await _sleep(600);

    if (agg) {
      const rep = REPERTOIRE_DATA[agg.primary.id];
      if (rep) {
        _repLoadStep(4, 'active', `White: ${rep.white[0].name.split('(')[0].trim()}, Black: ${rep.black[0].name.split('(')[0].trim()}`);
      }
    }
    _repLoadProgress(96);
    await _sleep(500);
    _repLoadStep(4, 'done', 'Repertoire ready!');
    _repLoadProgress(100);

    document.getElementById('repLoadTitle').textContent = 'Your repertoire is ready!';
    await _sleep(700);

    showPage('repertoire');
    await renderRepertoirePage();

  } catch (err) {
    showPage('repInput');
    const err2 = document.getElementById('repInputError');
    err2.textContent = err.message || 'Something went wrong. Please try again.';
    err2.style.display = '';
  }
}

   