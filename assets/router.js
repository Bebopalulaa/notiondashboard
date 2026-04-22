/**
 * Hash-based router — maps URL hashes to view sections and page titles.
 * Emits no DOM events; delegates rendering to a registered callback.
 */

/** @typedef {(route: string) => void} RenderCallback */

const ROUTES = {
  overview: { title: "Vue d'ensemble",    section: 'view-overview' },
  monthly:  { title: 'Activité mensuelle', section: 'view-monthly' },
  funnel:   { title: 'Funnel',             section: 'view-funnel' },
  list:     { title: 'Prospects',          section: 'view-list' },
  settings: { title: 'Paramètres',         section: 'view-settings' },
};

/** @type {RenderCallback|null} */
let _onRender = null;

/**
 * Parse a hash string into a valid route key.
 * @param {string} hash
 * @returns {string}
 */
function parseRoute(hash) {
  const key = (hash || '').replace('#', '').trim();
  return ROUTES[key] ? key : 'overview';
}

/**
 * Navigate to a route: show the correct section, update nav, call render cb.
 * @param {string} hash
 * @returns {string} Resolved route key
 */
export function navigate(hash) {
  const route = parseRoute(hash);
  const config = ROUTES[route];

  /* Toggle view sections */
  document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
  document.getElementById(config.section)?.classList.remove('hidden');

  /* Page title */
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = config.title;

  /* Nav active state */
  document.querySelectorAll('[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });

  /* Delegate rendering */
  _onRender?.(route);

  return route;
}

/**
 * Initialize the router: attach hashchange listener and navigate to current hash.
 * @param {RenderCallback} onRender - Called with the route key on every navigation
 */
export function initRouter(onRender) {
  _onRender = onRender;
  window.addEventListener('hashchange', () => navigate(window.location.hash));
  navigate(window.location.hash || '#overview');
}

/**
 * Return the currently active route key.
 * @returns {string}
 */
export function currentRoute() {
  return parseRoute(window.location.hash);
}
