/**
 * View: Overview — KPI cards, monthly bar chart, type breakdown donut.
 */

import { initChart, PALETTE, tooltipConfig, scalesConfig } from '../charts.js';

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="kpi-grid">
      ${Array(4).fill(0).map(() => `
        <div class="kpi-card">
          <span class="sk" style="width:60%;height:12px;margin-bottom:14px"></span>
          <span class="sk" style="width:42%;height:28px;margin-bottom:10px"></span>
          <span class="sk" style="width:55%;height:12px"></span>
        </div>`).join('')}
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <span class="sk" style="width:45%;height:12px;margin-bottom:18px"></span>
        <span class="sk" style="height:240px;border-radius:10px;display:block"></span>
      </div>
      <div class="chart-card">
        <span class="sk" style="width:55%;height:12px;margin-bottom:18px"></span>
        <span class="sk" style="height:240px;border-radius:50%;width:240px;margin:0 auto;display:block"></span>
      </div>
    </div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
/** Returns all effective send dates for a studio. */
function allSends(s) {
  return [
    s.dateEnvoiC1, s.relEffC1J3, s.relEffC1J7, s.relEffC1J14,
    s.dateEnvoiC2, s.relEffC2J3, s.relEffC2J7, s.relEffC2J14,
  ].filter(Boolean);
}

function monthKey(ds) { return ds ? ds.slice(0, 7) : null; }

function ym(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last6() { return Array.from({ length: 6 }, (_, i) => ym(i - 5)); }

function ymLabel(s) {
  const [y, m] = s.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

function countOverdue(studios) {
  const today = new Date().toISOString().split('T')[0];
  let n = 0;
  studios.forEach(s => {
    [
      [s.relPrevC1J3,  s.relEffC1J3],
      [s.relPrevC1J7,  s.relEffC1J7],
      [s.relPrevC1J14, s.relEffC1J14],
      [s.relPrevC2J3,  s.relEffC2J3],
      [s.relPrevC2J7,  s.relEffC2J7],
      [s.relPrevC2J14, s.relEffC2J14],
    ].forEach(([prev, eff]) => { if (prev && !eff && prev < today) n++; });
  });
  return n;
}

/**
 * Animate a numeric counter from 0 to target.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {string} [suffix='']
 */
function animateCount(el, target, suffix = '') {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target + suffix; return;
  }
  const duration = 1200;
  const start = performance.now();
  const frame = now => {
    const p     = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function setDelta(el, val, prev, suffix = '') {
  if (prev === undefined || prev === null) { el.textContent = '—'; el.className = 'kpi-delta'; return; }
  const diff = val - prev;
  const fmt  = diff === 0
    ? '→ stable'
    : `${diff > 0 ? '↑' : '↓'} ${Math.abs(suffix === '%' ? diff.toFixed(1) : diff)}${suffix}`;
  el.textContent = `${fmt} vs mois préc.`;
  el.className   = `kpi-delta${diff > 0 ? ' up' : diff < 0 ? ' down' : ''}`;
}

/* ── render ─────────────────────────────────────────────────────── */

/**
 * Render the overview view.
 * @param {import('../notion.js').Studio[]|null} studios
 */
export function render(studios) {
  const section = document.getElementById('view-overview');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>Aucun studio trouvé</h3>
        <p>Ajoute des entrées dans Notion puis actualise le dashboard.</p>
        <button class="btn btn-primary" onclick="document.getElementById('refresh-btn').click()">Actualiser</button>
      </div>`;
    return;
  }

  section.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Emails envoyés ce mois</div>
        <div class="kpi-value" id="ov-tm">0</div>
        <div class="kpi-delta" id="ov-tm-d">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total envoyés</div>
        <div class="kpi-value" id="ov-total">0</div>
        <div class="kpi-delta" id="ov-total-d">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux de réponse</div>
        <div class="kpi-value" id="ov-resp">0%</div>
        <div class="kpi-delta" id="ov-resp-d">—</div>
      </div>
      <div class="kpi-card kpi-card--alert" id="ov-overdue-card">
        <div class="kpi-label">Relances en retard</div>
        <div class="kpi-value" id="ov-overdue">0</div>
        <div class="kpi-delta" id="ov-overdue-d">planifiées non envoyées</div>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">Envois effectifs — 6 derniers mois</div>
        <div class="chart-wrapper"><canvas id="chart-timeline"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Répartition par type d'envoi</div>
        <div class="chart-wrapper chart-wrapper--donut"><canvas id="chart-types"></canvas></div>
      </div>
    </div>`;

  /* ── KPIs ── */
  const tm = ym(0), pm = ym(-1);
  const allSendsFlat = studios.flatMap(s => allSends(s));

  const sentTm    = allSendsFlat.filter(d => d.startsWith(tm)).length;
  const sentPm    = allSendsFlat.filter(d => d.startsWith(pm)).length;
  const totalSent = allSendsFlat.length;

  const c1sent    = studios.filter(s => s.dateEnvoiC1);
  const c2sent    = studios.filter(s => s.dateEnvoiC2);
  const totalContacts = c1sent.length + c2sent.length;
  const replied   = c1sent.filter(s => s.c1Repondu).length + c2sent.filter(s => s.c2Repondu).length;
  const replyRate = totalContacts ? Math.round(replied / totalContacts * 100) : 0;

  const c1Tm = studios.filter(s => monthKey(s.dateEnvoiC1) === tm);
  const c2Tm = studios.filter(s => monthKey(s.dateEnvoiC2) === tm);
  const c1Pm = studios.filter(s => monthKey(s.dateEnvoiC1) === pm);
  const c2Pm = studios.filter(s => monthKey(s.dateEnvoiC2) === pm);
  const totalTm = c1Tm.length + c2Tm.length;
  const totalPm = c1Pm.length + c2Pm.length;
  const rTm = totalTm ? Math.round((c1Tm.filter(s => s.c1Repondu).length + c2Tm.filter(s => s.c2Repondu).length) / totalTm * 100) : 0;
  const rPm = totalPm ? Math.round((c1Pm.filter(s => s.c1Repondu).length + c2Pm.filter(s => s.c2Repondu).length) / totalPm * 100) : 0;

  const overdue = countOverdue(studios);

  animateCount(document.getElementById('ov-tm'),      sentTm,    '');
  animateCount(document.getElementById('ov-total'),   totalSent, '');
  animateCount(document.getElementById('ov-resp'),    replyRate, '%');
  animateCount(document.getElementById('ov-overdue'), overdue,   '');

  setDelta(document.getElementById('ov-tm-d'),    sentTm,    sentPm, '');
  setDelta(document.getElementById('ov-resp-d'),  replyRate, rPm === rTm ? rTm : rPm, '%');

  if (overdue > 0) document.getElementById('ov-overdue-card').classList.add('kpi-card--danger');

  /* ── Bar chart — emails per month ── */
  const months = last6();
  initChart('chart-timeline', {
    type: 'bar',
    data: {
      labels: months.map(ymLabel),
      datasets: [
        {
          label: 'J+0 (premiers envois)',
          data: months.map(m =>
            studios.filter(s => monthKey(s.dateEnvoiC1) === m || monthKey(s.dateEnvoiC2) === m).length
          ),
          backgroundColor: PALETTE[0] + 'b3', borderColor: PALETTE[0], borderWidth: 1, borderRadius: 4,
        },
        {
          label: 'Relances effectives',
          data: months.map(m => studios.reduce((n, s) => n +
            [s.relEffC1J3, s.relEffC1J7, s.relEffC1J14, s.relEffC2J3, s.relEffC2J7, s.relEffC2J14]
              .filter(d => d && d.startsWith(m)).length, 0)
          ),
          backgroundColor: PALETTE[2] + 'b3', borderColor: PALETTE[2], borderWidth: 1, borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#8b8b9e', font: { size: 12 }, boxWidth: 12, padding: 16 } },
        tooltip: tooltipConfig(),
      },
      scales: { ...scalesConfig(), x: { ...scalesConfig().x, stacked: false } },
    },
  });

  /* ── Donut — breakdown by type ── */
  const byType = [
    { l: 'J+0 (envoi initial)',  v: studios.filter(s => s.dateEnvoiC1 || s.dateEnvoiC2).length, c: PALETTE[0] },
    { l: 'Relance J+3',  v: studios.filter(s => s.relEffC1J3 || s.relEffC2J3).length,   c: PALETTE[1] },
    { l: 'Relance J+7',  v: studios.filter(s => s.relEffC1J7 || s.relEffC2J7).length,   c: PALETTE[2] },
    { l: 'Relance J+14', v: studios.filter(s => s.relEffC1J14 || s.relEffC2J14).length, c: PALETTE[3] },
  ].filter(d => d.v > 0);

  if (byType.length) {
    initChart('chart-types', {
      type: 'doughnut',
      data: {
        labels:   byType.map(d => d.l),
        datasets: [{
          data:            byType.map(d => d.v),
          backgroundColor: byType.map(d => d.c + 'cc'),
          borderColor:     byType.map(d => d.c),
          borderWidth: 1.5, hoverOffset: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b8b9e', font: { size: 12 }, boxWidth: 12, padding: 12 } },
          tooltip: tooltipConfig(),
        },
      },
    });
  }
}
