import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const historyPath = resolve('.jenkins-frontend-trend.json');
const reportsPath = resolve('reports');
const junitPath = resolve(reportsPath, 'frontend-junit.xml');
const maxPoints = 30;

mkdirSync(reportsPath, { recursive: true });

const readHistory = () => {
  if (!existsSync(historyPath)) return [];

  try {
    const parsed = JSON.parse(readFileSync(historyPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const attributeNumber = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}="(\\d+)"`));
  return match ? Number(match[1]) : 0;
};

const readCurrentResults = () => {
  if (!existsSync(junitPath)) return null;

  const xml = readFileSync(junitPath, 'utf8');
  const suiteTags = [...xml.matchAll(/<testsuite\b[^>]*>/g)].map((match) => match[0]);
  const tags = suiteTags.length > 0 ? suiteTags : [...xml.matchAll(/<testsuites\b[^>]*>/g)].map((match) => match[0]);
  const tests = tags.reduce((sum, tag) => sum + attributeNumber(tag, 'tests'), 0);
  const failed = tags.reduce((sum, tag) => sum + attributeNumber(tag, 'failures'), 0);
  const skipped = tags.reduce((sum, tag) => sum + attributeNumber(tag, 'skipped'), 0);

  return {
    total: tests,
    passed: Math.max(0, tests - failed - skipped),
    failed,
    skipped,
  };
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const current = readCurrentResults();
const buildNumber = Number(process.env.BUILD_NUMBER || 0);
const point = {
  build: buildNumber || `local-${Date.now()}`,
  result: process.env.BUILD_RESULT || (current?.failed ? 'FAILURE' : 'SUCCESS'),
  commit: (process.env.GIT_COMMIT || process.env.GITHUB_SHA || 'local').slice(0, 12),
  url: process.env.BUILD_URL || '',
  total: current?.total || 0,
  passed: current?.passed || 0,
  failed: current?.failed || 0,
  skipped: current?.skipped || 0,
  noTests: !current,
  generatedAt: new Date().toISOString(),
};

const history = readHistory()
  .filter((item) => String(item.build) !== String(point.build))
  .concat(point)
  .slice(-maxPoints);

writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`);

const chartData = JSON.stringify(history)
  .replaceAll('<', '\\u003c')
  .replaceAll('\\u2028', '\\u2028')
  .replaceAll('\\u2029', '\\u2029');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frontend test trend</title>
  <style>
    :root { color-scheme: light; font-family: Inter, Segoe UI, Arial, sans-serif; color: #172033; background: #f5f7fb; }
    body { margin: 0; padding: 28px; }
    .shell { max-width: 1180px; margin: auto; background: #fff; border: 1px solid #dce3ef; border-radius: 18px; box-shadow: 0 10px 30px #17203312; overflow: hidden; }
    header { padding: 24px 28px 16px; border-bottom: 1px solid #e7ebf3; display: flex; justify-content: space-between; gap: 16px; align-items: start; }
    h1 { margin: 0 0 6px; font-size: 25px; }
    .muted { color: #647089; font-size: 13px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px 28px 0; }
    button { border: 1px solid #cdd6e6; background: #fff; color: #34415a; border-radius: 999px; padding: 8px 15px; cursor: pointer; font-weight: 600; }
    button:hover, button.active { color: #fff; background: #2563eb; border-color: #2563eb; }
    .chart-wrap { position: relative; padding: 18px 20px 8px; overflow-x: auto; }
    svg { display: block; min-width: 760px; width: 100%; height: 430px; }
    .grid { stroke: #e8edf5; stroke-width: 1; }
    .axis-label { fill: #738097; font-size: 12px; }
    .bar { cursor: pointer; transition: opacity .15s, filter .15s; }
    .bar:hover { opacity: .78; filter: drop-shadow(0 3px 4px #17203333); }
    #tooltip { display: none; position: fixed; z-index: 5; pointer-events: none; min-width: 190px; padding: 12px 14px; border-radius: 10px; color: #fff; background: #172033f2; box-shadow: 0 8px 20px #17203344; font-size: 13px; line-height: 1.55; }
    .legend { display: flex; gap: 18px; padding: 0 28px 20px; color: #536078; font-size: 13px; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(110px, 1fr)); gap: 12px; padding: 0 28px 24px; }
    .card { border: 1px solid #e2e8f2; border-radius: 12px; padding: 13px; background: #fbfcfe; }
    .card strong { display: block; font-size: 22px; margin-top: 3px; }
    .table-wrap { overflow-x: auto; padding: 0 28px 28px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 11px 10px; border-top: 1px solid #e7ebf3; white-space: nowrap; }
    th { color: #647089; font-weight: 700; }
    a { color: #1d4ed8; text-decoration: none; font-weight: 700; }
    a:hover { text-decoration: underline; }
    .success { color: #15803d; font-weight: 700; } .failure { color: #b91c1c; font-weight: 700; } .other { color: #a16207; font-weight: 700; }
    @media (max-width: 680px) { body { padding: 10px; } header, .controls, .legend, .summary, .table-wrap { padding-left: 16px; padding-right: 16px; } .summary { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <div><h1>Frontend test result trend</h1><div class="muted">Interactive history for the last ${maxPoints} Jenkins builds</div></div>
      <div class="muted">Generated ${escapeHtml(new Date().toLocaleString())}</div>
    </header>
    <div class="controls" aria-label="Chart metric">
      <button class="active" data-metric="passed">Passed</button>
      <button data-metric="failed">Failed</button>
      <button data-metric="skipped">Skipped</button>
      <button data-metric="total">Total</button>
    </div>
    <div class="chart-wrap"><svg id="chart" viewBox="0 0 1000 430" role="img" aria-label="Interactive frontend test trend chart"></svg></div>
    <div class="legend"><span><i class="dot" style="background:#2563eb"></i>Passed</span><span><i class="dot" style="background:#dc2626"></i>Failed</span><span><i class="dot" style="background:#d97706"></i>Skipped</span></div>
    <section class="summary" id="summary"></section>
    <div class="table-wrap"><table><thead><tr><th>Build</th><th>Status</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Commit</th></tr></thead><tbody id="rows"></tbody></table></div>
  </main>
  <div id="tooltip"></div>
  <script>
    const points = ${chartData};
    const svg = document.getElementById('chart');
    const tooltip = document.getElementById('tooltip');
    const metricColors = { passed: '#2563eb', failed: '#dc2626', skipped: '#d97706', total: '#475569' };
    let metric = 'passed';
    const ns = 'http://www.w3.org/2000/svg';
    const add = (tag, attrs, parent = svg) => { const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value)); parent.appendChild(node); return node; };
    const showTip = (event, point) => { tooltip.innerHTML = '<strong>Build #' + String(point.build) + '</strong><br>Status: ' + String(point.result) + '<br>Passed: ' + point.passed + '<br>Failed: ' + point.failed + '<br>Skipped: ' + point.skipped + '<br><span style="opacity:.75">Click bar to open build</span>'; tooltip.style.display = 'block'; tooltip.style.left = Math.min(event.clientX + 14, window.innerWidth - 235) + 'px'; tooltip.style.top = Math.min(event.clientY + 14, window.innerHeight - 150) + 'px'; };
    const hideTip = () => { tooltip.style.display = 'none'; };
    const render = () => {
      svg.replaceChildren();
      const left = 58, right = 22, top = 22, bottom = 52, width = 1000, height = 430;
      const plotWidth = width - left - right, plotHeight = height - top - bottom;
      const max = Math.max(1, ...points.map((point) => Math.max(point[metric] || 0, point.total || 0)));
      for (let i = 0; i <= 4; i += 1) { const value = Math.round(max * i / 4); const y = top + plotHeight - (plotHeight * i / 4); add('line', { x1: left, x2: width - right, y1: y, y2: y, class: 'grid' }); const label = add('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', class: 'axis-label' }); label.textContent = value; }
      if (points.length === 0) { const label = add('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'axis-label' }); label.textContent = 'No builds recorded yet'; return; }
      const step = plotWidth / Math.max(points.length, 1);
      const barWidth = Math.min(48, Math.max(12, step * .58));
      points.forEach((point, index) => { const value = point[metric] || 0; const x = left + step * index + step / 2; const barHeight = (value / max) * plotHeight; const rect = add('rect', { x: x - barWidth / 2, y: top + plotHeight - barHeight, width: barWidth, height: Math.max(2, barHeight), rx: 6, fill: metricColors[metric], class: 'bar' }); rect.addEventListener('mouseenter', (event) => showTip(event, point)); rect.addEventListener('mousemove', (event) => showTip(event, point)); rect.addEventListener('mouseleave', hideTip); rect.addEventListener('click', () => { if (point.url) window.open(point.url, '_blank', 'noopener'); }); const label = add('text', { x, y: height - 22, 'text-anchor': 'middle', class: 'axis-label' }); label.textContent = '#' + point.build; });
    };
    const renderSummary = () => { const latest = points[points.length - 1]; const items = latest ? [['Latest build', '#' + latest.build], ['Passed', latest.passed], ['Failed', latest.failed], ['Skipped', latest.skipped]] : [['Latest build', '—'], ['Passed', 0], ['Failed', 0], ['Skipped', 0]]; document.getElementById('summary').innerHTML = items.map(([label, value]) => '<div class="card"><span class="muted">' + label + '</span><strong>' + value + '</strong></div>').join(''); };
    const renderRows = () => { document.getElementById('rows').innerHTML = [...points].reverse().map((point) => { const statusClass = point.result === 'SUCCESS' ? 'success' : point.result === 'FAILURE' ? 'failure' : 'other'; const build = point.url ? '<a href="' + point.url + '" target="_blank" rel="noopener">#' + point.build + '</a>' : '#' + point.build; return '<tr><td>' + build + '</td><td class="' + statusClass + '">' + point.result + '</td><td>' + point.passed + '</td><td>' + point.failed + '</td><td>' + point.skipped + '</td><td title="' + point.commit + '">' + point.commit + '</td></tr>'; }).join(''); };
    document.querySelectorAll('[data-metric]').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('[data-metric]').forEach((item) => item.classList.remove('active')); button.classList.add('active'); metric = button.dataset.metric; render(); }));
    render(); renderSummary(); renderRows();
  </script>
</body>
</html>
`;

writeFileSync(resolve(reportsPath, 'frontend-trend.html'), html);
console.log(`Interactive frontend trend generated for build ${point.build}: ${point.passed} passed, ${point.failed} failed, ${point.skipped} skipped.`);
