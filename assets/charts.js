/**
 * Chart.js wrapper — manages lifecycle of chart instances and provides
 * theme-aware configuration helpers.
 *
 * Depends on Chart.js loaded globally via CDN (window.Chart).
 */

/* global Chart */

/** @type {Map<string, Chart>} */
const _instances = new Map();

export const PALETTE = ['#5b8af5', '#22d3ee', '#34d399', '#f59e0b', '#f87171', '#a78bfa'];

/**
 * Return current theme-aware chart colors.
 * @returns {{ text: string, grid: string, tooltipBg: string, tooltipBorder: string }}
 */
export function getChartTheme() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  return {
    text:          isDark ? '#8b8b9e' : '#666672',
    grid:          isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    tooltipBg:     isDark ? '#242430' : '#f0efeb',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.15)',
  };
}

/**
 * Build standard tooltip plugin options.
 * @returns {object}
 */
export function tooltipConfig() {
  const t = getChartTheme();
  return {
    backgroundColor: t.tooltipBg,
    titleColor: document.documentElement.dataset.theme !== 'light' ? '#f0f0f4' : '#111111',
    bodyColor: t.text,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    padding: 12,
    cornerRadius: 8,
    boxPadding: 4,
  };
}

/**
 * Build standard scale options for line/bar charts.
 * @returns {object}
 */
export function scalesConfig() {
  const t = getChartTheme();
  return {
    x: {
      ticks: { color: t.text, font: { size: 11 } },
      grid:  { color: t.grid },
      border: { color: 'transparent' },
    },
    y: {
      ticks: { color: t.text, font: { size: 11 }, precision: 0 },
      grid:  { color: t.grid },
      border: { color: 'transparent' },
      beginAtZero: true,
    },
  };
}

/**
 * Initialize or replace a chart on a canvas element.
 * Destroys any existing chart instance on the same canvas.
 *
 * @param {string} id - Canvas element ID
 * @param {object} config - Full Chart.js configuration object
 * @returns {Chart|null} New chart instance, or null if canvas not found
 */
export function initChart(id, config) {
  destroyChart(id);

  const canvas = document.getElementById(id);
  if (!canvas) return null;

  /* Inject standard animation duration */
  config.options ??= {};
  config.options.animation ??= {};
  if (!config.options.animation.duration) {
    config.options.animation.duration = 800;
  }

  /* Respect prefers-reduced-motion */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    config.options.animation = { duration: 0 };
  }

  const chart = new Chart(canvas, config);
  _instances.set(id, chart);
  return chart;
}

/**
 * Update the data of an existing chart and trigger a re-render.
 * @param {string} id - Canvas element ID
 * @param {object} data - Chart.js data object (labels + datasets)
 */
export function updateChart(id, data) {
  const chart = _instances.get(id);
  if (!chart) return;
  chart.data = data;
  chart.update('active');
}

/**
 * Destroy a chart instance and remove it from the registry.
 * @param {string} id - Canvas element ID
 */
export function destroyChart(id) {
  const chart = _instances.get(id);
  if (chart) {
    chart.destroy();
    _instances.delete(id);
  }
}

/**
 * Destroy all registered chart instances (e.g. on full re-render).
 */
export function destroyAll() {
  _instances.forEach((chart, id) => { chart.destroy(); _instances.delete(id); });
}
