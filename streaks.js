
// ══════════════════════════════════════════════
//  SHOOTING STAR / LASER STREAK DECORATION
//  Disabled on: landing page, analysis page (board visible)
// ══════════════════════════════════════════════
(function initStreaks() {
  function streaksAllowed() {
    // Hide streaks on landing page and analysis page (board is visible there)
    const noStreak = ['pageLanding', 'pageAnalysis'];
    return !noStreak.some(id => {
      const el = document.getElementById(id);
      return el && el.style.display !== 'none';
    });
  }
  function getPersColor() {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--pers-color').trim();
    return v || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d4a24c';
  }

  // How many px away from any UI element the streak must stay
  const MARGIN = 22;

  // Tags that are always UI content
  const SKIP_TAGS = new Set([
    'button','input','textarea','a','select','canvas','img','svg','path','g','rect',
    'circle','line','use','video','label','span','p','li','ul','ol','nav','aside',
    'h1','h2','h3','h4','h5','h6','strong','em','code','pre','table','td','th','tr'
  ]);

  // Class/id fragments that mark UI widgets (not bare background wrappers)
  const SKIP_FRAGS = [
    'btn','card','panel','move','piece','bar','pill','badge','icon','header','modal',
    'carousel','quiz','coach','analysis','breakdown','highlight','reveal',
    'prof-hub','prof-identity','prof-primary','prof-section','prof-bar','prof-name',
    'gs-game','gs-left','gs-right','gs-tab','gs-platform','gs-username','gs-input',
    'gs-fetch','gs-error','gs-loading','gs-back','gs-title','gs-sub',
    'hero-input','hero-plat','hero-textarea','hero-color','hero-pgn','hero-game',
    'choice-modal','choice-card',
    'landing-card','landing-feature','landing-badge','landing-title','landing-sub',
    'landing-footer','lf-item','lf-copy','lf-link',
    'consent','onboarding','ob-','overlay','footer','settings','skel',
    'toggle','engine','back-btn','profile-btn','apc-','trend','filter','search',
    'pers-actions','pers-share','pers-content','pers-trait','pers-famous',
    'pers-emoji','pers-name','pers-tag','pers-description',
    'hl-','loading','spinner','quiz-box','retry',
    'milestone','streak','sparkline','collection','engage','coach-preview',
    'repertoire','rep-card','rep-header','rep-insight','rep-load','rep-feed',
    'dna-card','dna-side'
  ];

  // Returns true only if the element at (x,y) is a large background wrapper
  function isBackgroundEl(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;

    const tag = el.tagName.toLowerCase();
    // Must be a plain wrapper tag
    if (!['div','section','main','article','body'].includes(tag)) return false;
    if (SKIP_TAGS.has(tag)) return false;

    // Check class + id string
    const cls = (typeof el.className === 'string' ? el.className : '') + ' ' + (el.id || '');
    if (SKIP_FRAGS.some(f => cls.toLowerCase().includes(f))) return false;

    // Must be large - background wrappers cover big areas
    const r = el.getBoundingClientRect();
    if (r.width < 300 || r.height < 150) return false;

    // Must not have a border-radius smaller than the page (cards have border-radius)
    const style = getComputedStyle(el);
    const br = parseFloat(style.borderRadius) || 0;
    if (br > 4) return false;

    return true;
  }

  // Check a point AND a margin box around it - all must be background
  function isPointSafe(x, y) {
    const vw = window.innerWidth, vh = window.innerHeight;
    // Sample the center + 8 surrounding points at MARGIN distance
    const probes = [
      [0, 0],
      [MARGIN, 0], [-MARGIN, 0], [0, MARGIN], [0, -MARGIN],
      [MARGIN, MARGIN], [-MARGIN, MARGIN], [MARGIN, -MARGIN], [-MARGIN, -MARGIN]
    ];
    return probes.every(([dx, dy]) => {
      const px = x + dx, py = y + dy;
      if (px < 0 || px > vw || py < 0 || py > vh) return true; // off-screen: fine
      return isBackgroundEl(px, py);
    });
  }

  // Walk every ~14px along the full travel path - all points must be safe
  function isPathSafe(sx, sy, angleDeg, totalDist) {
    const rad = angleDeg * Math.PI / 180;
    const steps = Math.max(4, Math.ceil(totalDist / 14));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = sx + Math.cos(rad) * totalDist * t;
      const y = sy + Math.sin(rad) * totalDist * t;
      if (!isPointSafe(x, y)) return false;
    }
    return true;
  }

  // Find a safe spawn point (up to 14 tries)
  function findSafeOrigin() {
    const vw = window.innerWidth, vh = window.innerHeight;
    for (let i = 0; i < 14; i++) {
      const x = MARGIN + Math.random() * (vw - MARGIN * 2);
      const y = MARGIN + Math.random() * (vh - MARGIN * 2);
      if (isPointSafe(x, y)) return { x, y };
    }
    return null;
  }

  function spawnStreak() {
    if (!streaksAllowed()) return;
    const pt = findSafeOrigin();
    if (!pt) return;

    const angle  = (Math.random() > 0.5 ? 1 : -1) * (12 + Math.random() * 44);
    const length = 50 + Math.random() * 110;
    const travel = length * 0.65;

    // Reject if the full travel path crosses any UI element
    if (!isPathSafe(pt.x, pt.y, angle, travel)) return;

    const color = getPersColor();
    const dur   = 900 + Math.random() * 700;
    const thick = 1.2 + Math.random() * 1.4;

    const tail = document.createElement('div');
    tail.className = 'deco-streak';
    tail.style.cssText = `
      left: ${pt.x}px; top: ${pt.y}px;
      width: ${length}px; height: ${thick}px;
      background: linear-gradient(90deg,
        transparent 0%, ${color}88 25%, ${color}ff 55%, ${color}cc 75%, transparent 100%);
      transform: rotate(${angle}deg);
      transform-origin: left center;
      opacity: 0;
    `;

    const canvas = document.getElementById('streak-canvas') || document.body;
    canvas.appendChild(tail);

    tail.animate([
      { opacity: 0,    transform: `rotate(${angle}deg) translateX(-${length * 0.2}px)` },
      { opacity: 0.85, transform: `rotate(${angle}deg) translateX(${travel * 0.1}px)`,  offset: 0.15 },
      { opacity: 0.8,  transform: `rotate(${angle}deg) translateX(${travel * 0.45}px)`, offset: 0.55 },
      { opacity: 0.4,  transform: `rotate(${angle}deg) translateX(${travel * 0.75}px)`, offset: 0.82 },
      { opacity: 0,    transform: `rotate(${angle}deg) translateX(${travel}px)` }
    ], { duration: dur, easing: 'cubic-bezier(0.25, 0.1, 0.4, 1)', fill: 'both' })
      .onfinish = () => tail.remove();
  }

  function scheduleNext() {
    const gap = 450 + Math.random() * 850;
    setTimeout(() => {
      spawnStreak();
      if (Math.random() < 0.40) setTimeout(spawnStreak, 60 + Math.random() * 140);
      scheduleNext();
    }, gap);
  }

  setTimeout(scheduleNext, 1200);
})();

// ==============================================================
//  INIT - Start engine + IndexedDB (must be LAST loaded script)
// ==============================================================

// Start engine in background
initEngine();

// Initialize IndexedDB, migrate localStorage, route to correct start page
(async function initDB() {
  try {
    await openDB();
    await migrateFromLocalStorage();
    const name = await dbGetProfile('username');
    if (name) window._profileName = name;
    updateProfileAvatar();

    // Restore last page if available, otherwise route based on history
    const history = await dbGetHistory();
    const savedPage = localStorage.getItem('ce-current-page');
    // Pages that need a loaded game to make sense - fall back to profile
    const needsGame = ['main', 'breakdown', 'highlights', 'personality'];

    if (savedPage && savedPage !== 'landing') {
      if (needsGame.includes(savedPage) && history.length > 0) {
        // Restore game + page
        await loadFromHistory(history[0].id);
        // loadFromHistory calls showPage('main'), override if different
        if (savedPage !== 'main') showPage(savedPage);
      } else if (savedPage === 'profile' && history.length > 0) {
        showPage('profile');
        renderFullProfile();
      } else if (savedPage === 'gameSelect') {
        showPage('gameSelect');
      } else if (savedPage === 'repInput') {
        showPage('repInput');
      } else if (savedPage === 'insights' && history.length > 0) {
        showPage('profile');
        renderFullProfile();
      } else if (savedPage === 'repertoire' && history.length > 0) {
        showPage('repertoire');
        if (typeof renderRepertoirePage === 'function') renderRepertoirePage();
      } else if (history.length > 0) {
        showPage('profile');
        renderFullProfile();
      } else {
        showPage('landing');
        checkOnboarding();
      }
    } else if (history.length > 0) {
      showPage('profile');
      renderFullProfile();
    } else {
      // New user: show landing + onboarding walkthrough
      showPage('landing');
      checkOnboarding();
    }
  } catch (err) { console.warn('[DB] Init error:', err); }
})();
