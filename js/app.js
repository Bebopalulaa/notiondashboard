/* App — orchestration, settings init, fetch, theme, nav */

window.App = (function () {

  const DEFAULTS = {
    notion_token:             '',
    notion_db_id:             '',
    notion_proxy_url:         '',
    notion_field_name:        'Name',
    notion_field_status:      'Status',
    notion_field_date_trouve: 'Date trouvé',
    notion_field_date_envoi:  'Date envoi',
    notion_field_reponse:     'Réponse',
    notion_field_notes:       'Notes',
  };

  let currentData = [];
  let isFetching  = false;

  /* ── localStorage defaults ────────────────────────────────────── */

  function initDefaults() {
    Object.entries(DEFAULTS).forEach(([key, val]) => {
      if (localStorage.getItem(key) === null && val) {
        localStorage.setItem(key, val);
      }
    });
  }

  /* ── config check ─────────────────────────────────────────────── */

  function isConfigured() {
    return !!(localStorage.getItem('notion_token') && localStorage.getItem('notion_db_id'));
  }

  function showOnboarding() {
    document.getElementById('onboarding').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  }

  function showApp() {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  /* ── data fetching ────────────────────────────────────────────── */

  async function fetchData(force) {
    if (isFetching) return;
    isFetching = true;

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.classList.add('spinning');

    try {
      currentData = await window.NotionAPI.refreshData(force);
      updateSyncBadge();

      /* re-render current view */
      const route = window.Router ? window.Router.current() : 'overview';
      renderView(route);
    } catch (err) {
      showError(err.message);
    } finally {
      isFetching = false;
      if (refreshBtn) refreshBtn.classList.remove('spinning');
    }
  }

  function showError(msg) {
    /* show an error banner at top of content area */
    const existing = document.getElementById('global-error');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'global-error';
    banner.className = 'error-banner';
    banner.style.margin = '16px 24px';
    banner.innerHTML = `<span>⚠</span><span>${msg}</span>`;
    document.getElementById('content').prepend(banner);
    setTimeout(() => banner.remove(), 8000);
  }

  /* ── sync badge ───────────────────────────────────────────────── */

  function updateSyncBadge() {
    const el = document.getElementById('last-sync');
    if (!el) return;
    const cache = window._notionCache;
    if (cache && cache.fetchedAt) {
      const d = new Date(cache.fetchedAt);
      el.textContent = `Sync ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      el.textContent = 'Jamais synchronisé';
    }
    if (window.ViewSettings) window.ViewSettings.updateCacheInfo();
  }

  /* ── view dispatch ────────────────────────────────────────────── */

  function renderView(route) {
    switch (route) {
      case 'overview': window.ViewOverview && ViewOverview.render(currentData); break;
      case 'monthly':  window.ViewMonthly  && ViewMonthly.render(currentData);  break;
      case 'funnel':   window.ViewFunnel   && ViewFunnel.render(currentData);   break;
      case 'list':     window.ViewList     && ViewList.render(currentData);     break;
      case 'settings': window.ViewSettings && ViewSettings.render(currentData); break;
    }
  }

  /* ── theme toggle ─────────────────────────────────────────────── */

  function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    updateThemeIcon(saved);

    document.getElementById('theme-toggle').addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      updateThemeIcon(next);
      /* re-render current view to update chart colors */
      const route = window.Router ? window.Router.current() : 'overview';
      renderView(route);
    });
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
  }

  /* ── event listeners ──────────────────────────────────────────── */

  let eventsInited = false;
  function initEvents() {
    if (eventsInited) return;
    eventsInited = true;

    /* refresh button */
    document.getElementById('refresh-btn').addEventListener('click', () => {
      if (isConfigured()) fetchData(true);
    });

    /* sidebar mobile toggle (future: slide-in sidebar) */
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        /* on mobile, navigate to current route — sidebar is bottom nav */
      });
    }
  }

  /* ── Chart.js global theme ────────────────────────────────────── */

  function initChartDefaults() {
    if (!window.Chart) return;
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
    Chart.defaults.font.size   = 12;
  }

  /* ── INIT ─────────────────────────────────────────────────────── */

  function init() {
    initDefaults();
    initChartDefaults();

    if (window.lucide) lucide.createIcons();

    /* onboarding CTA — always wired, regardless of config state */
    const cta = document.getElementById('onboarding-cta');
    if (cta) {
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        showApp();
        initTheme();
        initEvents();
        window.Router.init();
        window.location.hash = '#settings';
      });
    }

    if (!isConfigured()) {
      showOnboarding();
      return;
    }

    showApp();
    initTheme();
    initEvents();
    window.Router.init();

    /* fetch data (use cache if fresh) */
    fetchData(false);
  }

  document.addEventListener('DOMContentLoaded', init);

  return { fetchData, renderView, showApp, updateSyncBadge, isConfigured };
})();
