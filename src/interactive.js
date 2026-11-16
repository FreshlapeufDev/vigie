import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { renderBanner } from './banner.js';
import { SNIPPETS } from './catalog.js';
import { toHtml } from './html.js';
import { dict, message, plainText } from './i18n/index.js';
import { normalizeTarget } from './net.js';
import { pkg, scanTarget } from './scan.js';
import { BADGES, TONES, c } from './ui.js';

const STEPS = ['connect', 'transport', 'headers', 'content', 'exposure'];
const LEGACY_CONSOLE = process.platform === 'win32' && !process.env.WT_SESSION && process.env.TERM_PROGRAM !== 'vscode';
const SPINNER = LEGACY_CONSOLE ? ['|', '/', '-', '\\'] : ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const OK = LEGACY_CONSOLE ? '√' : '✔';
const FAIL = LEGACY_CONSOLE ? '×' : '✖';
const GROUPS = [
  ['urgent', ['critical', 'high']],
  ['improve', ['medium', 'low']],
  ['info', ['info']],
];

const GLYPHS = {
  A: ['▄▀▀▄', '█▄▄█', '█  █'],
  B: ['█▀▀▄', '█▀▀▄', '█▄▄▀'],
  C: ['▄▀▀▀', '█   ', '▀▄▄▄'],
  D: ['█▀▀▄', '█  █', '█▄▄▀'],
  F: ['█▀▀▀', '█▀▀ ', '█   '],
  '+': ['    ', '▄█▄ ', ' ▀  '],
};

const subject = (finding) => (finding.rule === 'outdated-library' ? ` (${finding.params.name} ${finding.params.version})` : '');

const GRADE_TONE = { 'A+': c.green, A: c.green, B: c.green, C: c.yellow, D: TONES.high, F: c.red };

const width = () => Math.max(60, Math.min(process.stdout.columns || 100, 104));
const strip = (text) => String(text).replace(/\x1b\[[0-9;]*m/g, '');

function wrap(text, indent, firstWidth = 0) {
  const room = width() - indent;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let limit = room - firstWidth;
  for (const word of words) {
    if (line && line.length + 1 + word.length > limit) {
      lines.push(line);
      line = word;
      limit = room - firstWidth;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

function block(label, text, labelWidth, tone = (s) => s) {
  const pad = '  ';
  const rows = wrap(text, pad.length + labelWidth + 2);
  return rows.map((row, index) => `${pad}${index === 0 ? c.gray(label.padEnd(labelWidth)) : ' '.repeat(labelWidth)}  ${tone(row)}`).join('\n');
}

class Prompt {
  constructor() {
    this.queue = [];
    this.waiting = null;
    this.closed = false;
    this.rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    this.rl.on('line', (line) => {
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve(line);
      } else this.queue.push(line);
    });
    this.rl.on('close', () => {
      this.closed = true;
      if (this.waiting) {
        const resolve = this.waiting;
        this.waiting = null;
        resolve(null);
      }
    });
    this.rl.on('SIGINT', () => {
      this.rl.close();
    });
  }

  ask(label) {
    process.stdout.write(label);
    const echo = (line) => {
      if (line !== null && !process.stdin.isTTY) process.stdout.write(`${line}\n`);
      return line;
    };
    if (this.queue.length) return Promise.resolve(echo(this.queue.shift()));
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      this.waiting = (line) => resolve(echo(line));
    });
  }

  close() {
    this.rl.close();
  }
}

export class App {
  constructor({ lang, timeout = 10000, ca, httpPort, reportDir } = {}) {
    this.lang = lang;
    this.timeout = timeout;
    this.ca = ca;
    this.httpPort = httpPort;
    this.reportDir = reportDir ?? join(homedir(), 'Documents', 'vigie');
    this.tty = Boolean(process.stdout.isTTY);
  }

  get d() {
    return dict(this.lang);
  }

  clear() {
    if (this.tty) process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
  }

  header() {
    this.clear();
    console.log(renderBanner('vigie', this.d.ui.tagline(pkg.version)));
  }

  async run() {
    if (this.tty) process.stdout.write('\x1b]0;vigie · FreshDev\x07');
    this.prompt = new Prompt();
    try {
      while (true) {
        const target = await this.askTarget();
        if (!target) break;
        const probe = await this.askOwner(target);
        if (probe === null) break;
        const result = await this.scan(target, probe);
        const next = await this.results(result, probe);
        if (next !== 'again') break;
      }
    } finally {
      console.log(`\n  ${c.gray(this.d.app.bye)}\n`);
      this.prompt.close();
    }
    return 0;
  }

  async askTarget() {
    let error = null;
    while (true) {
      const a = this.d.app;
      this.header();
      console.log(`  ${a.intro}\n`);
      if (error) console.log(`  ${c.red(FAIL)} ${error}\n`);
      console.log(`  ${c.gray(a.askUrlHint)}`);
      const answer = await this.prompt.ask(`  ${c.cyan('›')} ${c.bold(a.askUrl)} : `);
      if (answer === null) return null;
      const value = answer.trim();
      if (!value) return null;
      if (value.toLowerCase() === a.keys.lang) {
        this.lang = this.lang === 'fr' ? 'en' : 'fr';
        error = null;
        continue;
      }
      try {
        return normalizeTarget(value);
      } catch {
        error = a.invalidUrl(value);
      }
    }
  }

  async askOwner(target) {
    const a = this.d.app;
    console.log('');
    console.log(`  ${c.bold(target.host)}`);
    for (const line of a.ownerHint) console.log(`  ${c.gray(line)}`);
    const answer = await this.prompt.ask(`  ${c.cyan('›')} ${c.bold(a.askOwner)} ${c.gray(a.yesNo)} `);
    if (answer === null) return null;
    return a.yes.includes(answer.trim().toLowerCase());
  }

  async scan(target, probe) {
    const a = this.d.app;
    this.header();
    console.log(`  ${c.bold(a.scanning(target.href))}\n`);
    const states = Object.fromEntries(STEPS.map((step) => [step, 'todo']));
    if (!probe) states.exposure = 'skip';
    let frame = 0;
    let drawn = false;
    const render = () => {
      const lines = STEPS.map((step) => {
        const state = states[step];
        const label = a.steps[step];
        if (state === 'done') return `   ${c.green(OK)} ${label}`;
        if (state === 'active') return `   ${c.cyan(SPINNER[frame % SPINNER.length])} ${c.bold(label)}`;
        if (state === 'skip') return `   ${c.gray('–')} ${c.gray(`${label} · ${a.skipped}`)}`;
        if (state === 'fail') return `   ${c.red(FAIL)} ${label}`;
        return `   ${c.gray('·')} ${c.gray(label)}`;
      });
      if (this.tty) {
        if (drawn) process.stdout.write(`\x1b[${lines.length}A`);
        process.stdout.write(lines.map((line) => `\x1b[2K${line}`).join('\n') + '\n');
        drawn = true;
      }
    };
    const timer = this.tty ? setInterval(() => { frame++; render(); }, 90) : null;
    let current = null;
    const onStep = (step) => {
      if (current && states[current] === 'active') states[current] = 'done';
      if (step === 'done') {
        current = null;
      } else if (states[step] !== undefined && states[step] !== 'skip') {
        states[step] = 'active';
        current = step;
        if (!this.tty) console.log(`   … ${a.steps[step]}`);
      }
      render();
    };
    render();
    let result;
    try {
      result = await scanTarget(target.href, { timeout: this.timeout, probe, ca: this.ca, httpPort: this.httpPort, onStep });
    } finally {
      if (timer) clearInterval(timer);
    }
    if (!result.reachable) {
      for (const step of STEPS) if (states[step] !== 'done' && states[step] !== 'skip') states[step] = step === 'connect' || states[step] === 'active' ? 'fail' : 'todo';
    }
    render();
    return result;
  }

  bigGrade(grade) {
    const letters = grade.split('');
    const tone = GRADE_TONE[grade];
    return [0, 1, 2].map((row) => tone(letters.map((letter) => GLYPHS[letter][row]).join(' ')));
  }

  list(result) {
    const items = [];
    for (const [, severities] of GROUPS) {
      for (const finding of result.findings) if (severities.includes(finding.severity)) items.push(finding);
    }
    return items;
  }

  renderResults(result, probe) {
    const d = this.d;
    const a = d.app;
    this.header();
    console.log(`  ${c.bold(result.finalUrl ?? result.url)}\n`);

    if (!result.reachable) {
      console.log(`  ${c.red(FAIL)} ${c.bold(a.unreachableTitle)}`);
      for (const line of wrap(a.unreachable(result.url, result.error), 4)) console.log(`    ${line}`);
      console.log('');
    }

    const big = this.bigGrade(result.grade);
    const counts = ['critical', 'high', 'medium', 'low', 'info'].filter((severity) => result.counts[severity]).map((severity) => TONES[severity](d.severityCounts(result.counts[severity], severity)));
    const side = [
      `${c.gray(a.grade)}  ${c.bold(`${result.score}`)}${c.gray('/100')}`,
      d.verdicts[result.grade],
      counts.join(c.gray(' · ')),
    ];
    big.forEach((row, index) => console.log(`   ${row}   ${side[index] ?? ''}`));
    console.log('');
    if (!probe && result.reachable) console.log(`  ${c.gray(a.skippedNote)}\n`);

    const items = this.list(result);
    if (!items.length && result.reachable) console.log(`  ${c.green(OK)} ${a.noFindings}\n`);
    let index = 0;
    for (const [group, severities] of GROUPS) {
      const inGroup = items.filter((finding) => severities.includes(finding.severity));
      if (!inGroup.length) continue;
      console.log(`  ${c.bold(a.groups[group].toUpperCase())}`);
      for (const finding of inGroup) {
        index++;
        const number = String(index).padStart(2);
        const badge = TONES[finding.severity]('●');
        console.log(`  ${c.cyan(number)}  ${badge} ${c.bold(`${d.rules[finding.rule].title}${subject(finding)}`)} ${c.gray(`· ${d.severityTitles[finding.severity]}`)}`);
        for (const line of wrap(plainText(this.lang, finding.rule).what, 8)) console.log(`        ${c.gray(line)}`);
      }
      console.log('');
    }
    return items;
  }

  async results(result, probe) {
    let notice = null;
    while (true) {
      const a = this.d.app;
      const items = this.renderResults(result, probe);
      const menu = [items.length ? a.menu.detail(items.length) : null, result.reachable ? a.menu.report : null, a.menu.again, a.menu.quit].filter(Boolean);
      const counts = ['critical', 'high', 'medium', 'low', 'info'].filter((severity) => result.counts[severity]).map((severity) => TONES[severity](this.d.severityCounts(result.counts[severity], severity)));
      console.log(`  ${c.gray('─'.repeat(Math.min(width() - 4, 70)))}`);
      console.log(`  ${GRADE_TONE[result.grade](c.bold(`${a.grade} ${result.grade}`))}  ${c.gray('·')}  ${result.score}${c.gray('/100')}${counts.length ? `  ${c.gray('·')}  ${counts.join(c.gray(' · '))}` : ''}`);
      console.log(`  ${c.gray('─'.repeat(Math.min(width() - 4, 70)))}`);
      const rows = menu.map((entry) => entry.split('  '));
      const keyWidth = Math.max(...rows.map(([key]) => key.length));
      for (const [key, ...rest] of rows) console.log(`  ${c.cyan(key.padEnd(keyWidth))}  ${rest.join('  ')}`);
      if (notice) console.log(`\n  ${notice}`);
      notice = null;
      const answer = await this.prompt.ask(`\n  ${c.cyan('›')} ${c.bold(a.choice)} : `);
      if (answer === null) return 'quit';
      const value = answer.trim().toLowerCase();
      if (value === a.keys.quit || value === 'q') return 'quit';
      if (value === a.keys.again || value === 'n') return 'again';
      if (value === a.keys.lang) {
        this.lang = this.lang === 'fr' ? 'en' : 'fr';
        continue;
      }
      if ((value === a.keys.report || value === 'r') && result.reachable) {
        notice = this.saveReport(result);
        continue;
      }
      const number = Number(value);
      if (Number.isInteger(number) && number >= 1 && number <= items.length) {
        const back = await this.detail(items[number - 1], number, result);
        if (back === null) return 'quit';
      }
    }
  }

  async detail(finding, number, result) {
    const d = this.d;
    const a = d.app;
    const rule = d.rules[finding.rule];
    const plain = plainText(this.lang, finding.rule);
    this.header();
    const tone = TONES[finding.severity];
    const tags = [d.severityTitles[finding.severity].toUpperCase(), d.categories[finding.category], finding.cwe ? `CWE-${finding.cwe}` : null].filter(Boolean);
    console.log(`  ${c.gray(`#${number}`)}  ${BADGES[finding.severity](` ${tags[0]} `)} ${c.gray(tags.slice(1).join(' · '))}`);
    console.log(`  ${c.bold(`${rule.title}${subject(finding)}`)}\n`);
    const labelWidth = Math.max(...Object.values(a.labels).map((label) => label.length));
    console.log(block(a.labels.what, plain.what, labelWidth, c.bold));
    console.log('');
    console.log(block(a.labels.risk, plain.risk, labelWidth, tone));
    console.log('');
    console.log(block(a.labels.seen, message(this.lang, finding), labelWidth));
    for (const line of finding.evidence.slice(0, 6)) {
      const text = line.length > width() - labelWidth - 10 ? `${line.slice(0, width() - labelWidth - 13)}…` : line;
      console.log(`  ${' '.repeat(labelWidth)}  ${c.gray('│')} ${c.dim(text)}`);
    }
    console.log('');
    console.log(block(a.labels.fix, rule.fix, labelWidth, c.green));
    const snippet = SNIPPETS[finding.rule];
    if (snippet) {
      for (const [server, code] of Object.entries(snippet)) {
        const name = server === 'file' ? 'security.txt' : server;
        console.log('');
        code.split('\n').forEach((row, index) => console.log(`  ${' '.repeat(labelWidth)}  ${c.gray((index === 0 ? name : '').padEnd(12))}${c.cyan(row)}`));
      }
    }
    console.log('');
    for (const line of wrap(rule.description, 4)) console.log(`  ${c.gray(line)}`);
    console.log(`\n  ${c.yellow(LEGACY_CONSOLE ? '→' : '➜')} ${a.share}`);
    const answer = await this.prompt.ask(`\n  ${c.gray(a.back)} `);
    return answer;
  }

  saveReport(result) {
    const a = this.d.app;
    try {
      mkdirSync(this.reportDir, { recursive: true });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
      const host = new URL(result.finalUrl ?? result.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
      const file = join(this.reportDir, `vigie-${host}-${stamp}.html`);
      writeFileSync(file, toHtml([result], this.lang));
      const opened = openFile(file);
      return `${c.green(OK)} ${a.reportSaved(file)}${opened ? `\n    ${c.gray(a.reportOpened)}` : ''}`;
    } catch (err) {
      return `${c.red(FAIL)} ${a.reportFailed(err.code || err.message)}`;
    }
  }
}

export function openFile(file) {
  if (process.env.VIGIE_NO_OPEN) return false;
  try {
    const [command, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', `"${file}"`]] : process.platform === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: process.platform === 'win32', shell: false });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
