/* Notion API — CORS proxy layer with pagination and in-memory cache */

window._notionCache = { studios: [], fetchedAt: null };

const NOTION_VERSION = '2022-06-28';

const FIELD_DEFAULTS = {
  notion_field_name:         'Name',
  notion_field_status:       'Status',
  notion_field_date_trouve:  'Date trouvé',
  notion_field_date_envoi:   'Date envoi',
  notion_field_reponse:      'Réponse',
  notion_field_notes:        'Notes',
};

function ls(key) {
  return localStorage.getItem(key) || '';
}

function lsField(key) {
  return ls(key) || FIELD_DEFAULTS[key] || '';
}

function buildUrl(path) {
  const proxy = ls('notion_proxy_url').replace(/\/$/, '');
  if (proxy) return `${proxy}${path}`;
  return `https://corsproxy.io/?url=${encodeURIComponent('https://api.notion.com/v1' + path)}`;
}

function headers() {
  return {
    'Authorization': `Bearer ${ls('notion_token')}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      headers: { ...headers(), ...(options.headers || {}) },
    });
  } catch (e) {
    throw new Error('Erreur réseau — vérifie ta connexion ou l\'URL du proxy');
  }

  if (!response.ok) {
    const msgs = {
      401: 'Token invalide (401) — vérifie ton Integration Token',
      403: 'Accès refusé (403) — partage la base avec ton intégration',
      404: 'Base introuvable (404) — vérifie le Database ID',
      429: 'Trop de requêtes (429) — réessaie dans quelques secondes',
    };
    throw new Error(msgs[response.status] || `Erreur HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchAllPages() {
  const dbId = ls('notion_db_id');
  if (!dbId) throw new Error('Database ID manquant — configure-le dans Paramètres');

  const all = [];
  let hasMore = true;
  let cursor;

  while (hasMore) {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const data = await notionFetch(`/databases/${dbId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    all.push(...data.results);
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  return all;
}

function getTitle(prop)     { return prop?.title?.[0]?.plain_text || ''; }
function getSelect(prop)    { return prop?.select?.name || ''; }
function getDate(prop)      { return prop?.date?.start || null; }
function getCheckbox(prop)  { return prop?.checkbox === true; }
function getRichText(prop)  { return (prop?.rich_text || []).map(t => t.plain_text).join('') || ''; }

function normalizeStudio(page) {
  const p = page.properties;
  return {
    id:          page.id.replace(/-/g, ''),
    name:        getTitle(p[lsField('notion_field_name')]),
    status:      getSelect(p[lsField('notion_field_status')]),
    dateTrouve:  getDate(p[lsField('notion_field_date_trouve')]),
    dateEnvoi:   getDate(p[lsField('notion_field_date_envoi')]),
    reponse:     getCheckbox(p[lsField('notion_field_reponse')]),
    notes:       getRichText(p[lsField('notion_field_notes')]),
  };
}

async function refreshData(force = false) {
  const cache = window._notionCache;
  const FIVE_MIN = 5 * 60 * 1000;

  if (!force && cache.fetchedAt && (Date.now() - cache.fetchedAt) < FIVE_MIN) {
    return cache.studios;
  }

  const pages = await fetchAllPages();
  const studios = pages.map(normalizeStudio);
  window._notionCache = { studios, fetchedAt: Date.now() };
  return studios;
}

window.NotionAPI = { refreshData, notionFetch, normalizeStudio };
