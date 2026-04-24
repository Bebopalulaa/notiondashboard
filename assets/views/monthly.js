/**
 * View: Monthly activity — stacked bar chart (month/week/day) + summary table by month.
 */

import { initChart, PALETTE, tooltipConfig, scalesConfig } from '../charts.js';

const MONTHS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let _studios = [];

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

/* ── key helpers ────────────────────────────────────────────────── */
function monthKey(ds) { return ds ? ds.slice(0, 7) : null; }

function localStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekKey(ds) {
  if (!ds) return null;
  const d = new Date(ds + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return localStr(d);
}

function dayKey(ds) { return ds ? ds.slice(0, 10) : null; }

/* ── bucket generators ──────────────────────────────────────────── */
function last12months() {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 11 + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function last16weeks() {
  return Array.from({ length: 16 }, (_, i) => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) - (15 - i) * 7);
    return localStr(d);
  });
}

function last30days() {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    return localStr(d);
  });
}

/* ── label helpers ──────────────────────────────────────────────── */
function ymLabel(s) {
  const [y, m] = s.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function shortDateLabel(s) {
  const [y, m, d] = s.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/* ── data aggregation ───────────────────────────────────────────── */
function computeBucket(studios, bucket, keyFn) {
  const s0 = { sent: 0, replied: 0 }, s3 = { sent: 0, replied: 0 };
  const s7 = { sent: 0, replied: 0 }, s14 = { sent: 0, replied: 0 };

  studios.forEach(s => {
    if (keyFn(s.dateEnvoiC1)  === bucket) s0.sent++;
    if (keyFn(s.dateEnvoiC2)  === bucket) s0.sent++;
    if (keyFn(s.relEffC1J3)   === bucket) s3.sent++;
    if (keyFn(s.relEffC2J3)   === bucket) s3.sent++;
    if (keyFn(s.relEffC1J7)   === bucket) s7.sent++;
    if (keyFn(s.relEffC2J7)   === bucket) s7.sent++;
    if (keyFn(s.relEffC1J14)  === bucket) s14.sent++;
    if (keyFn(s.relEffC2J14)  === bucket) s14.sent++;

    for (const [replied, seq] of [
      [s.c1Repondu, [[s14, s.relEffC1J14], [s7, s.relEffC1J7], [s3, s.relEffC1J3], [s0, s.dateEnvoiC1]]],
      [s.c2Repondu, [[s14, s.relEffC2J14], [s7, s.relEffC2J7], [s3, s.relEffC2J3], [s0, s.dateEnvoiC2]]],
    ]) {
      if (!replied) continue;
      for (const [step, date] of seq) {
        if (date) { if (keyFn(date) === bucket) step.replied++; break; }
      }
    }
  });

  return { s0, s3, s7, s14 };
}

/* ── chart rendering ────────────────────────────────────────────── */
function renderChart(gran) {
  let buckets, labelFn, keyFn, noun, suffix;
  if (gran === 'week') {
    buckets = last16weeks(); labelFn = shortDateLabel; keyFn = weekKey;
    noun = 'semaine'; suffix = '16 dernières semaines';
  } else if (gran === 'day') {
    buckets = last30days(); labelFn = shortDateLabel; keyFn = dayKey;
    noun = 'jour'; suffix = '30 derniers jours';
  } else {
    buckets = last12months(); labelFn = ymLabel; keyFn = monthKey;
    noun = 'mois'; suffix = '12 derniers mois';
  }

  const titleEl = document.getElementById('chart-monthly-title');
  if (titleEl) titleEl.textContent = `Envois par ${noun} et par type — ${suffix}`;

  document.querySelectorAll('.gran-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.gran === gran)
  );

  const data = buckets.map(b => computeBucket(_studios, b, keyFn));

  initChart('chart-monthly-bar', {
    type: 'bar',
    data: {
      labels: buckets.map(labelFn),
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
      <div class="chart-header">
        <div class="chart-title" id="chart-monthly-title">Envois par mois et par type — 12 derniers mois</div>
        <div class="gran-toggle">
          <button class="gran-btn active" data-gran="month">Mois</button>
          <button class="gran-btn" data-gran="week">Semaines</button>
          <button class="gran-btn" data-gran="day">Jours</button>
        </div>
      </div>
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

  _studios = studios;
  renderChart('month');

  document.querySelectorAll('.gran-btn').forEach(btn =>
    btn.addEventListener('click', () => renderChart(btn.dataset.gran))
  );

  /* ── Table (monthly only) ── */
  const months = last12months();
  const data   = months.map(m => ({ ym: m, ...computeBucket(studios, m, monthKey) }));
  const tbody  = document.getElementById('monthly-tbody');
  const rows   = data.filter(d => d.s0.sent || d.s3.sent || d.s7.sent || d.s14.sent).reverse();

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
    const rate = `<div class="rate-sub">${Math.round(s.replied / s.sent * 100)}%</div>`;
    return s.sent + rate;
  }

  const repus = s => s.s0.replied + s.s3.replied + s.s7.replied + s.s14.replied;

  const totTotal   = tot.s0.sent + tot.s3.sent + tot.s7.sent + tot.s14.sent;
  const totReplied = repus(tot);
  const totalRow = `<tr class="totals-row">
    <td><strong>Total (12 mois)</strong></td>
    <td class="num"><strong>${cell(tot.s0)}</strong></td>
    <td class="num"><strong>${cell(tot.s3)}</strong></td>
    <td class="num"><strong>${cell(tot.s7)}</strong></td>
    <td class="num"><strong>${cell(tot.s14)}</strong></td>
    <td class="num"><strong>${totTotal}</strong></td>
    <td class="num"><strong>${totReplied || '—'}</strong></td>
    <td class="num"><strong>${tot.s0.sent ? Math.round(totReplied / tot.s0.sent * 100) + '%' : '—'}</strong></td>
    <td class="num"><strong>${totTotal   ? Math.round(totReplied / totTotal     * 100) + '%' : '—'}</strong></td>
  </tr>`;

  tbody.innerHTML = totalRow + rows.map(d => {
    const total    = d.s0.sent + d.s3.sent + d.s7.sent + d.s14.sent;
    const replied  = repus(d);
    const rateC    = d.s0.sent ? Math.round(replied / d.s0.sent * 100) : null;
    const rateMail = total     ? Math.round(replied / total     * 100) : null;
    const [y, m] = d.ym.split('-');
    return `<tr>
      <td>${MONTHS_LONG[+m - 1]} ${y}</td>
      <td class="num">${cell(d.s0)}</td>
      <td class="num">${cell(d.s3)}</td>
      <td class="num">${cell(d.s7)}</td>
      <td class="num">${cell(d.s14)}</td>
      <td class="num"><strong>${total}</strong></td>
      <td class="num">${replied  || '—'}</td>
      <td class="num">${rateC    !== null ? rateC    + '%' : '—'}</td>
      <td class="num">${rateMail !== null ? rateMail + '%' : '—'}</td>
    </tr>`;
  }).join('');
}
