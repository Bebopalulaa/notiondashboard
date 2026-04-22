/* View: Settings — connection, field mapping, cache, about */

window.ViewSettings = (function () {

  const FIELD_DEFAULTS = {
    's-field-name':        ['notion_field_name',        'Name'],
    's-field-status':      ['notion_field_status',       'Status'],
    's-field-date-trouve': ['notion_field_date_trouve',  'Date trouvé'],
    's-field-date-envoi':  ['notion_field_date_envoi',   'Date envoi'],
    's-field-reponse':     ['notion_field_reponse',      'Réponse'],
    's-field-notes':       ['notion_field_notes',        'Notes'],
  };

  /* load current values into form fields */
  function loadFields() {
    document.getElementById('s-token').value     = localStorage.getItem('notion_token')     || '';
    document.getElementById('s-db-id').value     = localStorage.getItem('notion_db_id')     || '';
    document.getElementById('s-proxy-url').value = localStorage.getItem('notion_proxy_url') || '';

    Object.entries(FIELD_DEFAULTS).forEach(([id, [key, def]]) => {
      const el = document.getElementById(id);
      if (el) el.value = localStorage.getItem(key) || def;
    });

    updateCacheInfo();
  }

  function updateCacheInfo() {
    const cache = window._notionCache;
    const el = document.getElementById('cache-info');
    if (!el) return;
    if (cache && cache.fetchedAt) {
      const d = new Date(cache.fetchedAt);
      el.textContent = `Dernière synchronisation : ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      el.textContent = 'Dernière synchronisation : Jamais';
    }
  }

  /* ── connection save & test ───────────────────────────────────── */

  function saveConnection() {
    localStorage.setItem('notion_token',     document.getElementById('s-token').value.trim());
    localStorage.setItem('notion_db_id',     document.getElementById('s-db-id').value.trim());
    localStorage.setItem('notion_proxy_url', document.getElementById('s-proxy-url').value.trim());
    showStatus('success', '✓ Paramètres de connexion sauvegardés');
  }

  async function testConnection() {
    const btn = document.getElementById('test-connection');
    const statusEl = document.getElementById('connection-status');

    /* Temporarily apply form values without saving permanently */
    const token  = document.getElementById('s-token').value.trim();
    const dbId   = document.getElementById('s-db-id').value.trim();
    const proxy  = document.getElementById('s-proxy-url').value.trim();

    if (!token || !dbId) {
      showStatus('error', '✗ Remplis le token et le Database ID avant de tester');
      return;
    }

    /* Temporarily store to allow notionFetch to work */
    const prevToken = localStorage.getItem('notion_token');
    const prevDb    = localStorage.getItem('notion_db_id');
    const prevProxy = localStorage.getItem('notion_proxy_url');
    localStorage.setItem('notion_token',     token);
    localStorage.setItem('notion_db_id',     dbId);
    localStorage.setItem('notion_proxy_url', proxy);

    btn.disabled = true;
    btn.textContent = 'Test en cours…';
    showStatus('', '');

    try {
      const data = await window.NotionAPI.notionFetch(`/databases/${dbId}/query`, {
        method: 'POST',
        body: JSON.stringify({ page_size: 1 }),
      });
      const count = data.results ? data.results.length : 0;
      showStatus('success', `✓ Connecté — base accessible (${count} entrée${count !== 1 ? 's' : ''} testée${count !== 1 ? 's' : ''})`);
    } catch (e) {
      showStatus('error', `✗ ${e.message}`);
      /* restore previous values on failure */
      if (prevToken !== null) localStorage.setItem('notion_token', prevToken);
      if (prevDb    !== null) localStorage.setItem('notion_db_id', prevDb);
      if (prevProxy !== null) localStorage.setItem('notion_proxy_url', prevProxy);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Tester la connexion';
    }
  }

  function showStatus(type, msg) {
    const el = document.getElementById('connection-status');
    if (!el) return;
    el.className = 'connection-status' + (type ? ` ${type}` : '');
    el.textContent = msg;
    if (!type) el.style.display = 'none';
  }

  /* ── field mapping ────────────────────────────────────────────── */

  function saveFields() {
    Object.entries(FIELD_DEFAULTS).forEach(([id, [key]]) => {
      const el = document.getElementById(id);
      if (el) localStorage.setItem(key, el.value.trim() || FIELD_DEFAULTS[id][1]);
    });
    /* invalidate cache so next fetch uses new field names */
    window._notionCache = { studios: [], fetchedAt: null };
    showFieldMsg('✓ Mapping sauvegardé — le cache a été réinitialisé');
  }

  function resetFields() {
    Object.entries(FIELD_DEFAULTS).forEach(([id, [key, def]]) => {
      const el = document.getElementById(id);
      if (el) el.value = def;
    });
    showFieldMsg('Valeurs par défaut restaurées — clique sur Sauvegarder pour appliquer');
  }

  function showFieldMsg(msg) {
    /* reuse connection-status but scoped to field card */
    alert(msg); /* simple for now */
  }

  /* ── event wiring ─────────────────────────────────────────────── */

  let initialized = false;

  function initEvents() {
    if (initialized) return;
    initialized = true;

    /* password toggle */
    document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const isHidden = target.type === 'password';
        target.type = isHidden ? 'text' : 'password';
        const icon = btn.querySelector('i');
        if (icon) icon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
        if (window.lucide) lucide.createIcons();
      });
    });

    document.getElementById('save-connection').addEventListener('click', saveConnection);
    document.getElementById('test-connection').addEventListener('click', testConnection);
    document.getElementById('save-fields').addEventListener('click', saveFields);
    document.getElementById('reset-fields').addEventListener('click', resetFields);

    document.getElementById('force-sync').addEventListener('click', () => {
      if (window.App) window.App.fetchData(true);
    });

    document.getElementById('clear-cache').addEventListener('click', () => {
      window._notionCache = { studios: [], fetchedAt: null };
      updateCacheInfo();
      alert('Cache vidé.');
    });
  }

  function render() {
    initEvents();
    loadFields();
  }

  return { render, updateCacheInfo };
})();
