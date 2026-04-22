/**
 * View: Relances — overdue follow-ups and upcoming planned sends.
 */

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="chart-card" style="margin-bottom:24px">
      <span class="sk" style="width:40%;height:14px;margin-bottom:20px;display:block"></span>
      ${Array(4).fill(0).map(() => `
        <div style="display:flex;gap:16px;margin-bottom:12px">
          <span class="sk" style="flex:3;height:14px"></span>
          <span class="sk" style="flex:2;height:14px"></span>
          <span class="sk" style="width:80px;height:14px"></span>
        </div>`).join('')}
    </div>
    <div class="chart-card">
      <span class="sk" style="width:50%;height:14px;margin-bottom:20px;display:block"></span>
      ${Array(5).fill(0).map(() => `
        <div style="display:flex;gap:16px;margin-bottom:12px">
          <span class="sk" style="flex:3;height:14px"></span>
          <span class="sk" style="flex:2;height:14px"></span>
          <span class="sk" style="width:80px;height:14px"></span>
        </div>`).join('')}
    </div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().split('T')[0]; }

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDate(d) {
  if (!d) return '—';
  const [y, mo, day] = d.split('-');
  return `${day}/${mo}/${y.slice(2)}`;
}

function daysDiff(from, to) {
  return Math.round((new Date(to) - new Date(from)) / 86400000);
}

/** Returns all planned-but-not-sent actions for a studio. */
function pendingActions(s) {
  return [
    { label: 'Relance C1 J+3',  prev: s.relPrevC1J3,  eff: s.relEffC1J3 },
    { label: 'Relance C1 J+7',  prev: s.relPrevC1J7,  eff: s.relEffC1J7 },
    { label: 'Relance C1 J+14', prev: s.relPrevC1J14, eff: s.relEffC1J14 },
    { label: 'Relance C2 J+3',  prev: s.relPrevC2J3,  eff: s.relEffC2J3 },
    { label: 'Relance C2 J+7',  prev: s.relPrevC2J7,  eff: s.relEffC2J7 },
    { label: 'Relance C2 J+14', prev: s.relPrevC2J14, eff: s.relEffC2J14 },
  ]
    .filter(a => a.prev && !a.eff)
    .map(a => ({ label: a.label, date: a.prev, studio: s.name, id: s.id }));
}

function actionRow(a, today) {
  const late = a.date < today;
  const diff = daysDiff(late ? a.date : today, late ? today : a.date);
  const badge = late
    ? `<span class="relance-badge relance-badge--late">${diff}j de retard</span>`
    : diff === 0
      ? `<span class="relance-badge relance-badge--today">Aujourd'hui</span>`
      : `<span class="relance-badge relance-badge--soon">Dans ${diff}j</span>`;
  return `<tr>
    <td><strong>${a.studio || '—'}</strong></td>
    <td>${a.label}</td>
    <td>${fmtDate(a.date)}</td>
    <td>${badge}</td>
  </tr>`;
}

function actionsTable(actions, today) {
  if (!actions.length) return '<p class="relances-empty">Aucune relance dans cette catégorie.</p>';
  return `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>
          <th>Studio</th><th>Action</th><th>Date prévue</th><th>Statut</th>
        </tr></thead>
        <tbody>${actions.map(a => actionRow(a, today)).join('')}</tbody>
      </table>
    </div>`;
}

/**
 * Render the relances view.
 * @param {import('../notion.js').Studio[]|null} studios
 */
export function render(studios) {
  const section = document.getElementById('view-funnel');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📬</div>
        <h3>Aucun studio</h3>
        <p>Ajoute des studios dans Notion et planifie tes relances.</p>
      </div>`;
    return;
  }

  const today   = todayStr();
  const in14    = addDays(today, 14);

  const all      = studios.flatMap(pendingActions);
  const overdue  = all.filter(a => a.date < today).sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = all.filter(a => a.date >= today && a.date <= in14).sort((a, b) => a.date.localeCompare(b.date));
  const later    = all.filter(a => a.date > in14).sort((a, b) => a.date.localeCompare(b.date));

  section.innerHTML = `
    <div class="relances-section ${overdue.length ? 'relances-section--danger' : ''}">
      <div class="relances-section-header">
        <span class="relances-section-icon">${overdue.length ? '🔴' : '✅'}</span>
        <h3>En retard <span class="relances-count">${overdue.length}</span></h3>
      </div>
      ${actionsTable(overdue, today)}
    </div>

    <div class="relances-section">
      <div class="relances-section-header">
        <span class="relances-section-icon">🟡</span>
        <h3>Dans les 14 prochains jours <span class="relances-count">${upcoming.length}</span></h3>
      </div>
      ${actionsTable(upcoming, today)}
    </div>

    ${later.length ? `
    <div class="relances-section">
      <div class="relances-section-header">
        <span class="relances-section-icon">🔵</span>
        <h3>Plus tard <span class="relances-count">${later.length}</span></h3>
      </div>
      ${actionsTable(later, today)}
    </div>` : ''}`;
}
