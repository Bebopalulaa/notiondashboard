/**
 * View: Monthly activity — stacked bar chart + summary table by month.
 */

import { initChart, PALETTE, tooltipConfig, scalesConfig } from '../charts.js';

const MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const MONTHS_LONG  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="chart-card" style="margin-bottom:24px">
      <span class="sk" style="width:50%;height:12px;margin-bottom:18px;display:block"></span>
      <span class="sk" style="height:280px;border-radius:10px;display:block"></span>
    </div>
    <div class="table-card">
      ${Array(7).fill(0).map(() => `
        <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;gap:16px">
          ${Array(6).fill(0).map((_, i) => `<span class="sk" style="height:14px;flex:${i===0?2:1}"></span>`).join('')}
        </div>`).join('')}
    </div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
function monthKey(ds) { return ds ? ds.slice(0, 7) : null; }

function last12months() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 11 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function ymLabel(s) {
  const [y, m] = s.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function computeMonth(studios, ym) {
  const cnt = (a, b) => studios.reduce((n, s) =>
    n + (monthKey(a(s)) === ym ? 1 : 0) + (monthKey(b(s)) === ym ? 1 : 0), 0);

  const c1inMonth = studios.filter(s => monthKey(s.dateEnvoiC1) === ym);
  const c2inMonth = studios.filter(s => monthKey(s.dateEnvoiC2) === ym);
  const contacts  = c1inMonth.length + c2inMonth.length;
  const replied   = c1inMonth.filter(s => s.c1Repondu).length + c2inMonth.filter(s => s.c2Repondu).length;

  return {
    j0:       cnt(s => s.dateEnvoiC1,  s => s.dateEnvoiC2),
    j3:       cnt(s => s.relEffC1J3,   s => s.relEffC2J3),
    j7:       cnt(s => s.relEffC1J7,   s => s.relEffC2J7),
    j14:      cnt(s => s.relEffC1J14,  s => s.relEffC2J14),
    repus:    replied,
    contacts,
  };
}

/**
 * Render the monthly activity view.
 * @param {import('../notion.js').Studio[]|null} studios
 */
export function render(studios) {
  const section = document.getElementById('view-monthly');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📅</div>
        <h3>Aucune activité mensuelle</h3>
        <p>Les données apparaîtront dès que des studios auront des dates enregistrées.</p>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="chart-card" style="margin-bottom:24px">
      <div class="chart-title">Envois par mois et par type — 12 derniers mois</div>
      <div class="chart-wrapper chart-wrapper--tall"><canvas id="chart-monthly-bar"></canvas></div>
    </div>
    <div class="table-card">
      <div class="table-card-header">Récapitulatif mensuel</div>
      <div class="table-scroll">
        <table class="data-table" id="monthly-table">
          <thead>
            <tr>
              <th>Mois</th>
              <th class="num">J+0</th>
              <th class="num">Rel. J+3</th>
              <th class="num">Rel. J+7</th>
              <th class="num">Rel. J+14</th>
              <th class="num">Total</th>
              <th class="num">Réponses</th>
              <th class="num">Taux</th>
            </tr>
          </thead>
          <tbody id="monthly-tbody"></tbody>
        </table>
      </div>
    </div>`;

  const months = last12months();
  const data   = months.map(m => ({ ym: m, ...computeMonth(studios, m) }));

  /* ── Stacked bar chart ── */
  initChart('chart-monthly-bar', {
    type: 'bar',
    data: {
      labels: months.map(ymLabel),
      datasets: [
        { label: 'J+0',       data: data.map(d => d.j0),  backgroundColor: PALETTE[0] + 'cc', borderColor: PALETTE[0], borderWidth: 1, borderRadius: 3 },
        { label: 'Relance J+3',  data: data.map(d => d.j3),  backgroundColor: PALETTE[1] + 'cc', borderColor: PALETTE[1], borderWidth: 1 },
        { label: 'Relance J+7',  data: data.map(d => d.j7),  backgroundColor: PALETTE[2] + 'cc', borderColor: PALETTE[2], borderWidth: 1 },
        { label: 'Relance J+14', data: data.map(d => d.j14), backgroundColor: PALETTE[3] + 'cc', borderColor: PALETTE[3], borderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8b8b9e', font: { size: 12 }, boxWidth: 12, padding: 16 } },
        tooltip: tooltipConfig(),
      },
      scales: {
        ...scalesConfig(),
        x: { ...scalesConfig().x, stacked: true },
        y: { ...scalesConfig().y, stacked: true },
      },
    },
  });

  /* ── Table ── */
  const tbody = document.getElementById('monthly-tbody');
  const rows  = data.filter(d => d.j0 || d.j3 || d.j7 || d.j14).reverse();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-muted)">Aucun envoi sur les 12 derniers mois</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(d => {
    const total = d.j0 + d.j3 + d.j7 + d.j14;
    const rate  = d.contacts ? Math.round(d.repus / d.contacts * 100) : null;
    const [y, m] = d.ym.split('-');
    return `<tr>
      <td>${MONTHS_LONG[+m - 1]} ${y}</td>
      <td class="num">${d.j0  || '—'}</td>
      <td class="num">${d.j3  || '—'}</td>
      <td class="num">${d.j7  || '—'}</td>
      <td class="num">${d.j14 || '—'}</td>
      <td class="num"><strong>${total}</strong></td>
      <td class="num">${d.repus || '—'}</td>
      <td class="num">${rate !== null ? rate + '%' : '—'}</td>
    </tr>`;
  }).join('');
}
