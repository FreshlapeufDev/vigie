import { renderBanner } from './banner.js';
import { CATEGORIES, SNIPPETS } from './catalog.js';
import { dict, message } from './i18n/index.js';
import { pkg } from './scan.js';
import { BADGES, TONES, c } from './ui.js';

const ORDER = ['critical', 'high', 'medium', 'low', 'info'];
const GRADE_TONE = { 'A+': c.green, A: c.green, B: c.green, C: c.yellow, D: TONES.high, F: c.red };

const badge = (severity, d) => BADGES[severity](` ${d.severities[severity].toUpperCase().padEnd(8)} `);

export function printBanner(lang) {
  console.log(renderBanner('vigie', dict(lang).ui.tagline(pkg.version)));
}

const WIDTH = () => Math.max(60, Math.min(process.stdout.columns || 100, 110));

function wrap(text, indent, first = '') {
  const width = WIDTH() - indent;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  let room = width - first.replace(/\x1b\[[0-9;]*m/g, '').length;
  for (const word of words) {
    if (line && line.length + 1 + word.length > room) {
      lines.push(line);
      line = word;
      room = width;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  const pad = ' '.repeat(indent);
  return lines.map((row, index) => (index === 0 ? `${pad}${first}${row}` : `${pad}${' '.repeat(first.replace(/\x1b\[[0-9;]*m/g, '').length)}${row}`)).join('\n');
}

function gauge(value) {
  const width = 30;
  const filled = Math.round((value / 100) * width);
  const tone = value >= 90 ? c.green : value >= 60 ? c.yellow : value >= 40 ? TONES.high : c.red;
  return tone('━'.repeat(filled)) + c.gray('━'.repeat(width - filled));
}

export function printTarget(result, { lang, quiet, probe }) {
  const d = dict(lang);
  const ui = d.ui;
  const pad = Math.max(ui.target.length, ui.final.length, ui.tls.length, ui.requests.length) + 1;
  const label = (text) => c.gray(text.padEnd(pad));
  console.log(`  ${label(ui.target)}${c.bold(result.url)}`);
  if (!result.reachable) {
    console.log(`  ${label('')}${c.red(`${ui.unreachable} · ${result.error}`)}`);
  } else {
    if (result.finalUrl && result.finalUrl !== result.url) console.log(`  ${label(ui.final)}${result.finalUrl} ${c.gray(`(${result.status})`)}`);
    if (result.tls) console.log(`  ${label(ui.tls)}${result.tls.protocol ?? '?'} ${c.gray('·')} ${result.tls.issuer ?? '?'}${result.tls.validTo ? ` ${c.gray('·')} ${ui.certValid(result.tls.validTo.slice(0, 10))}` : ''}`);
  }
  console.log(`  ${label(ui.requests)}${result.requests} ${c.gray('·')} ${result.durationMs < 1000 ? `${result.durationMs} ms` : `${(result.durationMs / 1000).toFixed(1)} s`}`);
  if (probe === false) console.log(`  ${label('')}${c.gray(ui.probeOff)}`);
  console.log('');

  if (!quiet) {
    for (const finding of result.findings) {
      const cwe = finding.cwe ? c.gray(` CWE-${finding.cwe}`) : '';
      console.log(`    ${badge(finding.severity, d)} ${c.bold(d.rules[finding.rule].title)}${cwe}`);
      console.log(`    ${c.gray(d.categories[finding.category])} ${c.gray('·')} ${c.gray(finding.rule)}`);
      console.log(wrap(message(lang, finding), 4));
      for (const line of finding.evidence.slice(0, 4)) console.log(`    ${c.gray('│')} ${c.dim(line.length > 110 ? `${line.slice(0, 107)}…` : line)}`);
      console.log(c.gray(wrap(d.rules[finding.rule].fix, 4, `${c.green(ui.fix)} `)));
      const snippet = SNIPPETS[finding.rule];
      if (snippet?.nginx) {
        const label = 'nginx';
        snippet.nginx.split('\n').forEach((row, index) => console.log(`    ${c.gray(index === 0 ? label : ' '.repeat(label.length))}  ${c.cyan(row)}`));
      }
      console.log('');
    }
  }

  const counts = ORDER.filter((severity) => result.counts[severity]).map((severity) => TONES[severity](`${result.counts[severity]} ${d.severities[severity]}`));
  const letter = result.grade;
  console.log(`  ${GRADE_TONE[letter](c.bold(`[ ${letter.padEnd(2)} ]`))}  ${gauge(result.score)}  ${c.bold(String(result.score))}${c.gray('/100')}`);
  console.log(`          ${d.verdicts[letter]}`);
  if (counts.length) console.log(`          ${counts.join(c.gray(' · '))}`);
  console.log('');
}

export function printResults(results, { lang, quiet, banner, probe }) {
  if (banner) printBanner(lang);
  results.forEach((result, index) => {
    if (index) console.log(`  ${c.gray('─'.repeat(66))}\n`);
    printTarget(result, { lang, quiet, probe });
  });
}

export function toJson(results, lang) {
  return JSON.stringify(
    {
      tool: 'vigie',
      version: pkg.version,
      lang,
      targets: results.map((result) => ({
        url: result.url,
        finalUrl: result.finalUrl,
        reachable: result.reachable,
        error: result.error,
        grade: result.grade,
        score: result.score,
        counts: result.counts,
        tls: result.tls,
        headers: result.headers,
        findings: result.findings.map((finding) => ({
          rule: finding.rule,
          severity: finding.severity,
          category: finding.category,
          cwe: finding.cwe,
          title: dict(lang).rules[finding.rule].title,
          message: message(lang, finding),
          fix: dict(lang).rules[finding.rule].fix,
          evidence: finding.evidence,
        })),
      })),
    },
    null,
    2,
  );
}

export { CATEGORIES };
