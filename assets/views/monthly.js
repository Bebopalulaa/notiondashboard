/**
 * View: Monthly activity — year selector, bar charts, summary table.
 */

import { initChart, PALETTE, tooltipConfig, scalesConfig } from '../charts.js';

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="section-header">
      <span class="sk" style="width:120px;height:40px;border-radius:6px;display:block"></span>
    </div>
    <div class="charts-row">
      ${Array(2).fill(0).map(() => `
        <div class="chart-card">
          <span class="sk" style="width:50%;height:12px;margin-bottom:18px;display:block"></span>
          <span class="sk" style="height:240px;border-radius:10px;display:block"></span>
        </div>`).join('')}
    </div>
    <div class="table-card">
      <div class="table-card-header" style="border-bottom:1px solid var(--border);padding:14px 20px">
        <span class="sk" style="width:35%;height:12px;display:inline-block"></span>
      </div>
      ${Array(6).fill(0).map(() => `
        <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;gap:16px">
          ${Array(5).fill(0).map((_, i) => `<span class="sk" style="height:14px;flex:${i===0?2:1}"></span>`).join('')}
        </div>`).join('')}
    </div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
/**
 * Extract unique years from studio data.
 * @param {import('../notion.js').Studio[]} studios
 * @returns {string[]} Sorted descending
 */
function extractYears(studios) {
  const ys = new Set();
  studios.forEach(s => {
    if (s.dateTrouve) ys.add(s.dateTrouve.slice(0, 4));
    if (s.dateEnvoi)  ys.add(s.dateEnvoi.slice(0, 4));
  });
  return [...ys].sort((a, b) => b - a);
}

function buildBarConfig(label, data, color) {
  const sc = scalesConfig();
  return {
    type: 'bar',
    data: {
      labels: MONTHS_SHORT,
      datasets: [{
        label,
        data,
        backgroundColor: color + 'b3',
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tooltipConfig() },
      scales: sc,
    },
  };
}

function renderCharts(studios, year) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
    return {
      found: studios.filter(s => s.dateTrouve?.startsWith(ym)).length,
      sent:  studios.filter(s => s.dateEnvoi?.startsWith(ym)).length,
      resp:  studios.filter(s => s.reponse && s.dateEnvoi?.startsWith(ym)).length,
    };
  });

  initChart('chart-found', buildBarConfig('Studios trouvés', months.map(m => m.found), PALETTE[0]));
  initChart('chart-sent-m', buildBarConfig('Emails envoyés',  months.map(m => m.sent),  PALETTE[1]));

  /* Table */
  const tbody = document.getElementById('monthly-tbody');
  if (!tbody) return;

  const rows = months
    .map((d, i) => ({ ...d, i }))
    .filter(d => d.found || d.sent || d.resp)
    .reverse();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state" style="padding:32px;text-align:center;color:var(--text-muted)">Aucune donnée pour ${year}</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(d => {
    const rate = d.sent ? Math.round(d.resp / d.sent * 100) : 0;
    return `<tr>
      <td>${MONTHS_LONG[d.i]} ${year}</td>
      <td class="num">${d.found}</td>
      <td class="num">${d.sent}</td>
      <td class="num">${d.resp}</td>
      <td class="num">${d.sent ? rate + '%' : '—'}</td>
    </tr>`;
  }).join('');
}

/**
 * Render the monthly activity view.
 * @param {import('../notion.js').Studio[]|null} studios - null triggers skeleton
 */
export function render(studios) {
  const section = document.getElementById('view-monthly');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  const years = extractYears(studios);

  if (!studios.length || !years.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Aucune activité mensuelle</h3>
        <p>Les données apparaîtront dès que des studios auront des dates enregistrées.</p>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="section-header">
      <select id="year-select" class="select-input">
        ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
      </select>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">Studios trouvés par mois</div>
        <div class="chart-wrapper"><canvas id="chart-found"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Emails envoyés par mois</div>
        <div class="chart-wrapper"><canvas id="chart-sent-m"></canvas></div>
      </div>
    </div>
    <div class="table-card">
      <div class="table-card-header">Récapitulatif mensuel</div>
      <div class="table-scroll">
        <table class="data-table" id="monthly-table">
          <thead>
            <tr>
              <th>Mois</th>
              <th class="num">Trouvés</th>
              <th class="num">Envoyés</th>
              <th class="num">Réponses</th>
              <th class="num">Taux réponse</th>
            </tr>
          </thead>
          <tbody id="monthly-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const sel = document.getElementById('year-select');
  renderCharts(studios, sel.value);
  sel.addEventListener('change', () => renderCharts(studios, sel.value));
}
