/**
 * View: Settings — connection form, field mapping by section, cache management.
 */

import { notionFetch, cache as notionCache } from '../notion.js';

/* ── Field map: [htmlId, lsKey, placeholder, label] ────────────── */
const FIELD_MAP = [
  ['s-field-statut',          'notion_field_statut',          'Statut',                     'Champ Statut'],
  ['s-field-statut-value',    'notion_field_statut_value',    'OUI',                        'Valeur à afficher'],
  ['s-field-name',            'notion_field_name',            'Name',                       'Nom du studio'],
  ['s-field-envoi-c1',        'notion_field_envoi_c1',        'Date envoi C1',              'Envoi C1 J+0'],
  ['s-field-rel-prev-c1-j3',  'notion_field_rel_prev_c1_j3',  'Relance prévue C1 J+3',     'Relance prévue C1 J+3'],
  ['s-field-rel-eff-c1-j3',   'notion_field_rel_eff_c1_j3',   'Relance effective C1 J+3',  'Relance effective C1 J+3'],
  ['s-field-rel-prev-c1-j7',  'notion_field_rel_prev_c1_j7',  'Relance prévue C1 J+7',     'Relance prévue C1 J+7'],
  ['s-field-rel-eff-c1-j7',   'notion_field_rel_eff_c1_j7',   'Relance effective C1 J+7',  'Relance effective C1 J+7'],
  ['s-field-rel-prev-c1-j14', 'notion_field_rel_prev_c1_j14', 'Relance prévue C1 J+14',    'Relance prévue C1 J+14'],
  ['s-field-rel-eff-c1-j14',  'notion_field_rel_eff_c1_j14',  'Relance effective C1 J+14', 'Relance effective C1 J+14'],
  ['s-field-envoi-c2',        'notion_field_envoi_c2',        'Date envoi C2',              'Envoi C2 J+0'],
  ['s-field-rel-prev-c2-j3',  'notion_field_rel_prev_c2_j3',  'Relance prévue C2 J+3',     'Relance prévue C2 J+3'],
  ['s-field-rel-eff-c2-j3',   'notion_field_rel_eff_c2_j3',   'Relance effective C2 J+3',  'Relance effective C2 J+3'],
  ['s-field-rel-prev-c2-j7',  'notion_field_rel_prev_c2_j7',  'Relance prévue C2 J+7',     'Relance prévue C2 J+7'],
  ['s-field-rel-eff-c2-j7',   'notion_field_rel_eff_c2_j7',   'Relance effective C2 J+7',  'Relance effective C2 J+7'],
  ['s-field-rel-prev-c2-j14', 'notion_field_rel_prev_c2_j14', 'Relance prévue C2 J+14',    'Relance prévue C2 J+14'],
  ['s-field-rel-eff-c2-j14',  'notion_field_rel_eff_c2_j14',  'Relance effective C2 J+14', 'Relance effective C2 J+14'],
  ['s-field-c1-repondu',      'notion_field_c1_repondu',      'Contact 1 répondu ?',        'Réponse C1 (case à cocher)'],
  ['s-field-c2-repondu',      'notion_field_c2_repondu',      'Contact 2 répondu ?',        'Réponse C2 (case à cocher)'],
];

/* ── template ───────────────────────────────────────────────────── */
function fieldInput([id, , placeholder, label]) {
  return `
    <div class="form-group">
      <label for="${id}">${label}</label>
      <input type="text" id="${id}" placeholder="${placeholder}">
      <span class="helper-text">Nom exact de la propriété dans Notion</span>
    </div>`;
}

function template() {
  const filter = FIELD_MAP.slice(0, 2);
  const name   = FIELD_MAP[2];
  const c1     = FIELD_MAP.slice(3, 10);
  const c2     = FIELD_MAP.slice(10, 17);
  const resp   = FIELD_MAP.slice(17, 19);

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

    <!-- 2. Filtrage -->
    <div class="settings-card">
      <h3 class="settings-card-title">Filtrage</h3>
      <p class="settings-card-desc">Seules les entrées où le champ Statut correspond à la valeur indiquée seront affichées.</p>
      ${filter.map(fieldInput).join('')}
      <div class="settings-actions">
        <button id="save-fields" class="btn btn-primary">Sauvegarder</button>
      </div>
    </div>

    <!-- 3. Mapping -->
    <div class="settings-card">
      <h3 class="settings-card-title">Mapping des propriétés</h3>
      <p class="settings-card-desc">Entre le nom exact de chaque propriété tel qu'il apparaît dans Notion.</p>

      ${fieldInput(name)}

      <div class="settings-subsection-title">Contact 1</div>
      ${c1.map(fieldInput).join('')}

      <div class="settings-subsection-title">Contact 2</div>
      ${c2.map(fieldInput).join('')}

      <div class="settings-subsection-title">Réponses</div>
      ${resp.map(fieldInput).join('')}

      <div class="settings-actions">
        <button id="reset-fields"         class="btn btn-secondary">Réinitialiser</button>
        <button id="save-fields-mapping"  class="btn btn-primary">Sauvegarder</button>
      </div>
    </div>

    <!-- 3. Cache -->
    <div class="settings-card">
      <h3 class="settings-card-title">Cache &amp; Données</h3>
      <p id="cache-info" class="cache-info">Dernière synchronisation : Jamais</p>
      <div class="settings-actions">
        <button id="force-sync"  class="btn btn-secondary">Forcer la resynchronisation</button>
        <button id="clear-cache" class="btn btn-secondary btn-danger">Vider le cache</button>
      </div>
    </div>

    <!-- 4. À propos -->
    <div class="settings-card">
      <h3 class="settings-card-title">À propos</h3>
      <p class="about-text">Prospect Dashboard v3.0.0</p>
      <p class="about-text text-muted">Suivi cold email C1/C2 avec relances J+3 / J+7 / J+14</p>
    </div>`;
}

/* ── form helpers ───────────────────────────────────────────────── */
function loadValues() {
  document.getElementById('s-token').value     = localStorage.getItem('notion_token')     || '';
  document.getElementById('s-db-id').value     = localStorage.getItem('notion_db_id')     || '';
  document.getElementById('s-proxy-url').value = localStorage.getItem('notion_proxy_url') || '';

  FIELD_MAP.forEach(([id, key, placeholder]) => {
    const el = document.getElementById(id);
    if (el) el.value = localStorage.getItem(key) || placeholder;
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
  el.className   = `connection-status${type ? ` ${type}` : ''}`;
  el.textContent = msg;
  if (!type) el.style.display = 'none';
}

/* ── event handlers ─────────────────────────────────────────────── */
async function testConnection() {
  const token = document.getElementById('s-token').value.trim();
  const dbId  = document.getElementById('s-db-id').value.trim();
  const proxy = document.getElementById('s-proxy-url').value.trim();

  if (!token || !dbId) { showStatus('error', '✗ Remplis le token et le Database ID'); return; }

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
    showStatus('success', `✓ Connecté — ${n} entrée${n !== 1 ? 's' : ''} visible${n !== 1 ? 's' : ''}`);
  } catch (e) {
    showStatus('error', `✗ ${e.message}`);
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
  FIELD_MAP.forEach(([id, key, placeholder]) => {
    const v = document.getElementById(id)?.value.trim();
    localStorage.setItem(key, v || placeholder);
  });
  notionCache.studios   = [];
  notionCache.fetchedAt = null;
  showStatus('success', '✓ Mapping sauvegardé — cache réinitialisé');
}

function resetFields() {
  FIELD_MAP.forEach(([id, , placeholder]) => {
    const el = document.getElementById(id);
    if (el) el.value = placeholder;
  });
}

/* ── init events ────────────────────────────────────────────────── */
function initEvents() {
  document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp  = document.getElementById(btn.dataset.target);
      if (!inp) return;
      const show = inp.type === 'password';
      inp.type   = show ? 'text' : 'password';
      const ic   = btn.querySelector('i');
      if (ic) ic.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
      if (window.lucide) lucide.createIcons();
    });
  });

  document.getElementById('save-connection')?.addEventListener('click', saveConnection);
  document.getElementById('test-connection')?.addEventListener('click', testConnection);
  document.getElementById('save-fields')?.addEventListener('click', saveFields);
  document.getElementById('save-fields-mapping')?.addEventListener('click', saveFields);
  document.getElementById('reset-fields')?.addEventListener('click', resetFields);

  document.getElementById('force-sync')?.addEventListener('click', () => window.__appFetchData?.(true));

  document.getElementById('clear-cache')?.addEventListener('click', () => {
    notionCache.studios   = [];
    notionCache.fetchedAt = null;
    updateCacheInfo();
    showStatus('success', '✓ Cache vidé');
  });
}

/**
 * Render the settings view (re-injects HTML each time to reset form state).
 */
export function render() {
  const section = document.getElementById('view-settings');
  if (!section) return;
  section.innerHTML = `<div class="settings-content">${template()}</div>`;
  if (window.lucide) lucide.createIcons();
  loadValues();
  initEvents();
}
