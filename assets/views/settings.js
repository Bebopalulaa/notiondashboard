/**
 * View: Settings — connection form, field mapping, cache management, about.
 */

import { notionFetch, cache as notionCache } from '../notion.js';

const FIELD_MAP = [
  ['s-field-name',        'notion_field_name',        'Name'],
  ['s-field-status',      'notion_field_status',       'Status'],
  ['s-field-date-trouve', 'notion_field_date_trouve',  'Date trouvé'],
  ['s-field-date-envoi',  'notion_field_date_envoi',   'Date envoi'],
  ['s-field-reponse',     'notion_field_reponse',      'Réponse'],
  ['s-field-notes',       'notion_field_notes',        'Notes'],
];

/* ── HTML template ──────────────────────────────────────────────── */
function template() {
  return `
    <!-- 1. Connexion -->
    <div class="settings-card">
      <h3 class="settings-card-title">Connexion Notion</h3>
      <div class="form-group">
        <label for="s-token">Integration Token</label>
        <div class="input-with-toggle">
          <input type="password" id="s-token" placeholder="secret_…" autocomplete="off" spellcheck="false">
          <button class="toggle-pw-btn" data-target="s-token" aria-label="Afficher/masquer">
            <i data-lucide="eye"></i>
          </button>
        </div>
      </div>
      <div class="form-group">
        <label for="s-db-id">Database ID</label>
        <input type="text" id="s-db-id" placeholder="abc123…" spellcheck="false">
      </div>
      <div class="form-group">
        <label for="s-proxy-url">URL du proxy CORS</label>
        <input type="url" id="s-proxy-url" placeholder="https://xxx.workers.dev/notion">
        <span class="helper-text">Laisse vide pour utiliser corsproxy.io (moins fiable)</span>
      </div>
      <div id="connection-status" class="connection-status" role="status" aria-live="polite"></div>
      <div class="settings-actions">
        <button id="test-connection" class="btn btn-secondary">Tester la connexion</button>
        <button id="save-connection" class="btn btn-primary">Sauvegarder</button>
      </div>
    </div>

    <!-- 2. Mapping -->
    <div class="settings-card">
      <h3 class="settings-card-title">Mapping des propriétés</h3>
      ${FIELD_MAP.map(([id, , placeholder]) => `
        <div class="form-group">
          <label for="${id}">${labelText(id)}</label>
          <input type="text" id="${id}" placeholder="${placeholder}">
          <span class="helper-text">Nom exact tel qu'il apparaît dans Notion</span>
        </div>`).join('')}
      <div class="settings-actions">
        <button id="reset-fields" class="btn btn-secondary">Réinitialiser les valeurs par défaut</button>
        <button id="save-fields" class="btn btn-primary">Sauvegarder</button>
      </div>
    </div>

    <!-- 3. Cache -->
    <div class="settings-card">
      <h3 class="settings-card-title">Cache &amp; Données</h3>
      <p id="cache-info" class="cache-info">Dernière synchronisation : Jamais</p>
      <div class="settings-actions">
        <button id="force-sync" class="btn btn-secondary">Forcer la resynchronisation</button>
        <button id="clear-cache" class="btn btn-secondary btn-danger">Vider le cache</button>
      </div>
    </div>

    <!-- 4. About -->
    <div class="settings-card">
      <h3 class="settings-card-title">À propos</h3>
      <p class="about-text">Prospect Dashboard v2.0.0</p>
      <p class="about-text text-muted">Dashboard de prospection cold email pour freelances 3D character artists</p>
    </div>`;
}

function labelText(id) {
  return {
    's-field-name':        'Champ Nom',
    's-field-status':      'Champ Statut',
    's-field-date-trouve': 'Champ Date trouvé',
    's-field-date-envoi':  'Champ Date envoi',
    's-field-reponse':     'Champ Réponse',
    's-field-notes':       'Champ Notes',
  }[id] || id;
}

/* ── form helpers ───────────────────────────────────────────────── */
function loadValues() {
  document.getElementById('s-token').value     = localStorage.getItem('notion_token')     || '';
  document.getElementById('s-db-id').value     = localStorage.getItem('notion_db_id')     || '';
  document.getElementById('s-proxy-url').value = localStorage.getItem('notion_proxy_url') || '';

  FIELD_MAP.forEach(([id, key, def]) => {
    const el = document.getElementById(id);
    if (el) el.value = localStorage.getItem(key) || def;
  });

  updateCacheInfo();
}

/**
 * Update the cache-info paragraph with the last sync time.
 */
export function updateCacheInfo() {
  const el = document.getElementById('cache-info');
  if (!el) return;
  if (notionCache.fetchedAt) {
    const d = new Date(notionCache.fetchedAt);
    el.textContent = `Dernière synchronisation : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    el.textContent = 'Dernière synchronisation : Jamais';
  }
}

function showStatus(type, msg) {
  const el = document.getElementById('connection-status');
  if (!el) return;
  el.className = `connection-status${type ? ` ${type}` : ''}`;
  el.textContent = msg;
  if (!type) el.style.display = 'none';
}

/* ── event handlers ─────────────────────────────────────────────── */
async function testConnection() {
  const token = document.getElementById('s-token').value.trim();
  const dbId  = document.getElementById('s-db-id').value.trim();
  const proxy = document.getElementById('s-proxy-url').value.trim();

  if (!token || !dbId) { showStatus('error', '✗ Remplis le token et le Database ID'); return; }

  /* Temporarily write to allow notionFetch to use these values */
  const prev = ['notion_token','notion_db_id','notion_proxy_url'].map(k => [k, localStorage.getItem(k)]);
  localStorage.setItem('notion_token', token);
  localStorage.setItem('notion_db_id', dbId);
  localStorage.setItem('notion_proxy_url', proxy);

  const btn = document.getElementById('test-connection');
  btn.disabled = true; btn.textContent = 'Test en cours…';
  showStatus('', '');

  try {
    const data = await notionFetch(`/databases/${dbId}/query`, { method: 'POST', body: JSON.stringify({ page_size: 1 }) });
    const n = data.results?.length ?? 0;
    showStatus('success', `✓ Connecté — base accessible (${n} entrée${n !== 1 ? 's' : ''} testée${n !== 1 ? 's' : ''})`);
  } catch (e) {
    showStatus('error', `✗ ${e.message}`);
    /* Restore on failure */
    prev.forEach(([k, v]) => v !== null ? localStorage.setItem(k, v) : localStorage.removeItem(k));
  } finally {
    btn.disabled = false; btn.textContent = 'Tester la connexion';
  }
}

function saveConnection() {
  localStorage.setItem('notion_token',     document.getElementById('s-token').value.trim());
  localStorage.setItem('notion_db_id',     document.getElementById('s-db-id').value.trim());
  localStorage.setItem('notion_proxy_url', document.getElementById('s-proxy-url').value.trim());
  showStatus('success', '✓ Paramètres de connexion sauvegardés');
}

function saveFields() {
  FIELD_MAP.forEach(([id, key, def]) => {
    const v = document.getElementById(id)?.value.trim();
    localStorage.setItem(key, v || def);
  });
  /* Invalidate cache so next fetch uses new field names */
  notionCache.studios   = [];
  notionCache.fetchedAt = null;
  showStatus('success', '✓ Mapping sauvegardé — le cache a été réinitialisé');
}

function resetFields() {
  FIELD_MAP.forEach(([id, , def]) => {
    const el = document.getElementById(id);
    if (el) el.value = def;
  });
}

/* ── init events (re-run after each scaffold injection) ─────────── */
function initEvents() {
  /* Password toggle */
  document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      const ic = btn.querySelector('i');
      if (ic) ic.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
      if (window.lucide) lucide.createIcons();
    });
  });

  document.getElementById('save-connection')?.addEventListener('click', saveConnection);
  document.getElementById('test-connection')?.addEventListener('click', testConnection);
  document.getElementById('save-fields')?.addEventListener('click', saveFields);
  document.getElementById('reset-fields')?.addEventListener('click', resetFields);

  document.getElementById('force-sync')?.addEventListener('click', () => {
    /* Delegated to app.js via global */
    window.__appFetchData?.(true);
  });

  document.getElementById('clear-cache')?.addEventListener('click', () => {
    notionCache.studios   = [];
    notionCache.fetchedAt = null;
    updateCacheInfo();
    showStatus('success', '✓ Cache vidé');
  });
}

/**
 * Render the settings view.
 * Re-injects HTML each time to reset form state cleanly.
 */
export function render() {
  const section = document.getElementById('view-settings');
  if (!section) return;

  section.innerHTML = `<div class="settings-content">${template()}</div>`;
  if (window.lucide) lucide.createIcons();

  loadValues();
  initEvents();
}
