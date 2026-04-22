/* View: Funnel — horizontal bars + secondary donut + insight */

window.ViewFunnel = (function () {
  let chartResults = null;

  function pct(num, den) {
    return den ? Math.round(num / den * 100) : 0;
  }

  function chartTextColor() {
    return document.documentElement.dataset.theme === 'light' ? '#6b6b84' : '#8b8b9e';
  }

  function render(studios) {
    if (!studios || !studios.length) {
      document.getElementById('funnel-bars').innerHTML =
        '<p class="empty-state">Aucune donnée disponible.</p>';
      document.getElementById('funnel-insight').textContent = '';
      return;
    }

    const total   = studios.length;
    const sent    = studios.filter(s => s.dateEnvoi).length;
    const replied = studios.filter(s => s.reponse).length;
    const positive = studios.filter(s => s.status === 'Positif').length;

    const steps = [
      { label: 'Studios trouvés',   value: total,    step: 0 },
      { label: 'Emails envoyés',    value: sent,     step: 1 },
      { label: 'Réponses reçues',   value: replied,  step: 2 },
      { label: 'Positifs',          value: positive, step: 3 },
    ];

    /* Funnel bars */
    const container = document.getElementById('funnel-bars');
    container.innerHTML = steps.map((s, i) => {
      const prev = steps[i - 1];
      const convPct = prev && prev.value ? pct(s.value, prev.value) : 100;
      const widthPct = total ? Math.max(pct(s.value, total), 0) : 0;
      const metaText = i === 0
        ? `100% du total`
        : `${convPct}% de l'étape préc. · ${pct(s.value, total)}% du total`;

      return `
        <div class="funnel-bar-row">
          <div class="funnel-bar-label">
            <strong>${s.label}</strong>
            <span class="funnel-meta">${s.value} · ${metaText}</span>
          </div>
          <div class="funnel-bar-track">
            <div class="funnel-bar-fill s${s.step}" style="width:0%" data-w="${widthPct}">
              ${s.value}
            </div>
          </div>
        </div>`;
    }).join('');

    /* Animate bars after paint */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        container.querySelectorAll('.funnel-bar-fill').forEach(el => {
          el.style.width = el.dataset.w + '%';
        });
      });
    });

    /* Insight text */
    const responseRate = sent ? (replied / sent * 100).toFixed(1) : 0;
    const insight = document.getElementById('funnel-insight');
    const inAvg = responseRate >= 3 && responseRate <= 5;
    const inAvgText = inAvg
      ? 'ce qui est <strong>dans la moyenne</strong> cold email pour le game dev (3–5%)'
      : responseRate < 3
        ? 'ce qui est <strong>en dessous</strong> de la moyenne cold email (3–5%) — essaie d\'améliorer ton objet ou ton message'
        : 'ce qui est <strong>au-dessus</strong> de la moyenne cold email (3–5%) — excellent résultat !';

    if (sent > 0) {
      insight.innerHTML = `
        Ton taux de réponse est de <strong>${responseRate}%</strong>, ${inAvgText}.
        Sur <strong>${sent}</strong> email${sent > 1 ? 's' : ''} envoyé${sent > 1 ? 's' : ''},
        <strong>${replied}</strong> réponse${replied > 1 ? 's' : ''} et
        <strong>${positive}</strong> résultat${positive > 1 ? 's' : ''} positif${positive > 1 ? 's' : ''}.
      `;
    } else {
      insight.innerHTML = `<strong>${total}</strong> studio${total > 1 ? 's' : ''} trouvé${total > 1 ? 's' : ''}. Commence à envoyer des emails pour voir le funnel se remplir.`;
    }

    /* Donut chart — Positif / En attente / Négatif */
    const waiting  = studios.filter(s => s.status === 'En attente').length;
    const negative = studios.filter(s => s.status === 'Négatif').length;
    const noAnswer = studios.filter(s => s.dateEnvoi && !s.reponse && !['Positif','Négatif','En attente'].includes(s.status)).length;

    const donutLabels = [];
    const donutData   = [];
    const donutColors = [];

    if (positive) { donutLabels.push('Positif');    donutData.push(positive); donutColors.push('#34d399'); }
    if (waiting)  { donutLabels.push('En attente'); donutData.push(waiting);  donutColors.push('#f59e0b'); }
    if (negative) { donutLabels.push('Négatif');    donutData.push(negative); donutColors.push('#f87171'); }
    if (noAnswer) { donutLabels.push('Sans réponse'); donutData.push(noAnswer); donutColors.push('#4a4a5a'); }

    if (chartResults) { chartResults.destroy(); chartResults = null; }

    if (donutData.length) {
      const tc = chartTextColor();
      chartResults = new Chart(document.getElementById('chart-results'), {
        type: 'doughnut',
        data: {
          labels: donutLabels,
          datasets: [{
            data: donutData,
            backgroundColor: donutColors.map(c => c + 'cc'),
            borderColor: donutColors,
            borderWidth: 1.5,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: { position: 'bottom', labels: { color: tc, font: { size: 12 }, boxWidth: 12, padding: 12 } },
            tooltip: { backgroundColor: '#1c1c22', titleColor: '#f0f0f4', bodyColor: '#8b8b9e', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10 },
          },
        },
      });
    } else {
      const canvas = document.getElementById('chart-results');
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function destroy() {
    if (chartResults) { chartResults.destroy(); chartResults = null; }
  }

  return { render, destroy };
})();
