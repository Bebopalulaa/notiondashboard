/**
 * App entry point — bootstraps settings, routing, data fetching,
 * error handling, and theme toggling.
 */

import { refreshData, cache as notionCache } from './notion.js';
import { initRouter, currentRoute, navigate } from './router.js';
import { render as renderOverview }  from './views/overview.js';
import { render as renderMonthly }   from './views/monthly.js';
import { render as renderFunnel }    from './views/funnel.js';
import { render as renderList }      from './views/list.js';
import { render as renderSettings, updateCacheInfo } from './views/settings.js';

/* ── localStorage defaults ──────────────────────────────────────── */
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

function initDefaults() {
  Object.entries(DEFAULTS).forEach(([k, v]) => {
    if (localStorage.getItem(k) === null && v) localStorage.setItem(k, v);
  });
}

/** @returns {boolean} */
function isConfigured() {
  return !!(localStorage.getItem('notion_token') && localStorage.getItem('notion_db_id'));
}

/* ── state ──────────────────────────────────────────────────────── */
/** @type {import('./notion.js').Studio[]|null} */
let studios = null;   // null = not yet loaded (shows skeletons)
let fetching = false;

/* ── view dispatch ──────────────────────────────────────────────── */
function renderView(route) {
  switch (route) {
    case 'overview': renderOverview(studios); break;
    case 'monthly':  renderMonthly(studios);  break;
    case 'funnel':   renderFunnel(studios);   break;
    case 'list':     renderList(studios);     break;
    case 'settings': renderSettings();        break;
  }
}

/* ── data fetching ──────────────────────────────────────────────── */

/**
 * Fetch studio data from Notion, update UI, and re-render current view.
 * @param {boolean} [force=false]
 */
async function fetchData(force = false) {
  if (fetching) return;
  fetching = true;

  const btn = document.getElementById('refresh-btn');
  btn?.classList.add('spinning');

  try {
    studios = await refreshData(force);
    updateSyncBadge();
    renderView(currentRoute());
  } catch (err) {
    showError(err.message);
    if (studios === null) {
      studios = []; // stop showing skeletons on error
      renderView(currentRoute());
    }
  } finally {
    fetching = false;
    btn?.classList.remove('spinning');
  }
}

/* ── error banner ───────────────────────────────────────────────── */
let errorTimer;

function showError(msg) {
  const banner  = document.getElementById('error-banner');
  const msgEl   = document.getElementById('error-message');
  if (!banner || !msgEl) return;

  clearTimeout(errorTimer);
  msgEl.textContent = msg;
  banner.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  errorTimer = setTimeout(() => banner.classList.add('hidden'), 8000);
}

function initErrorBanner() {
  document.getElementById('error-close')?.addEventListener('click', () => {
    document.getElementById('error-banner').classList.add('hidden');
    clearTimeout(errorTimer);
  });
  document.getElementById('error-retry')?.addEventListener('click', () => {
    document.getElementById('error-banner').classList.add('hidden');
    fetchData(true);
  });
}

/* ── sync badge ─────────────────────────────────────────────────── */
function updateSyncBadge() {
  const el = document.getElementById('last-sync');
  if (!el) return;
  if (notionCache.fetchedAt) {
    const d = new Date(notionCache.fetchedAt);
    el.textContent = `Sync ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    el.textContent = 'Jamais synchronisé';
  }
  updateCacheInfo();
}

/* ── theme toggle ───────────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
    renderView(currentRoute()); // redraw charts with new colors
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const icon = document.querySelector('#theme-toggle i');
  if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
  if (window.lucide) lucide.createIcons();
}

/* ── onboarding ─────────────────────────────────────────────────── */
function showOnboarding() {
  document.getElementById('onboarding').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function showApp() {
  document.getElementById('onboarding').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

/* ── global ref for settings.js force-sync button ──────────────── */
window.__appFetchData = fetchData;

/* ── INIT ───────────────────────────────────────────────────────── */
function init() {
  initDefaults();
  if (window.lucide) lucide.createIcons();

  /* Onboarding CTA — always wire regardless of config state */
  document.getElementById('onboarding-cta')?.addEventListener('click', e => {
    e.preventDefault();
    showApp();
    initTheme();
    initErrorBanner();
    document.getElementById('refresh-btn')?.addEventListener('click', () => isConfigured() && fetchData(true));
    initRouter(renderView);
    navigate('#settings');
  });

  if (!isConfigured()) { showOnboarding(); return; }

  showApp();
  initTheme();
  initErrorBanner();

  document.getElementById('refresh-btn')?.addEventListener('click', () => isConfigured() && fetchData(true));

  /* Router init — first navigation shows skeletons (studios === null) */
  initRouter(renderView);

  /* Load data */
  fetchData(false);
}

/* Module scripts are deferred — DOM is ready when this executes */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
