/**
 * View: Funnel — animated horizontal bars, auto-generated insight text,
 * results distribution donut chart.
 */

import { initChart, tooltipConfig } from '../charts.js';

/* ── skeleton ───────────────────────────────────────────────────── */
function renderSkeleton(section) {
  section.innerHTML = `
    <div class="charts-row charts-row--funnel">
      <div class="chart-card chart-card--tall">
        <span class="sk" style="width:45%;height:12px;margin-bottom:24px;display:block"></span>
        ${Array(4).fill(0).map((_, i) => `
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px">
              <span class="sk" style="width:${30 + i * 12}%;height:13px;display:block"></span>
              <span class="sk" style="width:80px;height:13px;display:block"></span>
            </div>
            <span class="sk" style="height:30px;border-radius:6px;display:block"></span>
          </div>`).join('')}
        <span class="sk" style="height:60px;border-radius:8px;margin-top:8px;display:block"></span>
      </div>
      <div class="chart-card">
        <span class="sk" style="width:55%;height:12px;margin-bottom:18px;display:block"></span>
        <span class="sk" style="height:240px;border-radius:50%;width:240px;margin:0 auto;display:block"></span>
      </div>
    </div>`;
}

/* ── helpers ────────────────────────────────────────────────────── */
function pct(n, d) { return d ? Math.round(n / d * 100) : 0; }

/**
 * Render the funnel view.
 * @param {import('../notion.js').Studio[]|null} studios - null triggers skeleton
 */
export function render(studios) {
  const section = document.getElementById('view-funnel');
  if (!section) return;

  if (studios === null) { renderSkeleton(section); return; }

  if (!studios.length) {
    section.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔽</div>
        <h3>Funnel vide</h3>
        <p>Ajoute des studios dans Notion et actualise pour voir ton funnel de conversion.</p>
      </div>`;
    return;
  }

  const total    = studios.length;
  const sent     = studios.filter(s => s.dateEnvoi).length;
  const replied  = studios.filter(s => s.reponse).length;
  const positive = studios.filter(s => s.status === 'Positif').length;

  const steps = [
    { label: 'Studios trouvés',  value: total,    cls: 's0' },
    { label: 'Emails envoyés',   value: sent,     cls: 's1' },
    { label: 'Réponses reçues',  value: replied,  cls: 's2' },
    { label: 'Positifs',         value: positive, cls: 's3' },
  ];

  /* Insight text */
  const rRate = sent ? (replied / sent * 100).toFixed(1) : 0;
  const benchText = Number(rRate) < 3
    ? 'en dessous de la moyenne cold email (3–5%) — travaille ton objet ou ton pitch'
    : Number(rRate) <= 5
      ? 'dans la moyenne cold email (3–5%) 👌'
      : 'au-dessus de la moyenne cold email (3–5%) — excellent résultat ! 🎉';

  const insightHtml = sent > 0
    ? `Ton taux de réponse est de <strong>${rRate}%</strong>, ${benchText}. Sur <strong>${sent}</strong>
       email${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''},
       <strong>${replied}</strong> réponse${replied > 1 ? 's' : ''} et
       <strong>${positive}</strong> résultat${positive > 1 ? 's' : ''} positif${positive > 1 ? 's' : ''}.`
    : `<strong>${total}</strong> studio${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}.
       Commence à envoyer des emails pour voir le funnel se remplir.`;

  /* Funnel bars HTML */
  const barsHtml = steps.map((s, i) => {
    const prev     = steps[i - 1];
    const convPct  = prev && prev.value ? pct(s.value, prev.value) : 100;
    const widthPct = total ? Math.max(pct(s.value, total), 0) : 0;
    const meta     = i === 0
      ? `${s.value} · 100%`
      : `${s.value} · ${convPct}% de l'étape préc.`;

    return `
      <div class="funnel-bar-row">
        <div class="funnel-bar-label">
          <strong>${s.label}</strong>
          <span class="funnel-meta">${meta}</span>
        </div>
        <div class="funnel-bar-track">
          <div class="funnel-bar-fill ${s.cls}" style="width:0%" data-w="${widthPct}">
            ${s.value}
          </div>
        </div>
      </div>`;
  }).join('');

  section.innerHTML = `
    <div class="charts-row charts-row--funnel">
      <div class="chart-card chart-card--tall">
        <div class="chart-title">Funnel de conversion</div>
        <div class="funnel-bars">${barsHtml}</div>
        <div class="funnel-insight">${insightHtml}</div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Distribution des résultats</div>
        <div class="chart-wrapper chart-wrapper--donut"><canvas id="chart-results"></canvas></div>
      </div>
    </div>`;

  /* Animate bars */
  requestAnimationFrame(() => requestAnimationFrame(() => {
    section.querySelectorAll('.funnel-bar-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }));

  /* Donut */
  const waiting  = studios.filter(s => s.status === 'En attente').length;
  const negative = studios.filter(s => s.status === 'Négatif').length;
  const noAns    = studios.filter(s => s.dateEnvoi && !s.reponse && !['Positif','Négatif','En attente'].includes(s.status)).length;

  const donutData = [
    positive && { l: 'Positif',      v: positive, c: '#34d399' },
    waiting  && { l: 'En attente',   v: waiting,  c: '#f59e0b' },
    negative && { l: 'Négatif',      v: negative, c: '#f87171' },
    noAns    && { l: 'Sans réponse', v: noAns,    c: '#4a4a5a' },
  ].filter(Boolean);

  if (donutData.length) {
    initChart('chart-results', {
      type: 'doughnut',
      data: {
        labels:   donutData.map(d => d.l),
        datasets: [{
          data:            donutData.map(d => d.v),
          backgroundColor: donutData.map(d => d.c + 'cc'),
          borderColor:     donutData.map(d => d.c),
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
