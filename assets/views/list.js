/**
 * View: List — searchable sortable table with C1/C2 follow-up dots, detail drawer.
 */

const PAGE_SIZE = 25;

/* ── state ──────────────────────────────────────────────────────── */
let _studios          = [];
let _filtered         = [];
let _page             = 1;
let _sortCol          = 'name';
let _sortDir          = 'asc';
let _search           = '';
let _drawerInited     = false;
let _scaffoldInjected = false;

/* ── helpers ────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y.slice(2)}`;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

/** Colored dot: green=sent, orange=planned, red=late, grey=none */
function dot(prev, eff) {
  if (eff)  return `<span class="rdot rdot--done" title="Envoyé le ${fmtDate(eff)}">●</span>`;
  if (!prev) return `<span class="rdot rdot--none" title="Non planifié">○</span>`;
  return prev < todayStr()
    ? `<span class="rdot rdot--late" title="Retard — prévu le ${fmtDate(prev)}">●</span>`
    : `<span class="rdot rdot--planned" title="Prévu le ${fmtDate(prev)}">●</span>`;
}

function dotsC(s, n) {
  const c = `C${n}`;
  return [
    dot(s[`relPrev${c}J3`],  s[`relEff${c}J3`]),
    dot(s[`relPrev${c}J7`],  s[`relEff${c}J7`]),
    dot(s[`relPrev${c}J14`], s[`relEff${c}J14`]),
  ].join('');
}

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="list-filters">
      <div class="search-row">
        <span class="sk" style="flex:1;max-width:360px;height:40px;border-radius:6px;display:block"></span>
      </div>
    </div>
    <div class="table-card">
      ${Array(8).fill(0).map(() => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:center">
          <span class="sk" style="flex:3;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:70px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:60px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:70px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:60px;height:14px;border-radius:4px"></span>
          <span class="sk" style="width:30px;height:14px;border-radius:4px"></span>
        </div>`).join('')}
    </div>`;
}

/* ── filters ────────────────────────────────────────────────────── */
function applyFilters() {
  const term = _search.toLowerCase();
  _filtered  = _studios.filter(s => !term || (s.name || '').toLowerCase().includes(term));

  _filtered.sort((a, b) => {
    let av = a[_sortCol] ?? '';
    let bv = b[_sortCol] ?? '';
    if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
    const c = av < bv ? -1 : av > bv ? 1 : 0;
    return _sortDir === 'asc' ? c : -c;
  });

  _page = 1;
  renderList();
}

/* ── list render ────────────────────────────────────────────────── */
function renderList() {
  const start  = (_page - 1) * PAGE_SIZE;
  const slice  = _filtered.slice(start, start + PAGE_SIZE);

  const countEl = document.getElementById('studios-count');
  if (countEl) countEl.textContent = `${_filtered.length} studio${_filtered.length !== 1 ? 's' : ''}`;

  const empty  = document.getElementById('list-empty');
  const wrap   = document.getElementById('list-table-wrap');
  const cardEl = document.getElementById('list-cards');
  if (empty)  empty.classList.toggle('hidden', _filtered.length > 0);
  if (wrap)   wrap.style.display   = _filtered.length ? '' : 'none';
  if (cardEl) cardEl.style.display = _filtered.length ? '' : 'none';

  const tbody = document.getElementById('list-tbody');
  if (tbody) {
    tbody.innerHTML = slice.map(s => `
      <tr data-id="${s.id}" style="cursor:pointer">
        <td><strong>${s.name || '—'}</strong></td>
        <td>${fmtDate(s.dateEnvoiC1)}</td>
        <td class="dots-cell">${dotsC(s, 1)}</td>
        <td>${fmtDate(s.dateEnvoiC2)}</td>
        <td class="dots-cell">${dotsC(s, 2)}</td>
        <td>${s.c1Repondu
          ? '<span style="color:var(--success)">✓</span>'
          : '<span style="color:var(--text-faint)">✗</span>'}</td>
      </tr>`).join('');

    tbody.querySelectorAll('tr[data-id]').forEach(row =>
      row.addEventListener('click', () => {
        const s = _studios.find(x => x.id === row.dataset.id);
        if (s) openDrawer(s);
      })
    );
  }

  if (cardEl) {
    cardEl.innerHTML = slice.map(s => `
      <div class="prospect-card" data-id="${s.id}">
        <div class="prospect-card-name">${s.name || '—'}</div>
        <div class="prospect-card-meta">
          ${s.dateEnvoiC1 ? `<span>C1 ${fmtDate(s.dateEnvoiC1)}</span>` : ''}
          ${s.dateEnvoiC2 ? `<span>C2 ${fmtDate(s.dateEnvoiC2)}</span>` : ''}
          ${s.c1Repondu ? '<span style="color:var(--success)">✓ Réponse</span>' : ''}
        </div>
        <div class="prospect-card-dots">C1: ${dotsC(s, 1)} &nbsp; C2: ${dotsC(s, 2)}</div>
      </div>`).join('');

    cardEl.querySelectorAll('.prospect-card[data-id]').forEach(card =>
      card.addEventListener('click', () => {
        const s = _studios.find(x => x.id === card.dataset.id);
        if (s) openDrawer(s);
      })
    );
  }

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

  const total = Math.max(1, Math.ceil(_filtered.length / PAGE_SIZE));
  const info  = document.getElementById('page-info');
  const prev  = document.getElementById('prev-page');
  const next  = document.getElementById('next-page');
  if (info) info.textContent = `Page ${_page} / ${total}`;
  if (prev) prev.disabled = _page <= 1;
  if (next) next.disabled = _page >= total;
}

/* ── drawer ─────────────────────────────────────────────────────── */
function drawerRow(label, val) {
  return `<div class="drawer-field">
    <div class="drawer-field-label">${label}</div>
    <div class="drawer-field-value">${val || '—'}</div>
  </div>`;
}

function drawerRelance(label, prev, eff) {
  const today = todayStr();
  const val = eff
    ? `<span style="color:var(--success)">✓ Envoyé le ${fmtDate(eff)}</span>`
    : prev
      ? (prev < today
          ? `<span style="color:var(--danger)">⚠ Retard — prévu le ${fmtDate(prev)}</span>`
          : `Prévu le ${fmtDate(prev)}`)
      : '<span style="color:var(--text-faint)">Non planifié</span>';
  return drawerRow(label, val);
}

function openDrawer(s) {
  document.getElementById('drawer-title').textContent = s.name || '—';
  document.getElementById('drawer-notion-link').href = `https://notion.so/${s.id}`;

  document.getElementById('drawer-content').innerHTML = `
    <div class="drawer-section-title">Contact 1</div>
    ${drawerRow('Envoi J+0', fmtDate(s.dateEnvoiC1))}
    ${drawerRelance('Relance J+3',  s.relPrevC1J3,  s.relEffC1J3)}
    ${drawerRelance('Relance J+7',  s.relPrevC1J7,  s.relEffC1J7)}
    ${drawerRelance('Relance J+14', s.relPrevC1J14, s.relEffC1J14)}
    ${drawerRow('Répondu ?', s.c1Repondu
      ? '<span style="color:var(--success)">✓ Oui</span>'
      : '<span style="color:var(--text-faint)">✗ Non</span>')}
    <div class="drawer-section-title" style="margin-top:16px">Contact 2</div>
    ${drawerRow('Envoi J+0', fmtDate(s.dateEnvoiC2))}
    ${drawerRelance('Relance J+3',  s.relPrevC2J3,  s.relEffC2J3)}
    ${drawerRelance('Relance J+7',  s.relPrevC2J7,  s.relEffC2J7)}
    ${drawerRelance('Relance J+14', s.relPrevC2J14, s.relEffC2J14)}`;

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
  ['drawer-close', 'drawer-close-btn'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', closeDrawer));
  document.getElementById('drawer-overlay')?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => e.key === 'Escape' && closeDrawer());

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

/* ── scaffold (injected once) ───────────────────────────────────── */
function injectScaffold() {
  const section = document.getElementById('view-list');
  section.innerHTML = `
    <div class="list-filters" id="list-filters">
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
              <th class="sortable" data-col="name">Studio <span class="sort-icon">↕</span></th>
              <th class="sortable" data-col="dateEnvoiC1">C1 Envoi <span class="sort-icon">↕</span></th>
              <th title="J+3 / J+7 / J+14">C1 Relances</th>
              <th class="sortable" data-col="dateEnvoiC2">C2 Envoi <span class="sort-icon">↕</span></th>
              <th title="J+3 / J+7 / J+14">C2 Relances</th>
              <th class="sortable" data-col="c1Repondu">Réponse <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody id="list-tbody"></tbody>
        </table>
      </div>
      <div id="list-cards" class="list-cards" style="display:none"></div>
      <div id="list-empty" class="empty-state hidden">
        <div class="empty-state-icon">🔍</div>
        <h3>Aucun résultat</h3>
        <p>Aucun studio ne correspond à ta recherche.</p>
      </div>
    </div>
    <nav class="pagination" id="list-pagination">
      <button id="prev-page" class="btn btn-secondary" disabled>← Précédent</button>
      <span id="page-info">Page 1 / 1</span>
      <button id="next-page" class="btn btn-secondary" disabled>Suivant →</button>
    </nav>`;

  if (window.lucide) lucide.createIcons();

  document.querySelectorAll('#list-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      _sortDir = th.dataset.col === _sortCol ? (_sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
      _sortCol = th.dataset.col;
      applyFilters();
    });
  });

  document.getElementById('prev-page').addEventListener('click', () => { if (_page > 1) { _page--; renderList(); } });
  document.getElementById('next-page').addEventListener('click', () => {
    if (_page < Math.ceil(_filtered.length / PAGE_SIZE)) { _page++; renderList(); }
  });

  let timer;
  document.getElementById('search-input').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => { _search = e.target.value.trim(); applyFilters(); }, 180);
  });
}

/**
 * Render the list view.
 * @param {import('../notion.js').Studio[]|null} studios
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

  if (!_scaffoldInjected) {
    injectScaffold();
    initDrawer();
    _scaffoldInjected = true;
  }

  _studios  = studios;
  _filtered = [...studios];
  applyFilters();
}
