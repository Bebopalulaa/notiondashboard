/**
 * Notion API layer — fully decoupled from DOM.
 * Handles CORS proxy routing, pagination, and in-memory cache.
 */

const DEBUG = false;

/** @type {{ studios: Studio[], fetchedAt: number|null }} */
export const cache = { studios: [], fetchedAt: null };

const NOTION_VERSION = '2022-06-28';
const CACHE_TTL = 5 * 60 * 1000;

/**
 * @typedef {{
 *   id: string, name: string,
 *   dateEnvoiC1: string|null,
 *   relPrevC1J3: string|null, relEffC1J3: string|null,
 *   relPrevC1J7: string|null, relEffC1J7: string|null,
 *   relPrevC1J14: string|null, relEffC1J14: string|null,
 *   dateEnvoiC2: string|null,
 *   relPrevC2J3: string|null, relEffC2J3: string|null,
 *   relPrevC2J7: string|null, relEffC2J7: string|null,
 *   relPrevC2J14: string|null, relEffC2J14: string|null,
 *   c1Repondu: boolean
 * }} Studio
 */

const FIELD_DEFAULTS = {
  notion_field_name:            'Name',
  notion_field_envoi_c1:        'Date envoi C1',
  notion_field_rel_prev_c1_j3:  'Relance prévue C1 J+3',
  notion_field_rel_eff_c1_j3:   'Relance effective C1 J+3',
  notion_field_rel_prev_c1_j7:  'Relance prévue C1 J+7',
  notion_field_rel_eff_c1_j7:   'Relance effective C1 J+7',
  notion_field_rel_prev_c1_j14: 'Relance prévue C1 J+14',
  notion_field_rel_eff_c1_j14:  'Relance effective C1 J+14',
  notion_field_envoi_c2:        'Date envoi C2',
  notion_field_rel_prev_c2_j3:  'Relance prévue C2 J+3',
  notion_field_rel_eff_c2_j3:   'Relance effective C2 J+3',
  notion_field_rel_prev_c2_j7:  'Relance prévue C2 J+7',
  notion_field_rel_eff_c2_j7:   'Relance effective C2 J+7',
  notion_field_rel_prev_c2_j14: 'Relance prévue C2 J+14',
  notion_field_rel_eff_c2_j14:  'Relance effective C2 J+14',
  notion_field_c1_repondu:      'Contact 1 répondu ?',
};

/** @param {string} key */
function ls(key) { return localStorage.getItem(key) || ''; }

/** @param {string} key */
function lsField(key) { return ls(key) || FIELD_DEFAULTS[key] || ''; }

/**
 * Build the proxied URL for a Notion API path.
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
 * @returns {Promise<object[]>}
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
const getTitle    = p => p?.title?.[0]?.plain_text  || '';
const getDate     = p => p?.date?.start             || null;
const getCheckbox = p => p?.checkbox === true;

/**
 * Normalize a raw Notion page object into a Studio record.
 * @param {object} page
 * @returns {Studio}
 */
export function normalizeStudio(page) {
  const props = page.properties;
  const f = key => props[lsField(key)];
  return {
    id:            page.id.replace(/-/g, ''),
    name:          getTitle(f('notion_field_name')),
    dateEnvoiC1:   getDate(f('notion_field_envoi_c1')),
    relPrevC1J3:   getDate(f('notion_field_rel_prev_c1_j3')),
    relEffC1J3:    getDate(f('notion_field_rel_eff_c1_j3')),
    relPrevC1J7:   getDate(f('notion_field_rel_prev_c1_j7')),
    relEffC1J7:    getDate(f('notion_field_rel_eff_c1_j7')),
    relPrevC1J14:  getDate(f('notion_field_rel_prev_c1_j14')),
    relEffC1J14:   getDate(f('notion_field_rel_eff_c1_j14')),
    dateEnvoiC2:   getDate(f('notion_field_envoi_c2')),
    relPrevC2J3:   getDate(f('notion_field_rel_prev_c2_j3')),
    relEffC2J3:    getDate(f('notion_field_rel_eff_c2_j3')),
    relPrevC2J7:   getDate(f('notion_field_rel_prev_c2_j7')),
    relEffC2J7:    getDate(f('notion_field_rel_eff_c2_j7')),
    relPrevC2J14:  getDate(f('notion_field_rel_prev_c2_j14')),
    relEffC2J14:   getDate(f('notion_field_rel_eff_c2_j14')),
    c1Repondu:     getCheckbox(f('notion_field_c1_repondu')),
  };
}

/**
 * Fetch and cache studio data. Returns cached data if still fresh (< 5 min).
 * @param {boolean} [force=false]
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
