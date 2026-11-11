import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from './args.js';
import { FxError } from './errors.js';
import { toHtml } from './html.js';
import { detectLang, dict, normalizeLang } from './i18n/index.js';
import { normalizeTarget } from './net.js';
import { printBanner, printResults, toJson } from './report.js';
import { pkg, scanAll } from './scan.js';
import { c } from './ui.js';

const GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'];

export async function run(argv) {
  const { positional, flags } = parseArgs(argv);
  let lang = detectLang();
  if (flags.lang !== undefined) {
    const code = normalizeLang(flags.lang === true ? '' : flags.lang);
    if (!code) throw new FxError(dict(lang).errors.invalidLang(flags.lang), 'en, fr');
    lang = code;
  }
  const d = dict(lang);
  const e = d.errors;

  if (flags.version || flags.v) {
    console.log(pkg.version);
    return 0;
  }
  const wantsHelp = flags.help || flags.h || positional[0] === 'help';
  const optionsOnly = Object.keys(flags).some((key) => !['lang', 'no-banner', 'no-color'].includes(key));
  if (!wantsHelp && positional.length === 0 && optionsOnly) throw new FxError(e.noTarget, e.noTargetHint);
  if (wantsHelp || positional.length === 0) {
    if (!flags['no-banner']) printBanner(lang);
    console.log(d.help(c));
    return 0;
  }

  for (const value of positional) {
    try {
      normalizeTarget(value);
    } catch {
      throw new FxError(e.invalidUrl(value));
    }
  }

  let failUnder = null;
  if (flags['fail-under'] !== undefined) {
    const grade = String(flags['fail-under']).toUpperCase();
    if (!GRADES.slice(0, 5).includes(grade)) throw new FxError(e.invalidGrade(flags['fail-under']), e.gradeHint);
    failUnder = grade;
  }

  let timeout = 10000;
  if (flags.timeout !== undefined) {
    const seconds = Number(flags.timeout);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 120) throw new FxError(e.invalidTimeout(flags.timeout));
    timeout = Math.round(seconds * 1000);
  }

  if (flags.html === true) throw new FxError(e.needsFile('html'));
  const htmlPath = typeof flags.html === 'string' ? resolve(flags.html) : null;

  const ca = process.env.VIGIE_EXTRA_CA ? readFileSync(process.env.VIGIE_EXTRA_CA, 'utf8') : undefined;
  const httpPort = process.env.VIGIE_HTTP_PORT ? Number(process.env.VIGIE_HTTP_PORT) : undefined;
  const probe = !flags['no-probe'];

  const results = await scanAll(positional, { timeout, probe, ca, httpPort });

  if (htmlPath) writeFileSync(htmlPath, toHtml(results, lang));

  if (flags.json) console.log(toJson(results, lang));
  else {
    printResults(results, { lang, quiet: flags.quiet || flags.q, banner: !flags['no-banner'], probe });
    if (htmlPath) console.log(`  ${c.green('✔')} ${d.ui.written.html} → ${htmlPath}\n`);
  }

  if (failUnder) {
    const limit = GRADES.indexOf(failUnder);
    return results.some((result) => GRADES.indexOf(result.grade) > limit) ? 1 : 0;
  }
  return 0;
}
