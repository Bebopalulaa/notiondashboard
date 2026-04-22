/**
 * View: List — filter chips, live search, sortable table, 25/page pagination,
 * detail drawer with swipe-to-dismiss.
 */

const PAGE_SIZE = 25;

const KNOWN_STATUSES = ['Trouvé','Email envoyé','Réponse reçue','Positif','Négatif','En attente'];

/* ── state ──────────────────────────────────────────────────────── */
let _studios    = [];
let _filtered   = [];
let _page       = 1;
let _sortCol    = 'name';
let _sortDir    = 'asc';
let _activeStats = new Set();
let _search     = '';
let _drawerInited = false;

/* ── helpers ────────────────────────────────────────────────────── */
function statusCls(s) {
  if (!s) return '';
  return 'status-' + s.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[éè]/g, 'e');
}

/** @param {string} s */
function badge(s) {
  return `<span class="status-badge ${statusCls(s)}">${s || '—'}</span>`;
}

/** @param {string|null} d */
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="list-filters">
      <div class="chips-row">
        ${Array(6).fill(0).map(() => `<span class="sk" style="width:${70 + Math.random()*40}px;height:32px;border-radius:20px;display:inline-block"></span>`).join('')}
      </div>
      <div class="search-row">
        <span class="sk" style="flex:1;max-width:360px;height:40px;border-radius:6px;display:block"></span>
      </div>
    </div>
    <div class="table-card">
      ${Array(8).fill(0).map(() => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:center">
          <span class="sk" style="flex:2;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:90px;height:20px;border-radius:20px"></span>
          <span class="sk" style="width:60px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:60px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:24px;height:14px;border-radius:4px"></span>
          <span class="sk" style="flex:3;height:14px;border-radius:4px"></span>
        </div>`).join('')}
    </div>`;
}

/* ── filters ────────────────────────────────────────────────────── */
function applyFilters() {
  const term = _search.toLowerCase();
  _filtered = _studios.filter(s => {
    const ms = _activeStats.size === 0 || _activeStats.has(s.status || '');
    const mn = !term || (s.name || '').toLowerCase().includes(term);
    return ms && mn;
  });

  _filtered.sort((a, b) => {
    let av = a[_sortCol] ?? '';
    let bv = b[_sortCol] ?? '';
    if (_sortCol === 'reponse') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return _sortDir === 'asc' ? c : -c;
  });

  _page = 1;
  renderList();
}

/* ── list render ────────────────────────────────────────────────── */
function renderList() {
  const start = (_page - 1) * PAGE_SIZE;
  const slice = _filtered.slice(start, start + PAGE_SIZE);

  /* count */
  const countEl = document.getElementById('studios-count');
  if (countEl) countEl.textContent = `${_filtered.length} studio${_filtered.length !== 1 ? 's' : ''} affiché${_filtered.length !== 1 ? 's' : ''}`;

  /* empty state */
  const empty  = document.getElementById('list-empty');
  const wrap   = document.getElementById('list-table-wrap');
  const cardEl = document.getElementById('list-cards');
  if (empty)  empty.classList.toggle('hidden', _filtered.length > 0);
  if (wrap)   wrap.style.display  = _filtered.length ? '' : 'none';
  if (cardEl) cardEl.style.display = _filtered.length ? '' : 'none';

  /* table rows */
  const tbody = document.getElementById('list-tbody');
  if (tbody) {
    tbody.innerHTML = slice.map(s => `
      <tr data-id="${s.id}">
        <td><strong>${s.name || '—'}</strong></td>
        <td>${badge(s.status)}</td>
        <td>${fmtDate(s.dateTrouve)}</td>
        <td>${fmtDate(s.dateEnvoi)}</td>
        <td>${s.reponse
          ? '<span style="color:var(--success)">✓</span>'
          : '<span style="color:var(--text-faint)">✗</span>'}</td>
        <td class="notes-cell">${(s.notes || '').slice(0, 60)}${s.notes && s.notes.length > 60 ? '…' : ''}</td>
      </tr>`).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const s = _studios.find(x => x.id === row.dataset.id);
        if (s) openDrawer(s);
      });
    });
  }

  /* mobile cards */
  if (cardEl) {
    cardEl.innerHTML = slice.map(s => `
      <div class="prospect-card" data-id="${s.id}">
        <div class="prospect-card-name">${s.name || '—'}</div>
        <div class="prospect-card-meta">
          ${badge(s.status)}
          ${s.dateEnvoi ? `<span>${fmtDate(s.dateEnvoi)}</span>` : ''}
          ${s.reponse ? '<span style="color:var(--success)">✓ Réponse</span>' : ''}
        </div>
        ${s.notes ? `<div class="notes-cell">${s.notes.slice(0, 60)}${s.notes.length > 60 ? '…' : ''}</div>` : ''}
      </div>`).join('');

    cardEl.querySelectorAll('.prospect-card[data-id]').forEach(card => {
      card.addEventListener('click', () => {
        const s = _studios.find(x => x.id === card.dataset.id);
        if (s) openDrawer(s);
      });
    });
  }

  /* sort icons */
  document.querySelectorAll('#list-table th.sortable').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    if (th.dataset.col === _sortCol) {
      icon.textContent = _sortDir === 'asc' ? '↑' : '↓';
      th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      th.classList.remove(_sortDir === 'asc' ? 'sort-desc' : 'sort-asc');
    } else {
      icon.textContent = '↕';
      th.classList.remove('sort-asc', 'sort-desc');
    }
  });

  /* pagination */
  const total = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
  const info  = document.getElementById('page-info');
  const prev  = document.getElementById('prev-page');
  const next  = document.getElementById('next-page');
  if (info) info.textContent  = `Page ${_page} / ${total}`;
  if (prev) prev.disabled = _page <= 1;
  if (next) next.disabled = _page >= total;
}

/* ── chips ──────────────────────────────────────────────────────── */
function buildChips() {
  const all = [...new Set([...KNOWN_STATUSES, ..._studios.map(s => s.status || '').filter(Boolean)])];
  const container = document.getElementById('status-chips');
  if (!container) return;
  container.innerHTML = all.map(s => `
    <button class="chip${_activeStats.has(s) ? ' active' : ''}" data-status="${s}">${s}</button>`).join('');
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const st = chip.dataset.status;
      _activeStats.has(st) ? _activeStats.delete(st) : _activeStats.add(st);
      chip.classList.toggle('active', _activeStats.has(st));
      applyFilters();
    });
  });
}

/* ── drawer ─────────────────────────────────────────────────────── */
function openDrawer(s) {
  document.getElementById('drawer-title').textContent = s.name || '—';
  document.getElementById('drawer-notion-link').href = `https://notion.so/${s.id}`;

  document.getElementById('drawer-content').innerHTML = [
    ['Statut',      badge(s.status), true],
    ['Date trouvé', fmtDate(s.dateTrouve), false],
    ['Date envoi',  fmtDate(s.dateEnvoi), false],
    ['Réponse',     s.reponse ? '<span style="color:var(--success)">✓ Oui</span>' : '<span style="color:var(--text-faint)">✗ Non</span>', true],
    ['Notes',       s.notes ? s.notes : '<span class="empty">Aucune note</span>', true],
  ].map(([label, val, raw]) => `
    <div class="drawer-field">
      <div class="drawer-field-label">${label}</div>
      <div class="drawer-field-value">${raw ? val : (val || '—')}</div>
    </div>`).join('');

  document.getElementById('drawer').classList.remove('hidden');
  document.getElementById('drawer-overlay').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
  document.getElementById('drawer-close').focus();
}

function closeDrawer() {
  document.getElementById('drawer').classList.add('hidden');
  document.getElementById('drawer-overlay').classList.add('hidden');
}

function initDrawer() {
  if (_drawerInited) return;
  _drawerInited = true;

  ['drawer-close','drawer-close-btn'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', closeDrawer));
  document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

  /* swipe to dismiss */
  const drawer = document.getElementById('drawer');
  let tx = 0, ty = 0;
  drawer.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  drawer.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (window.innerWidth >= 768 && dx > 80 && Math.abs(dy) < 60) closeDrawer();
    if (window.innerWidth  < 768 && dy > 80 && Math.abs(dx) < 60) closeDrawer();
  }, { passive: true });
}

/* ── full view scaffold (only injected once) ────────────────────── */
function injectScaffold() {
  const section = document.getElementById('view-list');
  section.innerHTML = `
    <div class="list-filters" id="list-filters">
      <div id="status-chips" class="chips-row"></div>
      <div class="search-row">
        <div class="search-input-wrap">
          <i data-lucide="search"></i>
          <input type="text" id="search-input" placeholder="Rechercher un studio…" autocomplete="off">
        </div>
        <span id="studios-count" class="count-badge">0 studios</span>
      </div>
    </div>
    <div class="table-card">
      <div class="table-scroll" id="list-table-wrap">
        <table class="data-table sortable-table" id="list-table">
          <thead>
            <tr>
              <th class="sortable" data-col="name">Nom <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="status">Statut <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="dateTrouve">Date trouvé <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="dateEnvoi">Date envoi <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="reponse">Réponse <span class="sort-icon">↕</span></th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody id="list-tbody"></tbody>
        </table>
      </div>
      <div id="list-cards" class="list-cards"></div>
      <div id="list-empty" class="empty-state hidden">
        <div class="empty-state-icon">🔍</div>
        <h3>Aucun résultat</h3>
        <p>Aucun studio ne correspond à tes filtres.</p>
      </div>
    </div>
    <nav class="pagination" id="list-pagination">
      <button id="prev-page" class="btn btn-secondary" disabled>← Précédent</button>
      <span id="page-info">Page 1 / 1</span>
      <button id="next-page" class="btn btn-secondary" disabled>Suivant →</button>
    </nav>`;

  if (window.lucide) lucide.createIcons();

  /* sort headers */
  document.querySelectorAll('#list-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      _sortDir = th.dataset.col === _sortCol ? (_sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      _sortCol = th.dataset.col;
      applyFilters();
    });
  });

  /* pagination */
  document.getElementById('prev-page').addEventListener('click', () => { if (_page > 1) { _page--; renderList(); } });
  document.getElementById('next-page').addEventListener('click', () => {
    if (_page < Math.ceil(_filtered.length / PAGE_SIZE)) { _page++; renderList(); }
  });

  /* search */
  let timer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { _search = e.target.value.trim(); applyFilters(); }, 180);
  });
}

let _scaffoldInjected = false;

/**
 * Render the list view.
 * @param {import('../notion.js').Studio[]|null} studios - null triggers skeleton
 */
export function render(studios) {
  const section = document.getElementById('view-list');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); _scaffoldInjected = false; return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>Aucun studio trouvé</h3>
        <p>Ajoute des entrées dans Notion puis actualise le dashboard.</p>
        <button class="btn btn-primary" onclick="document.getElementById('refresh-btn').click()">Actualiser</button>
      </div>`;
    _scaffoldInjected = false;
    return;
  }

  /* Inject scaffold once; on subsequent renders just update data */
  if (!_scaffoldInjected) {
    injectScaffold();
    initDrawer();
    _scaffoldInjected = true;
  }

  _studios = studios;
  _filtered = [...studios];
  buildChips();
  applyFilters();
}
