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

let _pageTransitionTimer = null;

function showPage(name) {
  const target = 'page' + name[0].toUpperCase() + name.slice(1);
  const targetEl = document.getElementById(target);
  if (!targetEl) return;

  // Cancel any pending leave->finalize transition and clear stale classes
  if (_pageTransitionTimer) {
    clearTimeout(_pageTransitionTimer);
    _pageTransitionTimer = null;
  }

  // The currently visible page (if any) that needs to exit
  let currentEl = null;
  for (const id of ALL_PAGES) {
    if (id === target) continue;
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none') { currentEl = el; break; }
  }

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finalize = () => {
    ALL_PAGES.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === target) {
        el.style.display = '';
        el.classList.remove('page-enter', 'page-leave');
        // Force reflow so the entrance animation restarts
        void el.offsetWidth;
        el.classList.add('page-enter');
      } else {
        el.style.display = 'none';
        el.classList.remove('page-enter', 'page-leave');
      }
    });
    // Each .app-page has its own internal scroll on desktop; on mobile
    // the document itself scrolls (html has scroll-behavior: smooth,
    // so pass behavior:'instant' to avoid animating the reset).
    try { targetEl.scrollTop = 0; } catch {}
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
    // Re-run the reveal observer against the freshly shown page
    if (typeof window.ceResetReveals === 'function') {
      window.ceResetReveals(targetEl);
    }
    if (typeof window.ceObserveReveals === 'function') {
      window.ceObserveReveals(targetEl);
    }
    // Persist current page so reload restores it
    try { localStorage.setItem('ce-current-page', name); } catch {}
    if (name === 'gameSelect') {
      initGameSelect();
      if (typeof updateFreeBadge === 'function') updateFreeBadge();
    }
    if (name === 'repInput' && typeof initRepInput === 'function') {
      initRepInput();
    }
  };

  // Exit the current page, then swap. Skip on reduced-motion or first load.
  if (currentEl && !reduced) {
    currentEl.classList.remove('page-enter');
    // Force reflow before adding leave so the animation actually plays
    void currentEl.offsetWidth;
    currentEl.classList.add('page-leave');
    _pageTransitionTimer = setTimeout(() => {
      _pageTransitionTimer = null;
      finalize();
    }, 150);
  } else {
    finalize();
  }
}

