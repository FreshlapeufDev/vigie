import en from './en.js';
import fr from './fr.js';

export const LANGS = { en, fr };
export const LANG_CODES = Object.keys(LANGS);

export function normalizeLang(value) {
  if (!value) return null;
  const code = String(value).toLowerCase().slice(0, 2);
  return LANGS[code] ? code : null;
}

export function detectLang() {
  const env = process.env.VIGIE_LANG || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG;
  const fromEnv = env && !/^(C|POSIX)(\.|$)/i.test(env) ? normalizeLang(env) : null;
  if (fromEnv) return fromEnv;
  try {
    return normalizeLang(Intl.DateTimeFormat().resolvedOptions().locale) ?? 'en';
  } catch {
    return 'en';
  }
}

export const dict = (lang) => LANGS[lang] ?? en;

export const message = (lang, finding) => {
  const fn = dict(lang).messages[finding.rule] ?? en.messages[finding.rule];
  return fn ? fn(finding.params) : finding.rule;
};
