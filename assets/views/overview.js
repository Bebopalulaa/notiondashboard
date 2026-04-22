/**
 * View: Overview — KPI cards with animated counters, 12-month line chart,
 * status donut chart.
 */

import { initChart, PALETTE, tooltipConfig, scalesConfig } from '../charts.js';

/* ── skeleton HTML ──────────────────────────────────────────────── */
function skeletonKpi() {
  return Array(4).fill(0).map(() => `
    <div class="kpi-card">
      <span class="sk" style="width:60%;height:12px;margin-bottom:14px"></span>
      <span class="sk" style="width:42%;height:28px;margin-bottom:10px"></span>
      <span class="sk" style="width:55%;height:12px"></span>
    </div>`).join('');
}

function skeletonChart() {
  return `
    <div class="chart-card">
      <span class="sk" style="width:45%;height:12px;margin-bottom:18px"></span>
      <span class="sk" style="height:240px;border-radius:10px;display:block"></span>
    </div>`;
}

function renderSkeleton(section) {
  section.innerHTML = `
    <div class="kpi-grid">${skeletonKpi()}</div>
    <div class="charts-row">${skeletonChart()}${skeletonChart()}</div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
/** @param {string} ds */
function monthKey(ds) { return ds ? ds.slice(0, 7) : null; }

function ym(offsetMonths = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last12() {
  return Array.from({ length: 12 }, (_, i) => ym(i - 11));
}

function ymLabel(s) {
  const [y, m] = s.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

/**
 * Animate a numeric counter from 0 to target.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {boolean} isPct
 */
function animateCount(el, target, isPct) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = isPct ? target + '%' : target;
    return;
  }
  const duration = 1200;
  const start = performance.now();
  const frame = now => {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 4); // easeOutExpo approximation
    el.textContent = isPct
      ? Math.round(target * eased) + '%'
      : Math.round(target * eased);
    if (p < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function setDelta(el, val, prev, isPct) {
  if (prev === undefined || prev === null) { el.textContent = '—'; el.className = 'kpi-delta'; return; }
  const diff = val - prev;
  const fmt  = isPct
    ? (Math.abs(diff) < 0.1 ? '→ stable' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff).toFixed(1)}pp`)
    : (diff === 0 ? '→ stable' : `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)}`);
  el.textContent   = `${fmt} vs mois préc.`;
  el.className     = `kpi-delta${diff > 0 ? ' up' : diff < 0 ? ' down' : ''}`;
}

const STATUS_COLORS = {
  'Trouvé':         '#4a4a5a',
  'Email envoyé':   '#5b8af5',
  'Réponse reçue':  '#22d3ee',
  'Positif':        '#34d399',
  'Négatif':        '#f87171',
  'En attente':     '#f59e0b',
};

function statusColor(s) { return STATUS_COLORS[s] || PALETTE[5]; }

/* ── render ─────────────────────────────────────────────────────── */

/**
 * Render the overview view.
 * @param {import('../notion.js').Studio[]|null} studios - null triggers skeleton
 */
export function render(studios) {
  const section = document.getElementById('view-overview');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="kpi-grid">${Array(4).fill(0).map(() => `
        <div class="kpi-card">
          <div class="kpi-label">—</div>
          <div class="kpi-value">0</div>
          <div class="kpi-delta">—</div>
        </div>`).join('')}</div>
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>Aucun studio trouvé</h3>
        <p>Ajoute des entrées dans Notion puis actualise le dashboard.</p>
        <button class="btn btn-primary" onclick="document.getElementById('refresh-btn').click()">
          Actualiser
        </button>
      </div>`;
    return;
  }

  /* ── Inject real layout ── */
  section.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Studios trouvés</div>
        <div class="kpi-value" id="ov-total">0</div>
        <div class="kpi-delta" id="ov-total-d">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Emails envoyés</div>
        <div class="kpi-value" id="ov-sent">0</div>
        <div class="kpi-delta" id="ov-sent-d">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux de réponse</div>
        <div class="kpi-value" id="ov-resp">0%</div>
        <div class="kpi-delta" id="ov-resp-d">—</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Taux de succès</div>
        <div class="kpi-value" id="ov-succ">0%</div>
        <div class="kpi-delta" id="ov-succ-d">—</div>
      </div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">Envois &amp; réponses — 12 mois</div>
        <div class="chart-wrapper"><canvas id="chart-timeline"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Répartition par statut</div>
        <div class="chart-wrapper chart-wrapper--donut"><canvas id="chart-status"></canvas></div>
      </div>
    </div>`;

  /* ── KPIs ── */
  const tm = ym(0), pm = ym(-1);
  const total   = studios.length;
  const totalTm = studios.filter(s => monthKey(s.dateTrouve) === tm).length;
  const totalPm = studios.filter(s => monthKey(s.dateTrouve) === pm).length;

  const sentAll  = studios.filter(s => s.dateEnvoi).length;
  const sentTm   = studios.filter(s => monthKey(s.dateEnvoi) === tm).length;
  const sentPm   = studios.filter(s => monthKey(s.dateEnvoi) === pm).length;

  const replies  = studios.filter(s => s.reponse).length;
  const rPct     = sentAll ? Math.round(replies / sentAll * 100) : 0;

  const sentTmS  = studios.filter(s => monthKey(s.dateEnvoi) === tm);
  const sentPmS  = studios.filter(s => monthKey(s.dateEnvoi) === pm);
  const rTm      = sentTmS.length ? Math.round(sentTmS.filter(s => s.reponse).length / sentTmS.length * 100) : 0;
  const rPm      = sentPmS.length ? Math.round(sentPmS.filter(s => s.reponse).length / sentPmS.length * 100) : 0;

  const positifs = studios.filter(s => s.status === 'Positif').length;
  const sPct     = sentAll ? Math.round(positifs / sentAll * 100) : 0;
  const sTm      = sentTmS.length ? Math.round(sentTmS.filter(s => s.status === 'Positif').length / sentTmS.length * 100) : 0;
  const sPm      = sentPmS.length ? Math.round(sentPmS.filter(s => s.status === 'Positif').length / sentPmS.length * 100) : 0;

  animateCount(document.getElementById('ov-total'), total,  false);
  animateCount(document.getElementById('ov-sent'),  sentAll, false);
  animateCount(document.getElementById('ov-resp'),  rPct,   true);
  animateCount(document.getElementById('ov-succ'),  sPct,   true);

  setDelta(document.getElementById('ov-total-d'), totalTm, totalPm, false);
  setDelta(document.getElementById('ov-sent-d'),  sentTm,  sentPm,  false);
  setDelta(document.getElementById('ov-resp-d'),  rTm,     rPm,     true);
  setDelta(document.getElementById('ov-succ-d'),  sTm,     sPm,     true);

  /* ── Line chart ── */
  const months = last12();
  initChart('chart-timeline', {
    type: 'line',
    data: {
      labels: months.map(ymLabel),
      datasets: [
        {
          label: 'Emails envoyés',
          data: months.map(m => studios.filter(s => monthKey(s.dateEnvoi) === m).length),
          borderColor: PALETTE[0],
          backgroundColor: PALETTE[0] + '18',
          fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 6,
        },
        {
          label: 'Réponses',
          data: months.map(m => studios.filter(s => s.reponse && monthKey(s.dateEnvoi) === m).length),
          borderColor: PALETTE[1],
          backgroundColor: PALETTE[1] + '12',
          fill: true, tension: 0.35, pointRadius: 3, pointHoverRadius: 6,
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
      scales: scalesConfig(),
    },
  });

  /* ── Donut chart ── */
  const counts = {};
  studios.forEach(s => { const k = s.status || '(aucun)'; counts[k] = (counts[k] || 0) + 1; });
  const labels = Object.keys(counts);
  const colors = labels.map(statusColor);

  initChart('chart-status', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: labels.map(k => counts[k]),
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1.5,
        hoverOffset: 8,
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
