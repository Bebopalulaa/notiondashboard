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

function stepStats(studios, ym, getC1, getC2, repC1, repC2) {
  const c1 = studios.filter(s => monthKey(getC1(s)) === ym);
  const c2 = studios.filter(s => monthKey(getC2(s)) === ym);
  return {
    sent:    c1.length + c2.length,
    replied: c1.filter(s => repC1(s)).length + c2.filter(s => repC2(s)).length,
  };
}

function computeMonth(studios, ym) {
  const r1 = s => s.c1Repondu, r2 = s => s.c2Repondu;
  return {
    s0:  stepStats(studios, ym, s => s.dateEnvoiC1,  s => s.dateEnvoiC2,  r1, r2),
    s3:  stepStats(studios, ym, s => s.relEffC1J3,   s => s.relEffC2J3,   r1, r2),
    s7:  stepStats(studios, ym, s => s.relEffC1J7,   s => s.relEffC2J7,   r1, r2),
    s14: stepStats(studios, ym, s => s.relEffC1J14,  s => s.relEffC2J14,  r1, r2),
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
              <th class="num" title="Réponses / contacts uniques">Taux/contact</th>
              <th class="num" title="Réponses / total mails envoyés">Taux/mail</th>
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
        { label: 'J+0',          data: data.map(d => d.s0.sent),  backgroundColor: PALETTE[0] + 'cc', borderColor: PALETTE[0], borderWidth: 1, borderRadius: 3 },
        { label: 'Relance J+3',  data: data.map(d => d.s3.sent),  backgroundColor: PALETTE[1] + 'cc', borderColor: PALETTE[1], borderWidth: 1 },
        { label: 'Relance J+7',  data: data.map(d => d.s7.sent),  backgroundColor: PALETTE[2] + 'cc', borderColor: PALETTE[2], borderWidth: 1 },
        { label: 'Relance J+14', data: data.map(d => d.s14.sent), backgroundColor: PALETTE[3] + 'cc', borderColor: PALETTE[3], borderWidth: 1 },
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
  const rows  = data.filter(d => d.s0.sent || d.s3.sent || d.s7.sent || d.s14.sent).reverse();

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted)">Aucun envoi sur les 12 derniers mois</td></tr>`;
    return;
  }

  const zero = { sent: 0, replied: 0 };
  const add  = (a, b) => ({ sent: a.sent + b.sent, replied: a.replied + b.replied });
  const tot  = rows.reduce((acc, d) => ({
    s0: add(acc.s0, d.s0), s3: add(acc.s3, d.s3), s7: add(acc.s7, d.s7), s14: add(acc.s14, d.s14),
  }), { s0: { ...zero }, s3: { ...zero }, s7: { ...zero }, s14: { ...zero } });

  function cell(s) {
    if (!s.sent) return '—';
    const rate = s.sent ? `<div class="rate-sub">${Math.round(s.replied / s.sent * 100)}%</div>` : '';
    return s.sent + rate;
  }

  const totTotal = tot.s0.sent + tot.s3.sent + tot.s7.sent + tot.s14.sent;
  const totalRow = `<tr class="totals-row">
    <td><strong>Total (12 mois)</strong></td>
    <td class="num"><strong>${cell(tot.s0)}</strong></td>
    <td class="num"><strong>${cell(tot.s3)}</strong></td>
    <td class="num"><strong>${cell(tot.s7)}</strong></td>
    <td class="num"><strong>${cell(tot.s14)}</strong></td>
    <td class="num"><strong>${totTotal}</strong></td>
    <td class="num"><strong>${tot.s0.replied || '—'}</strong></td>
    <td class="num"><strong>${tot.s0.sent ? Math.round(tot.s0.replied / tot.s0.sent * 100) + '%' : '—'}</strong></td>
    <td class="num"><strong>${totTotal ? Math.round(tot.s0.replied / totTotal * 100) + '%' : '—'}</strong></td>
  </tr>`;

  tbody.innerHTML = totalRow + rows.map(d => {
    const total      = d.s0.sent + d.s3.sent + d.s7.sent + d.s14.sent;
    const rateC      = d.s0.sent  ? Math.round(d.s0.replied / d.s0.sent  * 100) : null;
    const rateMail   = total      ? Math.round(d.s0.replied / total       * 100) : null;
    const [y, m] = d.ym.split('-');
    return `<tr>
      <td>${MONTHS_LONG[+m - 1]} ${y}</td>
      <td class="num">${cell(d.s0)}</td>
      <td class="num">${cell(d.s3)}</td>
      <td class="num">${cell(d.s7)}</td>
      <td class="num">${cell(d.s14)}</td>
      <td class="num"><strong>${total}</strong></td>
      <td class="num">${d.s0.replied || '—'}</td>
      <td class="num">${rateC    !== null ? rateC    + '%' : '—'}</td>
      <td class="num">${rateMail !== null ? rateMail + '%' : '—'}</td>
    </tr>`;
  }).join('');
}
