// ==============================================================
//  GAME SELECT - Platform import (Lichess / Chess.com)
// ==============================================================
let gsPlatform = 'lichess'; // 'lichess' | 'chesscom'
let gsFetchedGames = [];    // [{pgn, white, black, result, date, opening, timeControl, moves}]
const GS_PAGE_SIZE = 4;
let gsCurrentPage  = 0;     // 0-based page index

function setGsPlatform(p) {
  gsPlatform = p;
  document.getElementById('gsPlatLichess').classList.toggle('active', p === 'lichess');
  document.getElementById('gsPlatChesscom').classList.toggle('active', p === 'chesscom');
  document.getElementById('gsUsername').placeholder =
    p === 'lichess' ? 'Lichess username' : 'Chess.com username';
}

function switchGsTab(tab) {
  document.getElementById('gsTabPlatform').style.display = tab === 'platform' ? '' : 'none';
  document.getElementById('gsTabPgn').style.display      = tab === 'pgn'      ? '' : 'none';
  document.getElementById('gsTabBtnPlatform').classList.toggle('active', tab === 'platform');
  document.getElementById('gsTabBtnPgn').classList.toggle('active', tab === 'pgn');
}

// Restore last-used username/platform when showing game select
async function initGameSelect() {
  // Reset to input view on each visit
  const wrapEl      = document.getElementById('gsWrap');
  const zoneEl      = document.getElementById('gsListZone');
  const listEl      = document.getElementById('gsGameList');
  const inputZoneEl = document.getElementById('gsInputZone');
  if (wrapEl)      wrapEl.classList.remove('has-games');
  if (zoneEl)      { zoneEl.classList.remove('gs-list-visible'); zoneEl.style.display = 'none'; }
  if (listEl)      listEl.innerHTML = '';
  if (inputZoneEl) inputZoneEl.style.display = '';
  gsFetchedGames = [];

  try {
    const plat = await dbGetProfile('lastPlatform');
    const user = await dbGetProfile('lastUsername');
    if (plat) setGsPlatform(plat);
    if (user) document.getElementById('gsUsername').value = user;
  } catch {}
}

async function fetchRecentGames() {
  const username = document.getElementById('gsUsername').value.trim();
  const errEl    = document.getElementById('gsError');
  const loadEl   = document.getElementById('gsLoading');
  const listEl   = document.getElementById('gsGameList');

  if (!username) { gsShowError('Please enter a username.'); return; }
  errEl.style.display = 'none';
  loadEl.style.display = '';
  // Show skeleton loading cards
  listEl.innerHTML = Array(5).fill(`<div class="gs-game-card gs-skeleton">
    <div class="skel-line skel-w60"></div>
    <div class="skel-line skel-w40"></div>
    <div class="skel-line skel-w80"></div>
  </div>`).join('');
  gsFetchedGames = [];

  try {
    const fetcher = gsPlatform === 'lichess'
      ? () => fetchLichessGames(username)
      : () => fetchChesscomGames(username);
    gsFetchedGames = await fetchWithRetry(fetcher);
    if (gsFetchedGames.length === 0) {
      gsShowError('No recent games found for this user.');
      listEl.innerHTML = '';
    } else {
      renderGameList(username);
      // Save username for future visits
      dbSetProfile('lastPlatform', gsPlatform).catch(()=>{});
      dbSetProfile('lastUsername', username).catch(()=>{});
    }
  } catch (err) {
    listEl.innerHTML = `<div class="retry-toast">
      <span class="retry-toast-msg">${_escHtml(err.message || 'Failed to fetch games.')}</span>
      <button class="retry-toast-btn" onclick="fetchRecentGames()">Retry</button>
    </div>`;
  } finally {
    loadEl.style.display = 'none';
  }
}

function gsShowError(msg) {
  const el = document.getElementById('gsError');
  el.textContent = msg; el.style.display = '';
}

// ---- Lichess API ----
async function fetchLichessGames(username) {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=15&opening=true`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/x-ndjson' }
  });
  if (res.status === 404) throw new Error('User not found on Lichess.');
  if (!res.ok) throw new Error('Lichess returned status ' + res.status);

  const text = await res.text();
  const lines = text.trim().split('\n').filter(l => l.trim());
  return lines.map(line => {
    const g = JSON.parse(line);
    const w = g.players?.white?.user?.name || g.players?.white?.user?.id || '?';
    const b = g.players?.black?.user?.name || g.players?.black?.user?.id || '?';
    let result = '*';
    if (g.winner === 'white') result = '1-0';
    else if (g.winner === 'black') result = '0-1';
    else if (g.status === 'draw' || g.status === 'stalemate') result = '1/2-1/2';

    const tc = g.clock ? `${Math.floor(g.clock.initial/60)}+${g.clock.increment}` :
               g.speed || '';
    const opening = g.opening?.name || '';
    const dateObj = g.createdAt ? new Date(g.createdAt) : null;
    const dateDisp = dateObj ? dateObj.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';
    const dateTag  = dateObj ? dateObj.toISOString().slice(0,10).replace(/-/g,'.') : '????.??.??';
    const movesStr = g.moves || '';
    const moveCount = movesStr ? movesStr.split(' ').length : 0;

    // Build PGN from NDJSON data (Lichess NDJSON has no pgn field)
    const pgn = [
      `[White "${w}"]`,
      `[Black "${b}"]`,
      `[Result "${result}"]`,
      `[Date "${dateTag}"]`,
      opening ? `[Opening "${opening}"]` : '',
      tc ? `[TimeControl "${tc}"]` : ''
    ].filter(Boolean).join('\n')
      + '\n\n'
      + _buildPgnMovetext(movesStr, result);

    return {
      pgn,
      white: w, black: b,
      result, date: dateDisp, opening,
      timeControl: tc,
      moves: Math.ceil(moveCount / 2),
      speed: g.speed || ''
    };
  }).filter(g => g.moves && g.pgn);
}

// Convert a flat SAN move string ("e4 e5 Nf3 Nc6 ...") into numbered PGN movetext
function _buildPgnMovetext(movesStr, result) {
  if (!movesStr) return result || '*';
  const sans = movesStr.trim().split(/\s+/);
  let out = '';
  for (let i = 0; i < sans.length; i++) {
    if (i % 2 === 0) out += `${Math.floor(i / 2) + 1}. `;
    out += sans[i] + ' ';
  }
  return out.trim() + ' ' + (result || '*');
}

// ---- Chess.com API ----
async function fetchChesscomGames(username) {
  // Get latest archive URL
  const archRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  if (archRes.status === 404) throw new Error('User not found on Chess.com.');
  if (!archRes.ok) throw new Error('Chess.com returned status ' + archRes.status);
  const archData = await archRes.json();
  const archives = archData.archives || [];
  if (archives.length === 0) throw new Error('No game archives found.');

  // Fetch the most recent archive
  const latestUrl = archives[archives.length - 1];
  const gamesRes = await fetch(latestUrl);
  if (!gamesRes.ok) throw new Error('Failed to load games from Chess.com.');
  const gamesData = await gamesRes.json();
  const games = (gamesData.games || []).reverse().slice(0, 15);

  return games.map(g => {
    const w = g.white?.username || '?';
    const b = g.black?.username || '?';
    let result = '*';
    if (g.white?.result === 'win') result = '1-0';
    else if (g.black?.result === 'win') result = '0-1';
    else result = '1/2-1/2';

    const tc = g.time_class || '';
    const date = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '';

    // Extract opening from PGN headers
    let opening = '';
    const ecoMatch = (g.pgn || '').match(/\[ECOUrl "[^"]*\/([^"]+)"\]/);
    if (ecoMatch) opening = ecoMatch[1].replace(/-/g, ' ');

    const moveCount = (g.pgn || '').split(/\d+\./).length - 1;

    return {
      pgn: g.pgn || '',
      white: w, black: b,
      result, date, opening,
      timeControl: tc,
      moves: moveCount,
      speed: tc
    };
  }).filter(g => g.pgn);
}

// ---- Render game list (paginated) ----
let _gsUsername = ''; // cached for re-renders

function renderGameList(username) {
  if (username) _gsUsername = username;
  gsCurrentPage = 0;
  _gsRenderPage();

  // Hide input, show only the game list
  const inputZone = document.getElementById('gsInputZone');
  if (inputZone) inputZone.style.display = 'none';

  const wrapEl = document.getElementById('gsWrap');
  const zoneEl = document.getElementById('gsListZone');
  if (wrapEl) wrapEl.classList.add('has-games');
  if (zoneEl) {
    zoneEl.style.display = '';
    requestAnimationFrame(() => zoneEl.classList.add('gs-list-visible'));
  }
}

function _gsRenderPage() {
  const listEl   = document.getElementById('gsGameList');
  const paginEl  = document.getElementById('gsPagination');
  const prevBtn  = document.getElementById('gsPrevBtn');
  const nextBtn  = document.getElementById('gsNextBtn');
  const pageInfo = document.getElementById('gsPageInfo');
  const titleEl  = document.getElementById('gsListTitle');
  const uLower   = _gsUsername.toLowerCase();

  const total     = gsFetchedGames.length;
  const totalPages = Math.ceil(total / GS_PAGE_SIZE);
  const start     = gsCurrentPage * GS_PAGE_SIZE;
  const pageGames = gsFetchedGames.slice(start, start + GS_PAGE_SIZE);

  listEl.innerHTML = pageGames.map((g, pi) => {
    const i        = start + pi; // real index in gsFetchedGames
    const isWhite  = g.white.toLowerCase() === uLower;
    const color    = isWhite ? 'w' : 'b';
    const opponent = isWhite ? g.black : g.white;
    const colorIcon = isWhite ? '&#9812;' : '&#9818;';

    let resultCls = 'draw', resultText = 'Draw';
    if ((g.result === '1-0' && isWhite) || (g.result === '0-1' && !isWhite))
      { resultCls = 'win';  resultText = 'Win'; }
    else if ((g.result === '1-0' && !isWhite) || (g.result === '0-1' && isWhite))
      { resultCls = 'loss'; resultText = 'Loss'; }

    const openingShort = g.opening
      ? (g.opening.length > 32 ? g.opening.slice(0, 32) + '\u2026' : g.opening)
      : '';

    return `<div class="gs-game-card" onclick="selectPlatformGame(${i}, '${color}')">
      <div class="gs-game-top">
        <span class="gs-game-color">${colorIcon}</span>
        <span class="gs-game-opp">vs ${_escHtml(opponent)}</span>
        <span class="gs-game-result gs-result-${resultCls}">${resultText}</span>
      </div>
      <div class="gs-game-meta">
        ${g.date        ? `<span>${g.date}</span>` : ''}
        ${g.timeControl ? `<span>${g.timeControl}</span>` : ''}
        ${g.moves       ? `<span>${g.moves} moves</span>` : ''}
      </div>
      ${openingShort ? `<div class="gs-game-opening">${_escHtml(openingShort)}</div>` : ''}
    </div>`;
  }).join('');

  if (titleEl) titleEl.textContent = `${total} games. Pick one to analyze`;

  // Pagination controls
  if (totalPages > 1) {
    if (paginEl)  paginEl.style.display = '';
    if (pageInfo) pageInfo.textContent = `${gsCurrentPage + 1} / ${totalPages}`;
    if (prevBtn)  prevBtn.disabled = gsCurrentPage === 0;
    if (nextBtn)  nextBtn.disabled = gsCurrentPage >= totalPages - 1;
  } else {
    if (paginEl) paginEl.style.display = 'none';
  }
}

function gsChangePage(dir) {
  const totalPages = Math.ceil(gsFetchedGames.length / GS_PAGE_SIZE);
  gsCurrentPage = Math.max(0, Math.min(totalPages - 1, gsCurrentPage + dir));
  _gsRenderPage();
}

function gsShowInput() {
  const inputZone = document.getElementById('gsInputZone');
  const zoneEl    = document.getElementById('gsListZone');
  const wrapEl    = document.getElementById('gsWrap');
  if (inputZone) inputZone.style.display = '';
  if (zoneEl)    { zoneEl.classList.remove('gs-list-visible'); zoneEl.style.display = 'none'; }
  if (wrapEl)    wrapEl.classList.remove('has-games');
  document.getElementById('gsGameList').innerHTML = '';
  const paginEl = document.getElementById('gsPagination');
  if (paginEl) paginEl.style.display = 'none';
  gsFetchedGames = [];
  gsCurrentPage  = 0;
  _gsUsername    = '';
}

function selectPlatformGame(idx, color) {
  const game = gsFetchedGames[idx];
  if (!game) return;
  document.getElementById('pgnInput').value = game.pgn;
  setPlayerColor(color);
  startFlow();
}
