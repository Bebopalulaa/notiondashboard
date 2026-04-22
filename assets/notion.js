/**
 * Notion API layer — fully decoupled from DOM.
 * Handles CORS proxy routing, pagination, and in-memory cache.
 */

const DEBUG = false;

/** @type {{ studios: Studio[], fetchedAt: number|null }} */
export const cache = { studios: [], fetchedAt: null };

const NOTION_VERSION = '2022-06-28';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** @typedef {{ id:string, name:string, status:string, dateTrouve:string|null, dateEnvoi:string|null, reponse:boolean, notes:string }} Studio */

const FIELD_DEFAULTS = {
  notion_field_name:        'Name',
  notion_field_status:      'Status',
  notion_field_date_trouve: 'Date trouvé',
  notion_field_date_envoi:  'Date envoi',
  notion_field_reponse:     'Réponse',
  notion_field_notes:       'Notes',
};

/** @param {string} key */
function ls(key) { return localStorage.getItem(key) || ''; }

/** @param {string} key */
function lsField(key) { return ls(key) || FIELD_DEFAULTS[key] || ''; }

/**
 * Build the proxied URL for a Notion API path.
 * Uses the configured Cloudflare Worker or falls back to corsproxy.io.
 * @param {string} path - e.g. "/databases/{id}/query"
 * @returns {string}
 */
function buildUrl(path) {
  const proxy = ls('notion_proxy_url').replace(/\/$/, '');
  if (proxy) return `${proxy}${path}`;
  return `https://corsproxy.io/?url=https://api.notion.com/v1${path}`;
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${ls('notion_token')}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

/**
 * Low-level Notion API fetch. Throws with a human-readable message on error.
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function notionFetch(path, options = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
  } catch {
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

/**
 * Fetch all pages from the Notion database, handling pagination automatically.
 * @returns {Promise<object[]>} Raw Notion page objects
 */
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
    cursor  = data.next_cursor;
  }

  if (DEBUG) console.debug('[notion] fetched', all.length, 'pages');
  return all;
}

/* ── Property extractors ───────────────────────────────────────── */
const getTitle    = p => p?.title?.[0]?.plain_text     || '';
const getSelect   = p => p?.select?.name               || '';
const getDate     = p => p?.date?.start                || null;
const getCheckbox = p => p?.checkbox === true;
const getRichText = p => (p?.rich_text || []).map(t => t.plain_text).join('') || '';

/**
 * Normalize a raw Notion page object into a Studio record.
 * Uses field-name mappings from localStorage.
 * @param {object} page - Raw Notion API page object
 * @returns {Studio}
 */
export function normalizeStudio(page) {
  const props = page.properties;
  return {
    id:         page.id.replace(/-/g, ''),
    name:       getTitle(props[lsField('notion_field_name')]),
    status:     getSelect(props[lsField('notion_field_status')]),
    dateTrouve: getDate(props[lsField('notion_field_date_trouve')]),
    dateEnvoi:  getDate(props[lsField('notion_field_date_envoi')]),
    reponse:    getCheckbox(props[lsField('notion_field_reponse')]),
    notes:      getRichText(props[lsField('notion_field_notes')]),
  };
}

/**
 * Fetch and cache studio data. Returns cached data if still fresh (< 5 min).
 * @param {boolean} [force=false] - Bypass cache and force a fresh fetch
 * @returns {Promise<Studio[]>}
 */
export async function refreshData(force = false) {
  if (!force && cache.fetchedAt && (Date.now() - cache.fetchedAt) < CACHE_TTL) {
    if (DEBUG) console.debug('[notion] cache hit');
    return cache.studios;
  }

  const pages   = await fetchAllPages();
  const studios = pages.map(normalizeStudio);

  cache.studios   = studios;
  cache.fetchedAt = Date.now();

  return studios;
}
