import { createHash } from 'node:crypto';
import { CATEGORIES, SNIPPETS } from './catalog.js';
import { LANGS, LANG_CODES, message } from './i18n/index.js';
import { pkg } from './scan.js';

const LOGO = [
  '███████╗██████╗ ███████╗███████╗██╗  ██╗██████╗ ███████╗██╗   ██╗',
  '██╔════╝██╔══██╗██╔════╝██╔════╝██║  ██║██╔══██╗██╔════╝██║   ██║',
  '█████╗  ██████╔╝█████╗  ███████╗███████║██║  ██║█████╗  ██║   ██║',
  '██╔══╝  ██╔══██╗██╔══╝  ╚════██║██╔══██║██║  ██║██╔══╝  ╚██╗ ██╔╝',
  '██║     ██║  ██║███████╗███████║██║  ██║██████╔╝███████╗ ╚████╔╝ ',
  '╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝  ╚═══╝  ',
].join('\n');

const STYLE = `
:root {
  --desk: #ecebe6;
  --paper: #fffefb;
  --ink: #1d1d1b;
  --ink-2: #4a4a46;
  --mute: #7c7b74;
  --hair: #d9d6cd;
  --hair-2: #ebe8e0;
  --brand: #0d6b5d;
  --brand-soft: #e3f0ec;
  --critical: #a8231b;
  --high: #b9530b;
  --medium: #9a7200;
  --low: #2c62a8;
  --info: #6b6b66;
  --serif: 'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', 'URW Palladio L', Georgia, serif;
  --sans: 'Segoe UI', 'Helvetica Neue', Arial, system-ui, sans-serif;
  --mono: Consolas, 'Cascadia Mono', 'SF Mono', 'DejaVu Sans Mono', monospace;
  color-scheme: light;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { background: var(--desk); }
body { background: var(--desk); color: var(--ink); font: 15px/1.6 var(--sans); -webkit-font-smoothing: antialiased; }
body[data-lang="en"] .l[lang="fr"], body[data-lang="fr"] .l[lang="en"] { display: none; }
a { color: var(--brand); text-decoration: none; }
a:hover { text-decoration: underline; }
.controls { position: sticky; top: 0; z-index: 5; background: rgba(236, 235, 230, .94); backdrop-filter: blur(6px); border-bottom: 1px solid var(--hair); }
.controls__inner { max-width: 940px; margin: 0 auto; padding: 10px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 13px; color: var(--ink-2); }
.controls__doc { font-family: var(--serif); font-size: 14px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.controls__tools { display: flex; align-items: center; gap: 22px; white-space: nowrap; }
.switch { display: inline-flex; gap: 2px; align-items: center; }
.switch button, .print { font: inherit; color: var(--ink-2); background: none; border: 0; cursor: pointer; padding: 2px 4px; }
.switch button[aria-pressed="true"] { color: var(--ink); font-weight: 600; text-decoration: underline; text-decoration-color: var(--brand); text-decoration-thickness: 2px; text-underline-offset: 5px; }
.switch span { color: var(--hair); }
.print:hover, .switch button:hover { color: var(--brand); }
.sheet { max-width: 940px; margin: 36px auto 64px; background: var(--paper); box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 12px 40px rgba(40, 38, 30, .08); }
.page { padding: 72px 96px; }
.page + .page { border-top: 1px solid var(--hair); }
.cover { min-height: 760px; display: flex; flex-direction: column; }
.cover__brand { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.logo { font: 4.2px/1.05 var(--mono); color: var(--brand); white-space: pre; user-select: none; letter-spacing: 0; }
.distribution { font-size: 12px; color: var(--mute); text-align: right; line-height: 1.5; }
.cover__title { margin-top: 140px; }
.eyebrow { font-size: 13px; color: var(--brand); font-weight: 600; letter-spacing: .02em; margin-bottom: 18px; }
.cover h1 { font: 400 46px/1.08 var(--serif); letter-spacing: -.01em; margin-bottom: 14px; }
.cover__target { font: italic 400 22px/1.3 var(--serif); color: var(--ink-2); word-break: break-word; }
.facts { margin-top: 72px; border-top: 1px solid var(--ink); }
.facts div { display: grid; grid-template-columns: 180px 1fr; gap: 24px; padding: 11px 0; border-bottom: 1px solid var(--hair); font-size: 14px; }
.facts dt { color: var(--mute); }
.facts dd { color: var(--ink); }
.risk { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.risk__label { font-weight: 600; }
.scale { display: inline-grid; grid-template-columns: repeat(4, 34px); gap: 3px; }
.scale i { height: 8px; background: var(--hair-2); }
.scale i.on { background: var(--risk); }
.cover__foot { margin-top: auto; padding-top: 72px; font-size: 12px; color: var(--mute); display: flex; justify-content: space-between; gap: 16px; }
.r-A, .r-B { --risk: #3d7a4f; } .r-C { --risk: var(--medium); } .r-D { --risk: var(--high); } .r-F { --risk: var(--critical); }
h2 { font: 400 30px/1.2 var(--serif); margin-bottom: 26px; display: grid; grid-template-columns: 52px 1fr; align-items: baseline; }
h2 .num { font: 400 30px/1 var(--serif); color: var(--brand); }
h3 { font: 600 17px/1.35 var(--serif); margin: 38px 0 14px; display: flex; align-items: baseline; gap: 10px; }
h3 .count { font: 400 13px var(--sans); color: var(--mute); }
.prose { max-width: 640px; }
.prose p + p { margin-top: 12px; }
.lead { font: 400 19px/1.55 var(--serif); color: var(--ink); max-width: 680px; }
.statement { margin-top: 22px; padding-left: 18px; border-left: 3px solid var(--risk); max-width: 640px; color: var(--ink-2); }
.toc ol { list-style: none; counter-reset: toc; max-width: 640px; }
.toc li { display: flex; align-items: baseline; gap: 10px; padding: 7px 0; font-size: 15px; }
.toc li .n { color: var(--brand); font-family: var(--serif); min-width: 28px; }
.toc li .leader { flex: 1; border-bottom: 1px dotted var(--hair); transform: translateY(-4px); }
.toc li .meta { color: var(--mute); font-size: 13px; }
.toc a { color: var(--ink); }
.priorities { list-style: none; counter-reset: p; max-width: 680px; border-top: 1px solid var(--ink); }
.priorities li { counter-increment: p; display: grid; grid-template-columns: 36px 1fr auto; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--hair); align-items: baseline; }
.priorities li::before { content: counter(p); font-family: var(--serif); color: var(--brand); }
.priorities .what { font-weight: 500; }
.priorities .where { display: block; font-size: 13px; color: var(--mute); margin-top: 2px; font-family: var(--mono); word-break: break-all; }
.priorities .sev { font-size: 12px; white-space: nowrap; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
.matrix { border-top: 1.5px solid var(--ink); border-bottom: 1.5px solid var(--ink); }
.matrix th, .matrix td { padding: 9px 10px; text-align: right; border-bottom: 1px solid var(--hair-2); }
.matrix th:first-child, .matrix td:first-child { text-align: left; padding-left: 0; }
.matrix thead th { font-weight: 600; border-bottom: 1px solid var(--ink); font-size: 13px; }
.matrix tfoot td { font-weight: 600; border-top: 1px solid var(--ink); border-bottom: 0; }
.matrix td.zero { color: #c9c6bc; }
.matrix td.hot { font-weight: 600; color: var(--sev); }
.sev { color: var(--sev); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--sev); margin-right: 7px; transform: translateY(-1px); }
.filters { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: var(--ink-2); margin: -6px 0 8px; align-items: center; }
.filters label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.filters input { accent-color: var(--brand); }
.group[hidden], .finding[hidden] { display: none; }
.finding { position: relative; padding: 26px 0 30px; border-top: 1px solid var(--hair); }
.finding:first-of-type { border-top: 1px solid var(--ink); }
.fid { position: absolute; left: -84px; top: 30px; width: 64px; text-align: right; font: 600 12px/1.3 var(--mono); color: var(--brand); }
.finding h4 { font: 600 19px/1.35 var(--serif); margin-bottom: 14px; padding-right: 110px; }
.finding .badge { position: absolute; right: 0; top: 30px; font-size: 12px; font-weight: 600; color: var(--sev); }
.meta { display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 4px 34px; font-size: 13px; margin-bottom: 18px; }
.meta dt { color: var(--mute); font-size: 12px; }
.meta dd { font-family: var(--mono); font-size: 12.5px; color: var(--ink); word-break: break-all; }
.block { display: grid; grid-template-columns: 132px 1fr; gap: 20px; margin-top: 12px; }
.block > span { font-size: 12px; color: var(--mute); padding-top: 3px; }
.block p { max-width: 600px; }
.evidence { font: 12.5px/1.7 var(--mono); background: #f7f6f1; border: 1px solid var(--hair-2); overflow-x: auto; padding: 8px 0; }
.evidence div { display: grid; grid-template-columns: 52px 1fr; white-space: pre; }
.evidence .n { text-align: right; padding-right: 16px; color: #aaa79d; user-select: none; }
.evidence .hit { background: #fbeee9; }
.evidence .hit .n { color: var(--sev); font-weight: 600; }
.evidence .hit .n::before { content: '▸ '; }
.fix { color: var(--ink); }
.nothing { color: var(--mute); font-style: italic; }
.scope td, .scope th { padding: 9px 10px; border-bottom: 1px solid var(--hair-2); text-align: left; vertical-align: baseline; }
.scope th { font-weight: 600; font-size: 13px; border-bottom: 1px solid var(--ink); }
.scope { border-top: 1.5px solid var(--ink); border-bottom: 1.5px solid var(--ink); margin-bottom: 34px; }
.scope td:first-child, .scope th:first-child { padding-left: 0; }
.scope td.num, .scope th.num { text-align: right; }
.scope .ok { color: #3d7a4f; }
.colophon { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--hair); font-size: 12px; color: var(--mute); display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.snippets { display: grid; gap: 8px; margin-top: 10px; max-width: 640px; }
.snippet { border: 1px solid var(--hair-2); background: #f7f6f1; }
.snippet b { display: block; font: 600 10.5px/1 var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--mute); padding: 7px 10px 0; }
.snippet pre { font: 12px/1.6 var(--mono); padding: 6px 10px 8px; white-space: pre-wrap; word-break: break-all; color: var(--ink); }
.evidence.lines div { grid-template-columns: 1fr; padding: 0 14px; white-space: pre-wrap; word-break: break-all; }
.grade-big { font: 400 64px/1 var(--serif); color: var(--risk); margin-right: 6px; }
.target { margin-top: 30px; }
.target h4 { font: 600 16px/1.3 var(--serif); margin-bottom: 10px; word-break: break-all; }
.kv { border-top: 1px solid var(--ink); font-size: 13px; margin-bottom: 18px; }
.kv div { display: grid; grid-template-columns: 220px 1fr; gap: 16px; padding: 6px 0; border-bottom: 1px solid var(--hair-2); }
.kv dt { color: var(--mute); font-family: var(--mono); font-size: 12px; }
.kv dd { font-family: var(--mono); font-size: 12px; word-break: break-all; }
.r-Ap { --risk: #3d7a4f; }
@media (max-width: 760px) { .kv div { grid-template-columns: 1fr; gap: 2px; } .grade-big { font-size: 48px; } }
.sev-critical { --sev: var(--critical); } .sev-high { --sev: var(--high); } .sev-medium { --sev: var(--medium); } .sev-low { --sev: var(--low); } .sev-info { --sev: var(--info); }
@media (max-width: 1100px) {
  .fid { position: static; width: auto; text-align: left; display: block; margin-bottom: 6px; }
}
@media (max-width: 760px) {
  .controls__inner { padding: 10px 16px; }
  .controls__doc { display: none; }
  .sheet { margin: 0; box-shadow: none; }
  .page { padding: 40px 20px; }
  .cover { min-height: 0; }
  .cover__title { margin-top: 64px; }
  .cover h1 { font-size: 34px; }
  .logo { font-size: 3.2px; }
  .facts div { grid-template-columns: 1fr; gap: 2px; }
  h2 { grid-template-columns: 40px 1fr; font-size: 25px; }
  .meta { grid-template-columns: repeat(2, auto); }
  .block { grid-template-columns: 1fr; gap: 4px; }
  .finding h4 { padding-right: 0; }
  .finding .badge { position: static; display: block; margin-bottom: 6px; }
  .matrix { font-size: 12.5px; }
  .matrix th, .matrix td { padding: 8px 5px; }
  .priorities li { grid-template-columns: 28px 1fr; }
  .priorities .sev { grid-column: 2; }
}
@media print {
  @page { size: A4; margin: 15mm 14mm 16mm; }
  :root { --paper: #fff; }
  html, body { background: #fff; font-size: 9.5pt; line-height: 1.45; }
  .controls, .filters { display: none; }
  .sheet { margin: 0; box-shadow: none; max-width: none; background: #fff; }
  .page { padding: 0; border: 0 !important; }
  .page + .page { break-before: page; }
  #matrix { break-before: avoid; margin-top: 14mm; }
  .cover { min-height: 255mm; }
  .cover__title { margin-top: 60mm; }
  .cover h1 { font-size: 30pt; }
  .logo { font-size: 3.6px; }
  h2 { font-size: 20pt; margin-bottom: 14px; }
  h2 .num { font-size: 20pt; }
  h3 { font-size: 12pt; margin: 18px 0 8px; }
  .lead { font-size: 12pt; }
  .finding { break-inside: avoid; padding: 12px 0 14px; }
  .finding h4 { font-size: 12pt; margin-bottom: 8px; }
  .finding .badge { top: 14px; font-size: 8.5pt; }
  .meta { margin-bottom: 8px; gap: 2px 26px; }
  .meta dt { font-size: 7.5pt; }
  .meta dd { font-size: 8pt; }
  .block { grid-template-columns: 26mm 1fr; gap: 10px; margin-top: 5px; }
  .block > span { font-size: 8pt; padding-top: 1px; }
  .evidence { font-size: 7.6pt; line-height: 1.5; padding: 4px 0; overflow: hidden; }
  .evidence div { white-space: pre-wrap; word-break: break-all; }
  .finding[hidden], .group[hidden] { display: block; }
  .fid { position: static; display: block; text-align: left; width: auto; margin-bottom: 2px; font-size: 8pt; }
  .priorities li { padding: 7px 0; }
  .matrix th, .matrix td, .scope th, .scope td { padding: 5px 8px; }
  a { color: var(--ink); }
}
`;

const SCRIPT = `
(() => {
  const body = document.body;
  const buttons = [...document.querySelectorAll('[data-set-lang]')];
  const titles = JSON.parse(document.getElementById('titles').textContent);
  const setLang = (lang) => {
    body.dataset.lang = lang;
    document.documentElement.lang = lang;
    document.title = titles[lang];
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)));
    try { localStorage.setItem('fxguard-lang', lang); } catch (e) {}
  };
  let saved = null;
  try { saved = localStorage.getItem('fxguard-lang'); } catch (e) {}
  if (saved && titles[saved]) setLang(saved);
  buttons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.setLang)));
  document.querySelector('.print').addEventListener('click', () => window.print());
  const boxes = [...document.querySelectorAll('.filters input')];
  const apply = () => {
    const on = new Set(boxes.filter((b) => b.checked).map((b) => b.value));
    document.querySelectorAll('.group').forEach((g) => { g.hidden = !on.has(g.dataset.sev); });
  };
  boxes.forEach((b) => b.addEventListener('change', apply));
})();
`;

const ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const both = (pick) => LANG_CODES.map((code) => `<span class="l" lang="${code}">${pick(LANGS[code], code)}</span>`).join('');

const plain = (pick) => Object.fromEntries(LANG_CODES.map((code) => [code, pick(LANGS[code], code)]));

const riskClass = (grade) => (grade === 'A+' ? 'Ap' : grade);

function reference(results, when) {
  const hash = createHash('sha256').update(`${results.map((result) => result.url).join(',')}|${when.toISOString()}`).digest('hex');
  return `VG-${when.toISOString().slice(0, 10).replace(/-/g, '')}-${hash.slice(0, 4).toUpperCase()}`;
}

function snippetBlock(rule) {
  const snippet = SNIPPETS[rule];
  if (!snippet) return '';
  const parts = Object.entries(snippet).map(([name, code]) => `<div class="snippet"><b>${name === 'file' ? '/.well-known/security.txt' : name}</b><pre>${esc(code)}</pre></div>`);
  return `<div class="snippets">${parts.join('')}</div>`;
}

function renderFinding(finding, id, result) {
  const cwe = finding.cwe ? `<a href="https://cwe.mitre.org/data/definitions/${finding.cwe}.html" target="_blank" rel="noopener">CWE-${finding.cwe}</a>` : '—';
  const block = (label, content) => `<div class="block"><span>${both((d) => d.report[label])}</span>${content}</div>`;
  const evidence = finding.evidence.length ? `<div class="evidence lines">${finding.evidence.map((line) => `<div>${esc(line)}</div>`).join('')}</div>` : '';
  return `<article class="finding sev-${finding.severity}" id="${id}">
<span class="fid">${id}</span>
<span class="badge"><span class="dot"></span>${both((d) => d.severityTitles[finding.severity])}</span>
<h4>${both((d) => esc(d.rules[finding.rule].title))}</h4>
<dl class="meta">
<div><dt>${both((d) => d.report.rule)}</dt><dd>${esc(finding.rule)}</dd></div>
<div><dt>${both((d) => d.report.location)}</dt><dd>${esc(new URL(result.finalUrl ?? result.url).host)}</dd></div>
<div><dt>${both((d) => d.report.category)}</dt><dd>${both((d) => esc(d.categories[finding.category]))}</dd></div>
<div><dt>${both((d) => d.report.weakness)}</dt><dd>${cwe}</dd></div>
</dl>
${block('description', `<p>${both((d) => esc(d.rules[finding.rule].description))}</p>`)}
${block('observation', `<p>${both((d, code) => esc(message(code, finding)))}</p>`)}
${evidence ? block('evidence', evidence) : ''}
${block('recommendation', `<div><p class="fix">${both((d) => esc(d.rules[finding.rule].fix))}</p>${snippetBlock(finding.rule)}</div>`)}
</article>`;
}

function targetDetails(result) {
  const rows = [];
  if (result.tls) {
    rows.push(['TLS', `${result.tls.protocol ?? '?'} · ${result.tls.cipher ?? '?'}`]);
    rows.push([both((d) => d.report.certificate), `${result.tls.subject ?? '?'} · ${result.tls.issuer ?? '?'} · ${result.tls.validTo ? result.tls.validTo.slice(0, 10) : '?'}`]);
  }
  const redirects = result.redirects.map((hop) => `${hop.status ?? hop.error} ${hop.url}`).join('\n');
  const headers = Object.entries(result.headers).map(([name, value]) => `<div><dt>${esc(name)}</dt><dd>${esc(value)}</dd></div>`).join('');
  return `<section class="target"><h4>${esc(result.url)}</h4>
<dl class="kv">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}<div><dt>${both((d) => d.report.redirects)}</dt><dd style="white-space:pre-wrap">${esc(redirects || '—')}</dd></div></dl>
${headers ? `<p class="eyebrow" style="margin:0 0 8px">${both((d) => d.report.headersTitle)}</p><dl class="kv">${headers}</dl>` : ''}
</section>`;
}

export function toHtml(results, lang = 'en') {
  const when = new Date();
  const ref = reference(results, when);
  const all = results.flatMap((result) => result.findings.map((finding) => ({ finding, result })));
  const counts = Object.fromEntries(ORDER.map((severity) => [severity, all.filter(({ finding }) => finding.severity === severity).length]));
  const total = all.length;
  const worst = results.reduce((acc, result) => (GRADES.indexOf(result.grade) > GRADES.indexOf(acc) ? result.grade : acc), 'A+');
  const lowest = Math.min(...results.map((result) => result.score));
  const name = results.length > 1 ? results.map((result) => result.host).join(', ') : results[0].host;
  const requests = results.reduce((sum, result) => sum + result.requests, 0);

  const ordered = ORDER.flatMap((severity) => all.filter(({ finding }) => finding.severity === severity));
  const width = Math.max(2, String(total).length);
  const ids = new Map(ordered.map((item, index) => [item, `VG-${String(index + 1).padStart(width, '0')}`]));

  const titles = plain((d) => `${d.report.documentTitle} · ${name} · ${ref}`);
  const dates = plain((d, code) => new Intl.DateTimeFormat(code === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(when));
  const breakdown = (d) => ORDER.filter((severity) => counts[severity]).map((severity) => [d.severities[severity], counts[severity]]);
  const summary = both((d) => esc(d.report.summary({ targets: results.length, requests, total, breakdown: breakdown(d) })));

  const seen = new Set();
  const priorities = ordered.filter(({ finding }) => finding.severity !== 'info' && !seen.has(finding.rule) && seen.add(finding.rule)).slice(0, 5);
  const prioritiesHtml = priorities.length
    ? `<ol class="priorities">${priorities.map((item) => `<li class="sev-${item.finding.severity}"><div><a class="what" href="#${ids.get(item)}">${both((d) => esc(d.rules[item.finding.rule].title))}</a><span class="where">${esc(item.result.host)} · ${both((d) => esc(d.rules[item.finding.rule].fix))}</span></div><span class="sev"><span class="dot"></span>${both((d) => d.severityTitles[item.finding.severity])}</span></li>`).join('')}</ol>`
    : `<p class="nothing">${both((d) => d.report.noPriorities)}</p>`;

  const matrixHead = `<tr><th>${both((d) => d.report.category)}</th>${ORDER.map((severity) => `<th class="sev-${severity}"><span class="dot"></span>${both((d) => d.severityTitles[severity])}</th>`).join('')}<th>${both((d) => d.report.total)}</th></tr>`;
  const matrixRows = CATEGORIES.map((category) => {
    const cells = ORDER.map((severity) => {
      const n = all.filter(({ finding }) => finding.category === category && finding.severity === severity).length;
      return `<td class="sev-${severity} ${n ? 'hot' : 'zero'}">${n}</td>`;
    }).join('');
    return `<tr><td>${both((d) => esc(d.categories[category]))}</td>${cells}<td>${all.filter(({ finding }) => finding.category === category).length}</td></tr>`;
  }).join('');
  const matrixFoot = `<tr><td>${both((d) => d.report.total)}</td>${ORDER.map((severity) => `<td>${counts[severity]}</td>`).join('')}<td>${total}</td></tr>`;

  const groups = ORDER.filter((severity) => counts[severity]).map((severity, index) => {
    const items = ordered.filter(({ finding }) => finding.severity === severity);
    return `<section class="group sev-${severity}" data-sev="${severity}"><h3><span>3.${index + 1}</span> ${both((d) => d.severityTitles[severity])} <span class="count">${both((d) => d.ui.findings(items.length))}</span></h3>${items.map((item) => renderFinding(item.finding, ids.get(item), item.result)).join('')}</section>`;
  }).join('');
  const filters = total
    ? `<div class="filters"><span>${both((d) => d.report.filter)}</span>${ORDER.filter((severity) => counts[severity]).map((severity) => `<label class="sev-${severity}"><input type="checkbox" value="${severity}" checked><span class="dot"></span>${both((d) => d.severityTitles[severity])} (${counts[severity]})</label>`).join('')}</div>`
    : '';

  const scopeRows = results.map((result) => `<tr><td>${esc(result.url)}</td><td class="r-${riskClass(result.grade)}"><b style="color:var(--risk)">${esc(result.grade)}</b></td><td class="num">${result.reachable ? result.score : '—'}</td><td class="num">${result.findings.length}</td><td>${result.reachable ? esc(result.finalUrl) : `<span style="color:var(--critical)">${both((d) => d.report.unreachable)} (${esc(result.error)})</span>`}</td></tr>`).join('');

  const toc = [
    ['1', 'summary', '#summary', ''],
    ['2', 'matrix', '#matrix', ''],
    ['3', 'findings', '#findings', both((d) => d.ui.findings(total))],
    ['4', 'scope', '#scope', ''],
  ].map(([n, key, href, extra]) => `<li><span class="n">${n}</span><a href="${href}">${both((d) => d.report.sections[key])}</a><span class="leader"></span><span class="meta">${extra}</span></li>`).join('');


  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="vigie ${pkg.version}">
<title>${esc(titles[lang])}</title>
<style>${STYLE}</style>
</head>
<body data-lang="${lang}" class="r-${riskClass(worst)}">
<div class="controls"><div class="controls__inner">
<span class="controls__doc">${both((d) => d.report.documentTitle)} — ${esc(name)}</span>
<span class="controls__tools">
<span class="switch" role="group" aria-label="Language / Langue">${LANG_CODES.map((code, i) => `${i ? '<span>|</span>' : ''}<button type="button" data-set-lang="${code}" aria-pressed="${code === lang}" lang="${code}">${code.toUpperCase()}</button>`).join('')}</span>
<button type="button" class="print">${both((d) => d.report.print)}</button>
</span>
</div></div>

<main class="sheet">
<section class="page cover">
<div class="cover__brand">
<pre class="logo" aria-label="FreshDev">${LOGO}</pre>
<div class="distribution">${esc(ref)}<br>${both((d, code) => esc(dates[code]))}</div>
</div>
<div class="cover__title">
<p class="eyebrow">vigie ${pkg.version}</p>
<h1>${both((d) => d.report.documentTitle)}</h1>
<p class="cover__target">${esc(name)}</p>
</div>
<dl class="facts">
<div><dt>${both((d) => d.report.reference)}</dt><dd>${esc(ref)}</dd></div>
<div><dt>${both((d) => d.report.date)}</dt><dd>${both((d, code) => esc(dates[code]))}</dd></div>
<div><dt>${both((d) => d.report.scope)}</dt><dd>${results.map((result) => esc(result.url)).join('<br>')}</dd></div>
<div><dt>${both((d) => d.report.tool)}</dt><dd>vigie ${pkg.version} · ${requests} HTTP</dd></div>
<div><dt>${both((d) => d.report.overallRisk)}</dt><dd class="risk"><span class="grade-big">${esc(worst)}</span><span>${both((d) => d.report.scoreOf(lowest))}<br><span style="color:var(--mute)">${both((d) => esc(d.verdicts[worst]))}</span></span></dd></div>
</dl>
<div class="cover__foot"><span>${both((d) => d.report.preparedWith)}</span><span>${esc(ref)}</span></div>
</section>

<section class="page toc">
<h2><span class="num">—</span>${both((d) => d.report.contents)}</h2>
<ol>${toc}</ol>
</section>

<section class="page" id="summary">
<h2><span class="num">1</span>${both((d) => d.report.sections.summary)}</h2>
<p class="lead">${summary}</p>
<p class="statement">${both((d) => esc(d.report.statement[worst]))}</p>
<h3>${both((d) => d.report.priorities)}</h3>
${prioritiesHtml}
</section>

<section class="page" id="matrix">
<h2><span class="num">2</span>${both((d) => d.report.sections.matrix)}</h2>
<table class="matrix"><thead>${matrixHead}</thead><tbody>${matrixRows}</tbody><tfoot>${matrixFoot}</tfoot></table>
</section>

<section class="page" id="findings">
<h2><span class="num">3</span>${both((d) => d.report.sections.findings)}</h2>
${filters}
${groups || `<p class="nothing">${both((d) => d.report.noFindings)}</p>`}
</section>

<section class="page" id="scope">
<h2><span class="num">4</span>${both((d) => d.report.sections.scope)}</h2>
<div class="prose"><p>${both((d) => d.report.scopeIntro)}</p></div>
<table class="scope" style="margin-top:20px"><thead><tr><th>${both((d) => d.report.website)}</th><th>${both((d) => d.report.grade)}</th><th class="num">${both((d) => d.report.score)}</th><th class="num">${both((d) => d.report.findingsCol)}</th><th>${both((d) => d.report.landed)}</th></tr></thead><tbody>${scopeRows}</tbody></table>
${results.filter((result) => result.reachable).map(targetDetails).join('')}
<h3>${both((d) => d.report.method)}</h3>
<div class="prose"><p>${both((d) => esc(d.report.methodText))}</p></div>
<h3>${both((d) => d.report.limits)}</h3>
<div class="prose"><p>${both((d) => esc(d.report.limitsText))}</p></div>
<div class="colophon"><span>${both((d) => d.report.preparedWith)} · vigie ${pkg.version}</span><span>${esc(ref)}</span></div>
</section>
</main>
<script type="application/json" id="titles">${JSON.stringify(titles).replace(/</g, '\\u003c')}</script>
<script>${SCRIPT}</script>
</body>
</html>
`;
}
