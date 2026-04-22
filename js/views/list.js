/* View: List — filter chips, search, sortable table, pagination, drawer */

window.ViewList = (function () {
  const PAGE_SIZE = 25;

  let allStudios  = [];
  let filtered    = [];
  let page        = 1;
  let sortCol     = 'name';
  let sortDir     = 'asc';
  let activeStats = new Set(); // active status filters
  let searchTerm  = '';

  /* ── status helpers ───────────────────────────────────────────── */

  const KNOWN_STATUSES = ['Trouvé','Email envoyé','Réponse reçue','Positif','Négatif','En attente'];

  function statusClass(s) {
    if (!s) return '';
    return 'status-' + s.toLowerCase().replace(/\s+/g, '-').replace(/é/g,'e').replace(/è/g,'e');
  }

  function statusBadge(s) {
    return `<span class="status-badge ${statusClass(s)}">${s || '—'}</span>`;
  }

  function fmtDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y.slice(2)}`;
  }

  /* ── filter + sort ────────────────────────────────────────────── */

  function applyFilters() {
    const term = searchTerm.toLowerCase();
    filtered = allStudios.filter(s => {
      const matchStatus = activeStats.size === 0 || activeStats.has(s.status || '');
      const matchSearch = !term || (s.name || '').toLowerCase().includes(term);
      return matchStatus && matchSearch;
    });

    filtered.sort((a, b) => {
      let av = a[sortCol] ?? '';
      let bv = b[sortCol] ?? '';
      if (sortCol === 'reponse') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    page = 1;
    renderList();
  }

  /* ── render list body ─────────────────────────────────────────── */

  function renderList() {
    const start = (page - 1) * PAGE_SIZE;
    const slice = filtered.slice(start, start + PAGE_SIZE);

    document.getElementById('studios-count').textContent =
      `${filtered.length} studio${filtered.length !== 1 ? 's' : ''} affiché${filtered.length !== 1 ? 's' : ''}`;

    /* ── table (desktop/tablet landscape) ── */
    const tbody = document.getElementById('list-tbody');
    tbody.innerHTML = slice.map(s => `
      <tr data-id="${s.id}">
        <td><strong>${s.name || '—'}</strong></td>
        <td>${statusBadge(s.status)}</td>
        <td>${fmtDate(s.dateTrouve)}</td>
        <td>${fmtDate(s.dateEnvoi)}</td>
        <td>${s.reponse ? '<span style="color:var(--success)">✓</span>' : '<span style="color:var(--text-faint)">✗</span>'}</td>
        <td class="notes-cell">${(s.notes || '').slice(0, 60)}${s.notes && s.notes.length > 60 ? '…' : ''}</td>
      </tr>`).join('');

    /* ── cards (mobile) ── */
    const cards = document.getElementById('list-cards');
    cards.innerHTML = slice.map(s => `
      <div class="prospect-card" data-id="${s.id}">
        <div class="prospect-card-name">${s.name || '—'}</div>
        <div class="prospect-card-meta">
          ${statusBadge(s.status)}
          ${s.dateEnvoi ? `<span>${fmtDate(s.dateEnvoi)}</span>` : ''}
          ${s.reponse ? '<span style="color:var(--success)">✓ Réponse</span>' : ''}
        </div>
        ${s.notes ? `<div class="notes-cell">${s.notes.slice(0, 60)}${s.notes.length > 60 ? '…' : ''}</div>` : ''}
      </div>`).join('');

    /* empty state */
    document.getElementById('list-empty').classList.toggle('hidden', filtered.length > 0);
    document.querySelector('#list-table-wrap').style.display = filtered.length ? '' : 'none';

    /* pagination */
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    document.getElementById('page-info').textContent = `Page ${page} / ${totalPages}`;
    document.getElementById('prev-page').disabled = page <= 1;
    document.getElementById('next-page').disabled = page >= totalPages;

    /* row click → drawer */
    document.querySelectorAll('#list-tbody tr[data-id], .prospect-card[data-id]').forEach(row => {
      row.addEventListener('click', () => {
        const s = allStudios.find(x => x.id === row.dataset.id);
        if (s) openDrawer(s);
      });
    });

    /* update sort icons */
    document.querySelectorAll('#list-table th.sortable').forEach(th => {
      const icon = th.querySelector('.sort-icon');
      if (th.dataset.col === sortCol) {
        icon.textContent = sortDir === 'asc' ? '↑' : '↓';
        th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        th.classList.remove(sortDir === 'asc' ? 'sort-desc' : 'sort-asc');
      } else {
        icon.textContent = '↕';
        th.classList.remove('sort-asc','sort-desc');
      }
    });
  }

  /* ── chips ────────────────────────────────────────────────────── */

  function buildChips() {
    const statuses = [...new Set([
      ...KNOWN_STATUSES,
      ...allStudios.map(s => s.status || '').filter(Boolean),
    ])];

    const container = document.getElementById('status-chips');
    container.innerHTML = statuses.map(s => `
      <button class="chip ${activeStats.has(s) ? 'active' : ''}" data-status="${s}">${s}</button>
    `).join('');

    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const st = chip.dataset.status;
        if (activeStats.has(st)) activeStats.delete(st);
        else activeStats.add(st);
        chip.classList.toggle('active', activeStats.has(st));
        applyFilters();
      });
    });
  }

  /* ── sort headers ─────────────────────────────────────────────── */

  function initSortHeaders() {
    document.querySelectorAll('#list-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (sortCol === col) {
          sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sortCol = col;
          sortDir = 'asc';
        }
        applyFilters();
      });
    });
  }

  /* ── drawer ───────────────────────────────────────────────────── */

  function openDrawer(s) {
    const drawer  = document.getElementById('drawer');
    const overlay = document.getElementById('drawer-overlay');

    document.getElementById('drawer-title').textContent = s.name || '—';
    document.getElementById('drawer-notion-link').href = `https://notion.so/${s.id}`;

    const fields = [
      ['Statut',       s.status ? statusBadge(s.status) : '<span class="empty">—</span>', true],
      ['Date trouvé',  fmtDate(s.dateTrouve), false],
      ['Date envoi',   fmtDate(s.dateEnvoi), false],
      ['Réponse',      s.reponse ? '<span style="color:var(--success)">✓ Oui</span>' : '<span style="color:var(--text-faint)">✗ Non</span>', true],
      ['Notes',        s.notes || '<span class="empty">Aucune note</span>', true],
    ];

    document.getElementById('drawer-content').innerHTML = fields.map(([label, val, raw]) => `
      <div class="drawer-field">
        <div class="drawer-field-label">${label}</div>
        <div class="drawer-field-value">${raw ? val : (val || '<span class="empty">—</span>')}</div>
      </div>`).join('');

    drawer.classList.remove('hidden');
    overlay.classList.remove('hidden');

    /* trap focus */
    document.getElementById('drawer-close').focus();
  }

  function closeDrawer() {
    document.getElementById('drawer').classList.add('hidden');
    document.getElementById('drawer-overlay').classList.add('hidden');
  }

  function initDrawer() {
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    document.getElementById('drawer-close-btn').addEventListener('click', closeDrawer);
    document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);

    /* swipe to dismiss */
    const drawer = document.getElementById('drawer');
    let tx = 0, ty = 0;
    drawer.addEventListener('touchstart', e => {
      tx = e.touches[0].clientX;
      ty = e.touches[0].clientY;
    }, { passive: true });
    drawer.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (window.innerWidth >= 768 && dx > 80 && Math.abs(dy) < 60) closeDrawer();
      if (window.innerWidth < 768  && dy > 80 && Math.abs(dx) < 60) closeDrawer();
    }, { passive: true });

    /* close on Escape */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  /* ── pagination buttons ───────────────────────────────────────── */

  function initPagination() {
    document.getElementById('prev-page').addEventListener('click', () => {
      if (page > 1) { page--; renderList(); }
    });
    document.getElementById('next-page').addEventListener('click', () => {
      const total = Math.ceil(filtered.length / PAGE_SIZE);
      if (page < total) { page++; renderList(); }
    });
  }

  /* ── search ───────────────────────────────────────────────────── */

  function initSearch() {
    const input = document.getElementById('search-input');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        searchTerm = input.value.trim();
        applyFilters();
      }, 180);
    });
  }

  /* ── public render ────────────────────────────────────────────── */

  let initialized = false;

  function render(studios) {
    allStudios = studios || [];
    filtered   = [...allStudios];

    if (!initialized) {
      initSortHeaders();
      initDrawer();
      initPagination();
      initSearch();
      initialized = true;
    }

    buildChips();
    applyFilters();
  }

  return { render };
})();
