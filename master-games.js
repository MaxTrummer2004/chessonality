// ==============================================================
//  MASTER GAMES DATABASE
//  Source: "The Most Instructive Games of Chess Ever Played"
//  chessgames.com collection cid=1000119 (compiled by uglybird)
//  Based on Irving Chernev's classic book - 62 annotated games.
//
//  Each entry: white, black, year, eco, result, theme, lesson, cgUrl
//  theme = the instructive chapter heading from Chernev's book
// ==============================================================
'use strict';

const MASTER_GAMES = [
  // 1
  {
    white: 'Capablanca', black: 'Tartakower', year: 1924,
    eco: 'A40', result: '1-0',
    theme: 'Rook on the Seventh Rank',
    lesson: 'A rook on the seventh rank dominates the position, attacking pawns and confining the king.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1102104'
  },
  // 2
  {
    white: 'Tal', black: 'Lisitsin', year: 1956,
    eco: 'B71', result: '1-0',
    theme: 'The King Is a Strong Piece',
    lesson: 'The king marches boldly up the board as an attacking piece in the endgame.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1139306'
  },
  // 3
  {
    white: 'Boleslavsky', black: 'Lisitsin', year: 1956,
    eco: 'B76', result: '1-0',
    theme: 'Knight Outpost at d5',
    lesson: 'A knight planted on d5 becomes the dominant piece, controlling the entire board.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1257953'
  },
  // 4
  {
    white: 'Tarrasch', black: 'Thorold', year: 1890,
    eco: 'C07', result: '1-0',
    theme: 'Aggressive Rook in the Ending',
    lesson: 'An aggressive rook in the endgame cuts off the king and dominates the position.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1257895'
  },
  // 5
  {
    white: 'Rubinstein', black: 'Duras', year: 1908,
    eco: 'D02', result: '1-0',
    theme: 'The Passed Pawn',
    lesson: 'A passed pawn, properly supported, ties down the opponent and decides the game.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1039803'
  },
  // 6
  {
    white: 'Mattison', black: 'Nimzowitsch', year: 1929,
    eco: 'E21', result: '0-1',
    theme: 'Weak Pawns, Weak Squares and Mighty Knights',
    lesson: 'Knights exploit weak squares created by damaged pawn structure to dominate the board.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1066872'
  },
  // 7
  {
    white: 'Domenech', black: 'Flohr', year: 1935,
    eco: 'B40', result: '0-1',
    theme: 'Finesse in the Ending',
    lesson: 'Subtle endgame technique and finesse convert a small advantage into a full point.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1258005'
  },
  // 8
  {
    white: 'Petrosian', black: 'Corral', year: 1954,
    eco: 'D35', result: '1-0',
    theme: 'Phalanx of Pawns',
    lesson: 'A phalanx of connected pawns rolls forward, crushing the opponent\'s position.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1258111'
  },
  // 9
  {
    white: 'Fischer', black: 'Berliner', year: 1960,
    eco: 'B03', result: '1-0',
    theme: 'Passed Pawn\'s Lust to Expand',
    lesson: 'A passed pawn supported by pieces advances relentlessly toward promotion.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1044112'
  },
  // 10
  {
    white: 'Smyslov', black: 'Reshevsky', year: 1948,
    eco: 'C75', result: '1-0',
    theme: 'Rook and Pawn Ending',
    lesson: 'A model rook and pawn endgame demonstrating technique and precision.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1125562'
  },
  // 11
  {
    white: 'Tartakower', black: 'Frentz', year: 1933,
    eco: 'A18', result: '1-0',
    theme: 'King in the Center',
    lesson: 'Punishing the opponent for leaving the king in the center with a swift attack.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1258209'
  },
  // 12
  {
    white: 'Reshevsky', black: 'Najdorf', year: 1957,
    eco: 'E42', result: '1-0',
    theme: 'The Shifting Attack',
    lesson: 'Shifting the attack from one side of the board to the other overwhelms the defense.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1101450'
  },
  // 13
  {
    white: 'Petrosian', black: 'Korchnoi', year: 1946,
    eco: 'A94', result: '1-0',
    theme: 'A Touch of Jujitsu',
    lesson: 'Turning the opponent\'s own aggression against them: defensive play that counterattacks.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1080837'
  },
  // 14
  {
    white: 'Tarrasch', black: 'von Scheve', year: 1894,
    eco: 'D37', result: '1-0',
    theme: 'The King-Side Attack',
    lesson: 'A systematic kingside buildup with pieces and pawns leads to a breakthrough attack.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1258210'
  },
  // 15
  {
    white: 'Smyslov', black: 'Rudakovsky', year: 1945,
    eco: 'B83', result: '1-0',
    theme: 'Magnificent Outpost',
    lesson: 'A piece on a magnificent outpost radiates power and dominates the game.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1125461'
  },
  // 16
  {
    white: 'Kupferstich', black: 'Andreasen', year: 1953,
    eco: 'C27', result: '1-0',
    theme: 'The See-Saw Check, Zugzwang, and Other Tactical Tricks',
    lesson: 'A dazzling array of tactical tricks: see-saw checks, zugzwang, and more.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1228798'
  },
  // 17
  {
    white: 'Rosenthal', black: 'Steinitz', year: 1873,
    eco: 'C46', result: '0-1',
    theme: 'The Two Bishops',
    lesson: 'The two bishops rake across open diagonals, dominating knights in an open position.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1132616'
  },
  // 18
  {
    white: 'Tartakower', black: 'Domenech', year: 1934,
    eco: 'D05', result: '1-0',
    theme: 'Variety of Themes',
    lesson: 'A rich game demonstrating multiple strategic and tactical themes in one contest.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1258212'
  },
  // 19
  {
    white: 'Alekhine', black: 'Yates', year: 1922,
    eco: 'D63', result: '1-0',
    theme: 'Coup de Grace',
    lesson: 'A beautifully executed finishing blow caps off a model positional buildup.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1012123'
  },
  // 20
  {
    white: 'Aganalian', black: 'Petrosian', year: 1945,
    eco: 'A54', result: '0-1',
    theme: 'The Powerful Passed Pawns',
    lesson: 'Connected passed pawns supported by pieces become an unstoppable force.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1106120'
  },
  // 21
  {
    white: 'Bondarevsky', black: 'Smyslov', year: 1946,
    eco: 'C85', result: '0-1',
    theme: 'Bishop and a Half',
    lesson: 'The bishop pair\'s power in open positions is worth more than a knight and bishop.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1125498'
  },
  // 22
  {
    white: 'Foltys', black: 'Golombek', year: 1947,
    eco: 'B73', result: '1-0',
    theme: 'Problem-like Finale',
    lesson: 'A composed-problem-like finish emerges from practical play: beauty on the board.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1259463'
  },
  // 23
  {
    white: 'Keres', black: 'Tarnowski', year: 1952,
    eco: 'C86', result: '1-0',
    theme: 'Board with Excitement',
    lesson: 'An exciting game full of dynamic play and sharp tactical ideas on every move.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1072396'
  },
  // 24
  {
    white: 'Botvinnik', black: 'Boleslavsky', year: 1941,
    eco: 'C07', result: '1-0',
    theme: 'Elegant Simplification',
    lesson: 'Elegant exchanges and simplification lead to a technically won endgame.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1032034'
  },
  // 25
  {
    white: 'Blackburne', black: 'Weiss', year: 1889,
    eco: 'C65', result: '0-1',
    theme: 'Four Endings in One',
    lesson: 'A marathon game transitioning through four distinct endgame types: a complete education.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1002110'
  },
  // 26
  {
    white: 'Weiss', black: 'Blackburne', year: 1889,
    eco: 'B01', result: '0-1',
    theme: 'Bishop and Pawn Ending Deluxe',
    lesson: 'A masterclass in bishop and pawn endgame technique: subtle and instructive.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1002276'
  },
  // 27
  {
    white: 'Petrosian', black: 'Smyslov', year: 1961,
    eco: 'E12', result: '1-0',
    theme: 'Dispatching the King\'s Musketeers',
    lesson: 'Eliminating the king\'s defenders one by one exposes the monarch to a decisive attack.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1106540'
  },
  // 28
  {
    white: 'Burn', black: 'Znosko-Borovsky', year: 1906,
    eco: 'D32', result: '0-1',
    theme: 'Odyssey of an Isolated Pawn',
    lesson: 'The journey of an isolated pawn: from weakness to unlikely hero of the game.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1151910'
  },
  // 29
  {
    white: 'Marshall', black: 'Lasker', year: 1907,
    eco: 'C65', result: '0-1',
    theme: 'Zugzwang, the Invincible Weapon',
    lesson: 'Lasker weaves a web of zugzwang: every move the opponent makes worsens their position.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1094674'
  },
  // 30
  {
    white: 'Eliskases', black: 'Gruenfeld', year: 1933,
    eco: 'C53', result: '1-0',
    theme: 'Symphony of Combinations',
    lesson: 'A symphony of tactical combinations builds from quiet play to a stunning crescendo.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1040766'
  },
  // 31
  {
    white: 'Schlechter', black: 'Mason', year: 1903,
    eco: 'C41', result: '1-0',
    theme: 'Escorting the Potential Queen',
    lesson: 'A pawn escorted to promotion by its pieces: the art of queening a pawn.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1121049'
  },
  // 32
  {
    white: 'Schlechter', black: 'John', year: 1905,
    eco: 'D31', result: '1-0',
    theme: 'Web of Black Squares',
    lesson: 'A dark-square strategy weaves a web that traps the opponent\'s pieces and king.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1003034'
  },
  // 33
  {
    white: 'Mieses', black: 'Reshevsky', year: 1935,
    eco: 'B15', result: '0-1',
    theme: 'Endgame Arithmetic',
    lesson: 'Precise calculation and endgame arithmetic convert a difficult position into a win.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1224094'
  },
  // 34
  {
    white: 'Janowski', black: 'Capablanca', year: 1916,
    eco: 'D15', result: '0-1',
    theme: 'In the Grand Manner',
    lesson: 'Capablanca plays in the grand manner: elegant positional play that looks effortless.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1064780'
  },
  // 35
  {
    white: 'Pillsbury', black: 'Gunsberg', year: 1895,
    eco: 'D10', result: '1-0',
    theme: 'March of the Little Pawns',
    lesson: 'A pawn mass marches forward in formation, sweeping everything in its path.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1054736'
  },
  // 36
  {
    white: 'Marshall', black: 'Capablanca', year: 1909,
    eco: 'D33', result: '0-1',
    theme: 'Irresistible Pawn-Roller',
    lesson: 'An irresistible pawn roller on the queenside crushes the opposition methodically.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1094832'
  },
  // 37
  {
    white: 'Botvinnik', black: 'Kan', year: 1931,
    eco: 'A96', result: '1-0',
    theme: 'Quiet, Like a Tiger',
    lesson: 'Quiet moves build up pressure like a tiger stalking its prey, then the strike comes.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1031746'
  },
  // 38
  {
    white: 'Botvinnik', black: 'Vidmar', year: 1946,
    eco: 'D02', result: '1-0',
    theme: 'Endgame Duel: Knight against Rook',
    lesson: 'A fascinating endgame duel between a knight and a rook: material isn\'t everything.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1032126'
  },
  // 39
  {
    white: 'Bogoljubov', black: 'Reti', year: 1923,
    eco: 'C11', result: '0-1',
    theme: 'Perennial Favorite',
    lesson: 'A perennial favorite: a beautifully played game that has delighted generations of chess lovers.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1030733'
  },
  // 40
  {
    white: 'Rubinstein', black: 'Schlechter', year: 1912,
    eco: 'D41', result: '1-0',
    theme: 'Command of the Board',
    lesson: 'Complete command of the board: every piece placed perfectly, every move purposeful.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1119757'
  },
  // 41
  {
    white: 'Petrosian', black: 'Pachman', year: 1961,
    eco: 'A07', result: '1-0',
    theme: 'Surprise! Surprise!',
    lesson: 'A quiet positional game erupts with a shocking queen sacrifice that wins instantly.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1104948'
  },
  // 42
  {
    white: 'Marshall', black: 'Capablanca', year: 1918,
    eco: 'D63', result: '0-1',
    theme: 'Lured into Zugzwang',
    lesson: 'Capablanca lures his opponent into zugzwang: every move makes the position worse.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1095027'
  },
  // 43
  {
    white: 'Olafsson', black: 'Fischer', year: 1958,
    eco: 'D38', result: '1-0',
    theme: 'The Flash of a Mighty Surprise',
    lesson: 'A sudden tactical surprise electrifies the game and turns the tables dramatically.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1044472'
  },
  // 44
  {
    white: 'Evans', black: 'Opsahl', year: 1950,
    eco: 'D51', result: '1-0',
    theme: 'Symphony of Heavenly Length',
    lesson: 'An 81-move epic: a symphony of chess ideas spanning the full length of a game.',
    cgUrl: 'https://www.chessgames.com/perl/chessgame?gid=1152575'
  },
];

// Theme → keyword mapping for matching coach recommendations to games
const GAME_THEME_KEYWORDS = {
  // Piece placement & activity
  'seventh rank':    ['seventh rank', 'rook', '7th rank', 'pig', 'invasion', 'penetrate'],
  'king activity':   ['king', 'active king', 'endgame king', 'king walk', 'king march', 'strong piece'],
  'outpost':         ['outpost', 'knight outpost', 'strong square', 'anchor', 'd5', 'e5'],
  'centralization':  ['central', 'center', 'centralize', 'dominate'],
  'piece activity':  ['active', 'piece activity', 'coordination', 'mobilize', 'develop', 'command'],
  'restriction':     ['restrict', 'cramp', 'squeeze', 'suffocate', 'bind', 'web'],

  // Rook play
  'rook endgame':    ['rook ending', 'rook endgame', 'rook and pawn', 'aggressive rook'],
  'open file':       ['open file', 'file control', 'rook lift', 'doubled rooks'],

  // Pawn play
  'passed pawn':     ['passed pawn', 'outside passer', 'protected passed', 'promote', 'pawn roller',
                       'lust to expand', 'potential queen', 'escorting'],
  'pawn structure':  ['pawn structure', 'pawn weakness', 'isolated', 'doubled', 'backward',
                       'weak pawns', 'weak squares'],
  'pawn mass':       ['pawn mass', 'pawn storm', 'advance', 'rolling pawns', 'phalanx', 'march'],
  'isolated pawn':   ['isolated pawn', 'isolani', 'IQP', 'odyssey'],

  // Minor pieces
  'knight':          ['knight', 'outpost', 'mighty knight', 'strong knight'],
  'bishop pair':     ['two bishops', 'bishop pair', 'bishop and a half', 'bishops'],
  'bishop endgame':  ['bishop ending', 'bishop endgame', 'bishop and pawn'],

  // Tactics & combinations
  'combination':     ['combination', 'tactic', 'tactics', 'combo', 'calculate', 'symphony'],
  'sacrifice':       ['sacrifice', 'sac', 'gambit', 'brilliant', 'surprise'],
  'pin':             ['pin', 'pinned', 'pinning'],
  'zugzwang':        ['zugzwang', 'no good move', 'lured', 'invincible weapon'],
  'check':           ['see-saw check', 'check', 'discovered', 'double check'],

  // Strategy
  'attack':          ['attack', 'aggressive', 'offensive', 'initiative', 'kingside', 'shifting attack',
                       'king-side attack', 'coup de grace'],
  'defense':         ['defense', 'defend', 'counter', 'resilience', 'jujitsu', 'survive'],
  'planning':        ['plan', 'long-range', 'strategic', 'maneuver', 'quiet', 'tiger'],
  'simplification':  ['simplify', 'simplification', 'exchange', 'liquidate', 'elegant'],
  'king safety':     ['king safety', 'castling', 'exposed king', 'king in center', 'unsafe king',
                       'musketeers'],

  // Endgames
  'endgame':         ['endgame', 'ending', 'technique', 'convert', 'grind', 'finesse', 'arithmetic',
                       'four endings'],
  'positional':      ['positional', 'strategic', 'quiet', 'prophylaxis', 'pressure', 'grand manner'],

  // Square control
  'weak squares':    ['weak square', 'hole', 'dark squares', 'light squares', 'black squares'],
};

/**
 * Find the best matching games for a given coach task context.
 * @param {string} taskText - The task description from the coach
 * @param {number} count - Number of games to return (default 2)
 * @returns {Array<{name, theme, lesson, link}>}
 */
function findMasterGames(taskText, count = 2) {
  const text = taskText.toLowerCase();

  // Score each game by theme match
  const scored = MASTER_GAMES.map(g => {
    let score = 0;
    const gameThemeLower = g.theme.toLowerCase();

    // Direct theme match (strongest signal)
    for (const [themeKey, keywords] of Object.entries(GAME_THEME_KEYWORDS)) {
      for (const kw of keywords) {
        if (text.includes(kw)) {
          // Check if the game's theme or lesson relates
          if (gameThemeLower.includes(kw) || gameThemeLower.includes(themeKey)) {
            score += 3;
          }
          if (g.lesson.toLowerCase().includes(kw)) {
            score += 2;
          }
        }
      }
    }

    // Direct word overlap between task and game theme
    const themeWords = gameThemeLower.split(/\W+/).filter(w => w.length > 3);
    for (const w of themeWords) {
      if (text.includes(w)) score += 2;
    }

    // Lesson keyword overlap
    const lessonWords = g.lesson.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    for (const w of lessonWords) {
      if (text.includes(w)) score += 1;
    }

    // Player name mentions
    if (text.includes(g.white.toLowerCase())) score += 1;
    if (text.includes(g.black.toLowerCase())) score += 1;

    return { ...g, score };
  });

  // Sort by score descending, shuffle equal scores for variety
  scored.sort((a, b) => b.score - a.score || Math.random() - 0.5);

  // Return top N unique matchups
  const result = [];
  const seen = new Set();
  for (const g of scored) {
    const key = `${g.white} vs ${g.black} ${g.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      name: `${g.white} vs ${g.black}, ${g.year}`,
      theme: g.theme,
      lesson: g.lesson,
      link: g.cgUrl
    });
    if (result.length >= count) break;
  }

  return result;
}
