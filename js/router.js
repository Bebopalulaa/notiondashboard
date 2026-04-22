/* Hash-based router — no page reload */

window.Router = (function () {
  const ROUTES = {
    overview: { title: 'Vue d\'ensemble',   view: 'view-overview' },
    monthly:  { title: 'Activité mensuelle', view: 'view-monthly' },
    funnel:   { title: 'Funnel',             view: 'view-funnel' },
    list:     { title: 'Prospects',          view: 'view-list' },
    settings: { title: 'Paramètres',         view: 'view-settings' },
  };

  function getRoute(hash) {
    const key = (hash || '').replace('#', '').trim();
    return ROUTES[key] ? key : 'overview';
  }

  function navigate(hash) {
    const route = getRoute(hash);
    const config = ROUTES[route];

    /* hide all views */
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));

    /* show target view */
    const target = document.getElementById(config.view);
    if (target) target.classList.remove('hidden');

    /* page title */
    const title = document.getElementById('page-title');
    if (title) title.textContent = config.title;

    /* nav active state */
    document.querySelectorAll('[data-route]').forEach(el => {
      el.classList.toggle('active', el.dataset.route === route);
    });

    /* render the view */
    if (window.App) window.App.renderView(route);

    return route;
  }

  function init() {
    window.addEventListener('hashchange', () => navigate(window.location.hash));
    navigate(window.location.hash || '#overview');
  }

  function current() {
    return getRoute(window.location.hash);
  }

  return { init, navigate, current, ROUTES };
})();
