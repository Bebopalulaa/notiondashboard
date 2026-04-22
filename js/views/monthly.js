/* View: Monthly activity — year selector, bar charts, summary table */

window.ViewMonthly = (function () {
  let chartFound = null;
  let chartSent  = null;
  let allStudios = [];

  const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  const MONTHS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  function extractYears(studios) {
    const ys = new Set();
    studios.forEach(s => {
      if (s.dateTrouve) ys.add(s.dateTrouve.slice(0,4));
      if (s.dateEnvoi)  ys.add(s.dateEnvoi.slice(0,4));
    });
    return [...ys].sort((a,b) => b - a);
  }

  function chartTextColor() {
    return document.documentElement.dataset.theme === 'light' ? '#6b6b84' : '#8b8b9e';
  }
  function chartGridColor() {
    return document.documentElement.dataset.theme === 'light' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
  }

  function buildBarOptions(color) {
    const tc = chartTextColor();
    const gc = chartGridColor();
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c1c22',
          titleColor: '#f0f0f4',
          bodyColor: '#8b8b9e',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: { ticks: { color: tc, font: { size: 11 } }, grid: { color: gc } },
        y: { ticks: { color: tc, font: { size: 11 }, precision: 0 }, grid: { color: gc }, beginAtZero: true },
      },
    };
  }

  function renderCharts(year) {
    const studios = allStudios;

    const monthData = Array.from({ length: 12 }, (_, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
      const found  = studios.filter(s => s.dateTrouve && s.dateTrouve.startsWith(ym)).length;
      const sent   = studios.filter(s => s.dateEnvoi  && s.dateEnvoi.startsWith(ym)).length;
      const resp   = studios.filter(s => s.reponse    && s.dateEnvoi  && s.dateEnvoi.startsWith(ym)).length;
      return { month: i, found, sent, resp };
    });

    const labels = MONTHS_FR;

    if (chartFound) { chartFound.destroy(); chartFound = null; }
    chartFound = new Chart(document.getElementById('chart-found'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Studios trouvés',
          data: monthData.map(d => d.found),
          backgroundColor: 'rgba(91,138,245,0.75)',
          borderColor: '#5b8af5',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: buildBarOptions('#5b8af5'),
    });

    if (chartSent) { chartSent.destroy(); chartSent = null; }
    chartSent = new Chart(document.getElementById('chart-sent-monthly'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Emails envoyés',
          data: monthData.map(d => d.sent),
          backgroundColor: 'rgba(34,211,238,0.65)',
          borderColor: '#22d3ee',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: buildBarOptions('#22d3ee'),
    });

    /* Table */
    const tbody = document.getElementById('monthly-tbody');
    const rows = monthData.filter(d => d.found || d.sent || d.resp).reverse();

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Aucune donnée pour ${year}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(d => {
      const rate = d.sent ? Math.round(d.resp / d.sent * 100) : 0;
      return `<tr>
        <td>${MONTHS_LONG[d.month]} ${year}</td>
        <td class="num">${d.found}</td>
        <td class="num">${d.sent}</td>
        <td class="num">${d.resp}</td>
        <td class="num">${d.sent ? rate + '%' : '—'}</td>
      </tr>`;
    }).join('');
  }

  function render(studios) {
    allStudios = studios || [];

    const years = extractYears(allStudios);
    const sel = document.getElementById('year-select');
    const currentVal = sel.value;

    if (!years.length) {
      sel.innerHTML = `<option value="">Aucune donnée</option>`;
      document.getElementById('monthly-tbody').innerHTML =
        `<tr><td colspan="5" class="empty-state">Aucun studio avec une date enregistrée.</td></tr>`;
      return;
    }

    sel.innerHTML = years.map(y => `<option value="${y}" ${y === currentVal ? 'selected' : ''}>${y}</option>`).join('');
    const year = sel.value;

    sel.onchange = () => renderCharts(sel.value);
    renderCharts(year);
  }

  function destroy() {
    if (chartFound) { chartFound.destroy(); chartFound = null; }
    if (chartSent)  { chartSent.destroy();  chartSent = null; }
  }

  return { render, destroy };
})();
