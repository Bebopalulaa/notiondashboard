/* View: Overview — KPI cards + timeline + donut */

window.ViewOverview = (function () {
  let chartTimeline = null;
  let chartStatus = null;

  /* ── helpers ──────────────────────────────────────────────────── */

  function monthKey(dateStr) {
    if (!dateStr) return null;
    return dateStr.slice(0, 7); // "YYYY-MM"
  }

  function monthLabel(ym) {
    const [y, m] = ym.split('-');
    return new Date(+y, +m - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
  }

  function last12Months() {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }

  function thisMonth() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }

  function prevMonth() {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function animateCount(el, target, isPercent) {
    const duration = 650;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = Math.round(target * eased);
      el.textContent = isPercent ? val + '%' : val;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function setDelta(el, val, prev, isPercent) {
    if (prev === undefined) { el.textContent = '—'; el.className = 'kpi-delta'; return; }
    const diff = val - prev;
    const label = isPercent
      ? (Math.abs(diff) < 0.1 ? '→ stable' : (diff > 0 ? `↑ ${Math.abs(diff).toFixed(1)}pp` : `↓ ${Math.abs(diff).toFixed(1)}pp`))
      : (diff === 0 ? '→ stable' : (diff > 0 ? `↑ ${diff} ce mois` : `↓ ${Math.abs(diff)} ce mois`));
    el.textContent = `${label} vs mois préc.`;
    el.className = 'kpi-delta ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : '');
  }

  const STATUS_COLORS = {
    'Trouvé':          '#4a4a5a',
    'Email envoyé':    '#5b8af5',
    'Réponse reçue':   '#22d3ee',
    'Positif':         '#34d399',
    'Négatif':         '#f87171',
    'En attente':      '#f59e0b',
  };

  function statusColor(s) {
    return STATUS_COLORS[s] || '#8b8b9e';
  }

  function chartTextColor() {
    return document.documentElement.dataset.theme === 'light' ? '#6b6b84' : '#8b8b9e';
  }

  function chartGridColor() {
    return document.documentElement.dataset.theme === 'light'
      ? 'rgba(0,0,0,0.07)'
      : 'rgba(255,255,255,0.06)';
  }

  /* ── render ───────────────────────────────────────────────────── */

  function render(studios) {
    if (!studios || !studios.length) {
      renderEmpty();
      return;
    }

    const tm = thisMonth();
    const pm = prevMonth();

    /* KPI raw values */
    const total    = studios.length;
    const totalTm  = studios.filter(s => monthKey(s.dateTrouve) === tm).length;
    const totalPm  = studios.filter(s => monthKey(s.dateTrouve) === pm).length;

    const sentAll  = studios.filter(s => s.dateEnvoi).length;
    const sentTm   = studios.filter(s => monthKey(s.dateEnvoi) === tm).length;
    const sentPm   = studios.filter(s => monthKey(s.dateEnvoi) === pm).length;

    const responses = studios.filter(s => s.reponse).length;
    const responsePct = sentAll ? Math.round(responses / sentAll * 100) : 0;

    const sentTmStudio = studios.filter(s => monthKey(s.dateEnvoi) === tm);
    const sentPmStudio = studios.filter(s => monthKey(s.dateEnvoi) === pm);
    const rTm = sentTmStudio.length ? Math.round(sentTmStudio.filter(s => s.reponse).length / sentTmStudio.length * 100) : 0;
    const rPm = sentPmStudio.length ? Math.round(sentPmStudio.filter(s => s.reponse).length / sentPmStudio.length * 100) : 0;

    const positifs    = studios.filter(s => s.status === 'Positif').length;
    const successPct  = sentAll ? Math.round(positifs / sentAll * 100) : 0;
    const posTm       = studios.filter(s => s.status === 'Positif' && monthKey(s.dateEnvoi) === tm).length;
    const posPm       = studios.filter(s => s.status === 'Positif' && monthKey(s.dateEnvoi) === pm).length;
    const sTm         = sentTmStudio.length ? Math.round(posTm / (sentTmStudio.length || 1) * 100) : 0;
    const sPm         = sentPmStudio.length ? Math.round(posPm / (sentPmStudio.length || 1) * 100) : 0;

    /* KPI cards */
    animateCount(document.getElementById('kpi-total'),    total, false);
    animateCount(document.getElementById('kpi-sent'),     sentAll, false);
    animateCount(document.getElementById('kpi-response'), responsePct, true);
    animateCount(document.getElementById('kpi-success'),  successPct, true);

    setDelta(document.getElementById('kpi-total-delta'),    totalTm,    totalPm,    false);
    setDelta(document.getElementById('kpi-sent-delta'),     sentTm,     sentPm,     false);
    setDelta(document.getElementById('kpi-response-delta'), rTm,        rPm,        true);
    setDelta(document.getElementById('kpi-success-delta'),  sTm,        sPm,        true);

    /* Line chart */
    const months = last12Months();
    const envoisData    = months.map(m => studios.filter(s => monthKey(s.dateEnvoi) === m).length);
    const reponsesData  = months.map(m => studios.filter(s => s.reponse && monthKey(s.dateEnvoi) === m).length);

    if (chartTimeline) chartTimeline.destroy();
    chartTimeline = new Chart(document.getElementById('chart-timeline'), {
      type: 'line',
      data: {
        labels: months.map(monthLabel),
        datasets: [
          {
            label: 'Emails envoyés',
            data: envoisData,
            borderColor: '#5b8af5',
            backgroundColor: 'rgba(91,138,245,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
          {
            label: 'Réponses',
            data: reponsesData,
            borderColor: '#22d3ee',
            backgroundColor: 'rgba(34,211,238,0.08)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: baseLineOptions(),
    });

    /* Donut chart */
    const statusCounts = {};
    studios.forEach(s => {
      const k = s.status || '(aucun)';
      statusCounts[k] = (statusCounts[k] || 0) + 1;
    });
    const statusLabels = Object.keys(statusCounts);
    const statusData   = statusLabels.map(k => statusCounts[k]);
    const statusColors = statusLabels.map(statusColor);

    if (chartStatus) chartStatus.destroy();
    chartStatus = new Chart(document.getElementById('chart-status'), {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusData,
          backgroundColor: statusColors.map(c => c + 'cc'),
          borderColor: statusColors,
          borderWidth: 1.5,
          hoverOffset: 6,
        }],
      },
      options: baseDonutOptions(),
    });
  }

  function renderEmpty() {
    document.getElementById('kpi-total').textContent    = '0';
    document.getElementById('kpi-sent').textContent     = '0';
    document.getElementById('kpi-response').textContent = '0%';
    document.getElementById('kpi-success').textContent  = '0%';
    ['kpi-total-delta','kpi-sent-delta','kpi-response-delta','kpi-success-delta']
      .forEach(id => { document.getElementById(id).textContent = '—'; });
  }

  /* ── chart option builders ────────────────────────────────────── */

  function baseLineOptions() {
    const tc = chartTextColor();
    const gc = chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: tc, font: { size: 12 }, boxWidth: 12, padding: 16 } },
        tooltip: { backgroundColor: '#1c1c22', titleColor: '#f0f0f4', bodyColor: '#8b8b9e', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 },
      },
      scales: {
        x: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } },
        y: { ticks: { color: tc, font: { size: 11 }, precision: 0 }, grid: { color: gc }, beginAtZero: true },
      },
    };
  }

  function baseDonutOptions() {
    const tc = chartTextColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { color: tc, font: { size: 12 }, boxWidth: 12, padding: 12 } },
        tooltip: { backgroundColor: '#1c1c22', titleColor: '#f0f0f4', bodyColor: '#8b8b9e', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 },
      },
    };
  }

  function destroy() {
    if (chartTimeline) { chartTimeline.destroy(); chartTimeline = null; }
    if (chartStatus)   { chartStatus.destroy();   chartStatus = null; }
  }

  return { render, destroy };
})();
