/* ══════════════════════════════════════════════
   engagement.js - Retention & Engagement Features
   - Personality Collection
   - Streak System (weekly)
   - Sparkline (profile mini chart)
   - Milestone Celebrations
   - AI Coach Preview (free users)
══════════════════════════════════════════════ */
'use strict';

// ── 1. PERSONALITY COLLECTION ─────────────────────────────────

function renderPersonalityCollection(history) {
  const container = document.getElementById('profCollection');
  const grid = document.getElementById('profCollectionGrid');
  const counter = document.getElementById('profCollectionCounter');
  if (!container || !grid) return;

  // Find all unique personalities the user has been assigned
  const discovered = new Set();
  for (const e of history) {
    if (e.personality && PERSONALITIES[e.personality]) {
      discovered.add(e.personality);
    }
  }

  if (history.length === 0) { container.style.display = 'none'; return; }
  container.style.display = '';

  // Count and build cards
  const count = discovered.size;
  if (counter) counter.textContent = `${count}/8 discovered`;

  // Build per-personality best percentage
  const bestPct = {};
  for (const e of history) {
    if (e.personalityScores) {
      for (const s of e.personalityScores) {
        if (s.id === e.personality) {
          bestPct[s.id] = Math.max(bestPct[s.id] || 0, s.pct);
        }
      }
    }
  }

  grid.innerHTML = PERSONALITY_LIST.map(p => {
    const unlocked = discovered.has(p.id);
    const pct = bestPct[p.id];
    return `<div class="prof-collect-card ${unlocked ? 'unlocked' : 'locked'}" style="--pers-card-color:${p.color}">
      <div class="prof-collect-emoji">${p.emoji}</div>
      <div class="prof-collect-name">${p.name.replace('The ', '')}</div>
      ${unlocked && pct ? `<div class="prof-collect-pct">${pct}%</div>` : ''}
      ${!unlocked ? '<div class="prof-collect-lock">🔒</div>' : ''}
    </div>`;
  }).join('');
}


// ── 2. STREAK SYSTEM ──────────────────────────────────────────

function renderStreakSystem(history) {
  const row = document.getElementById('profEngageRow');
  const card = document.getElementById('profStreakCard');
  if (!row || !card) return;

  if (history.length === 0) { row.style.display = 'none'; return; }
  row.style.display = '';

  // Get this week's days (Mon-Sun)
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const weekStart = new Date(now);
  weekStart.setHours(0,0,0,0);
  weekStart.setDate(weekStart.getDate() - dayOfWeek);

  const dayNames = ['M','T','W','T','F','S','S'];
  const daysActive = new Array(7).fill(false);

  let weekCount = 0;
  for (const e of history) {
    const d = new Date(e.date);
    if (d >= weekStart) {
      weekCount++;
      const di = (d.getDay() + 6) % 7;
      daysActive[di] = true;
    }
  }

  const flame = document.getElementById('profStreakFlame');
  const countEl = document.getElementById('profStreakCount');
  const label = document.getElementById('profStreakLabel');
  const dots = document.getElementById('profStreakDots');

  if (countEl) countEl.textContent = weekCount;
  if (label) label.textContent = weekCount === 1 ? 'game this week' : 'games this week';
  if (flame) flame.className = 'prof-streak-flame' + (weekCount === 0 ? ' cold' : '');

  if (dots) {
    dots.innerHTML = dayNames.map((name, i) => {
      const isToday = i === dayOfWeek;
      const isActive = daysActive[i];
      return `<div class="prof-streak-dot ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}">
        <span class="prof-streak-dot-label">${name}</span>
      </div>`;
    }).join('');
  }
}


// ── 3. SPARKLINE ──────────────────────────────────────────────

function renderProfileSparkline(history) {
  const card = document.getElementById('profSparklineCard');
  const canvas = document.getElementById('profSparkline');
  const sub = document.getElementById('profSparklineSub');
  if (!canvas || !card) return;

  const withPers = history.filter(e => e.personality && e.personalityScores);
  if (withPers.length < 2) {
    card.style.display = withPers.length === 0 ? 'none' : 'flex';
    if (sub) sub.textContent = withPers.length === 0 ? '' : 'Analyze more games to see trend';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  card.style.display = 'flex';

  // Extract primary personality score per game (oldest → newest)
  const items = withPers.slice().reverse().slice(-10); // last 10 games
  const scores = items.map(e => {
    const top = e.personalityScores.find(s => s.id === e.personality);
    return top ? top.pct : 0;
  });

  // Draw sparkline
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(rect.width || 160, 100);
  const H = 48;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const pad = 4;
  const plotW = W - pad * 2;
  const plotH = H - pad * 2;
  const minV = Math.max(0, Math.min(...scores) - 5);
  const maxV = Math.min(100, Math.max(...scores) + 5);
  const range = maxV - minV || 10;

  const toX = i => pad + (scores.length > 1 ? i / (scores.length - 1) : 0.5) * plotW;
  const toY = v => pad + plotH - ((v - minV) / range) * plotH;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(233,69,96,0.22)');
  grad.addColorStop(1, 'rgba(233,69,96,0.0)');

  ctx.beginPath();
  ctx.moveTo(toX(0), H);
  scores.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(scores.length - 1), H);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e94560';
  ctx.beginPath();
  scores.forEach((v, i) => i === 0 ? ctx.moveTo(toX(0), toY(v)) : ctx.lineTo(toX(i), toY(v)));
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Last dot
  const last = scores[scores.length - 1];
  ctx.beginPath();
  ctx.arc(toX(scores.length - 1), toY(last), 3, 0, Math.PI * 2);
  ctx.fillStyle = accentColor;
  ctx.fill();

  // Trend text
  if (sub) {
    const first = scores[0];
    const diff = last - first;
    if (diff > 2) sub.textContent = `↗ Trending up (+${diff}%)`;
    else if (diff < -2) sub.textContent = `↘ Trending down (${diff}%)`;
    else sub.textContent = '→ Stable';
  }
}


// ── 4. MILESTONE CELEBRATIONS ─────────────────────────────────

const MILESTONES = [
  { count: 1,  emoji: '\u2658', title: 'First Analysis!', sub: 'You just analyzed your first game. Your chess personality journey begins now!' },
  { count: 3,  emoji: '\u2656', title: 'Getting Warmed Up!', sub: 'Three games analyzed. Your personality profile is taking shape!' },
  { count: 5,  emoji: '\u2655', title: '5 Games Strong!', sub: 'Your chess DNA is becoming clearer with every game you analyze.' },
  { count: 10, emoji: '\u2657', title: 'Double Digits!', sub: '10 games analyzed! Your personality data is now rich enough for deep insights.' },
  { count: 20, emoji: '\u2655', title: 'Dedicated Player!', sub: '20 analyses! You have a comprehensive chess personality profile.' },
  { count: 50, emoji: '\u2654', title: 'Chess Scholar!', sub: '50 games analyzed. You truly understand your chess identity.' },
];

function checkMilestone(gameCount) {
  const milestone = MILESTONES.find(m => m.count === gameCount);
  if (!milestone) return;

  // Check if already shown
  const shown = JSON.parse(localStorage.getItem('ce-milestones-shown') || '[]');
  if (shown.includes(gameCount)) return;

  // Mark as shown
  shown.push(gameCount);
  localStorage.setItem('ce-milestones-shown', JSON.stringify(shown));

  // Show with slight delay so it doesn't conflict with page transitions
  setTimeout(() => showMilestone(milestone), 800);
}

function showMilestone(ms) {
  const overlay = document.getElementById('milestoneOverlay');
  const emoji = document.getElementById('milestoneEmoji');
  const title = document.getElementById('milestoneTitle');
  const sub = document.getElementById('milestoneSub');
  const confetti = document.getElementById('milestoneConfetti');

  if (!overlay) return;

  if (emoji) emoji.textContent = ms.emoji;
  if (title) title.textContent = ms.title;
  if (sub) sub.textContent = ms.sub;

  // Generate confetti pieces
  if (confetti) {
    const colors = ['#e94560','#f59e0b','#22c55e','#3b82f6','#8b5cf6','#06b6d4','#ff6b6b'];
    confetti.innerHTML = Array.from({length: 30}, () => {
      const c = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.8;
      const size = 6 + Math.random() * 6;
      return `<div class="milestone-confetti-piece" style="left:${left}%;top:-10px;background:${c};width:${size}px;height:${size}px;animation-delay:${delay}s"></div>`;
    }).join('');
  }

  overlay.style.display = 'flex';
}

function closeMilestone() {
  const overlay = document.getElementById('milestoneOverlay');
  if (overlay) overlay.style.display = 'none';
}


// ── 5. AI COACH PREVIEW (for free/new users) ─────────────────

function renderCoachPreviewText(history, agg) {
  const el = document.getElementById('profCoachPreview');
  const textEl = document.getElementById('profCoachPreviewText');
  if (!textEl) return;

  // Show the card only if user has personality data
  if (!agg || history.length < 1) {
    if (el) el.style.display = 'none';
    return;
  }
  if (el) el.style.display = '';

  // Generate a quick teaser as subtitle
  const p = agg.primary;
  const teasers = {
    anaconda: "Endgame patterns to make your squeeze deadlier",
    eagle: "Unlock deeper combinations with targeted tactics training",
    fox: "Opening surprises that match your trickster style",
    lion: "Timing patterns to make your attacks even more devastating",
    owl: "Fix the technical weakness costing you half-points",
    shark: "Middlegame techniques to sharpen your conversion edge",
    phoenix: "Defensive resources to turn more losses into saves",
    turtle: "Counterattacking patterns to turn draws into wins"
  };

  textEl.textContent = teasers[p.id] || "Personalized training plan for your style";
}


// ── INTEGRATION: Hook into renderFullProfile ──────────────────

// This function is called by the patched renderFullProfile
function renderEngagementFeatures(history, agg) {
  renderPersonalityCollection(history);
  renderStreakSystem(history);
  renderProfileSparkline(history);
  renderCoachPreviewText(history, agg);
  if (typeof renderProfileFeatureRow === 'function') renderProfileFeatureRow(history, agg);
}
