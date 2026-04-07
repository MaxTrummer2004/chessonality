// ==============================================================
//  NAVIGATION
// ==============================================================
function goTo(ply) {
  // Reset live board user moves when navigating
  if (typeof liveBoardReset === 'function') liveBoardReset();
  // Reset analysis view toggle
  if (typeof _activeAnalysisView !== 'undefined') _activeAnalysisView = null;
  currentPly = Math.max(0, Math.min(positions.length - 1, ply));
  renderBoard();
  setTimeout(() => {
    const a = document.querySelector('.move-cell.active');
    if (a) a.scrollIntoView({ block: 'nearest' });
  }, 0);
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft')  goTo(currentPly - 1);
  if (e.key === 'ArrowRight') goTo(currentPly + 1);
  if (e.key === 'Home')       goTo(0);
  if (e.key === 'End')        goTo(positions.length - 1);
});

// ==============================================================
//  PAGE MANAGEMENT
// ==============================================================
const ALL_PAGES = ['pageLanding','pageGameSelect','pageRepInput','pageRepLoading','pageQuestionnaire','pageLoading','pageHighlights','pagePersonality','pageMain','pageBreakdown','pageProfile','pageInsights','pageRepertoire','pageCoach'];
function showPage(name) {
  const target = 'page' + name[0].toUpperCase() + name.slice(1);
  ALL_PAGES.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === target) {
      el.style.display = '';
      el.classList.remove('page-enter');
      void el.offsetWidth; // force reflow
      el.classList.add('page-enter');
    } else {
      el.style.display = 'none';
      el.classList.remove('page-enter');
    }
  });
  window.scrollTo(0, 0);
  // Persist current page so reload restores it
  try { localStorage.setItem('ce-current-page', name); } catch {}
  if (name === 'gameSelect') {
    initGameSelect();
    if (typeof updateFreeBadge === 'function') updateFreeBadge();
  }
  if (name === 'repInput' && typeof initRepInput === 'function') {
    initRepInput();
  }
}

