import { readFileSync } from 'node:fs';
import { CATEGORIES, RULES, SEVERITIES, score, severityRank } from './catalog.js';
import { Client, normalizeTarget } from './net.js';
import { transportChecks } from './checks/transport.js';
import { cookieChecks, headerChecks } from './checks/headers.js';
import { exposureChecks } from './checks/exposure.js';
import { contentChecks, disclosureChecks } from './checks/content.js';

export const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const SHOWN_HEADERS = [
  'server', 'content-type', 'strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options',
  'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'access-control-allow-origin', 'x-powered-by',
];

function variant(target, protocol, port) {
  const url = new URL(target.href);
  url.protocol = protocol;
  url.port = port ?? '';
  return url;
}

export async function scanTarget(input, options = {}) {
  const started = Date.now();
  const target = normalizeTarget(input);
  const client = new Client({
    timeout: options.timeout ?? 10000,
    userAgent: `vigie/${pkg.version} (+https://github.com/FreshlapeufDev/vigie)`,
    ca: options.ca,
  });

  const port = target.port;
  let securePort = '';
  let plainPort = '';
  if (port && target.protocol === 'https:') {
    securePort = port;
    plainPort = options.httpPort ?? null;
  } else if (port) {
    plainPort = port;
    securePort = options.httpsPort ?? port;
  } else {
    securePort = options.httpsPort ?? '';
    plainPort = options.httpPort ?? '';
  }
  const secureUrl = variant(target, 'https:', String(securePort));
  const plainUrl = plainPort === null ? null : variant(target, 'http:', String(plainPort));

  const https = await client.follow(secureUrl.href);
  const http = plainUrl ? await client.follow(plainUrl.href) : [];

  const secureOk = https[0] && !https[0].error;
  const chain = secureOk ? https : http;
  const main = chain.length ? chain[chain.length - 1] : null;
  const reachable = Boolean(main && !main.error);
  const html = reachable && /html|xml/i.test(String(main.headers?.['content-type'] || 'text/html')) ? main.text : '';

  const findings = [];
  const add = (rule, params = {}, evidence = [], severity) => {
    const spec = RULES[rule];
    findings.push({ rule, severity: severity ?? spec.severity, category: spec.category, cwe: spec.cwe, params, evidence });
  };

  const ctx = { add, client, target, https, http, main: reachable ? main : null, html, origin: reachable ? new URL(main.url).origin : null };

  await transportChecks(ctx);
  if (reachable) {
    await headerChecks(ctx);
    cookieChecks(ctx);
    contentChecks(ctx);
    disclosureChecks(ctx);
    await exposureChecks(ctx, { probe: options.probe !== false });
  }

  const order = (a, b) => severityRank(b.severity) - severityRank(a.severity) || CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
  findings.sort(order);
  const rating = score(findings);

  return {
    input: String(input),
    url: target.href,
    host: target.host,
    finalUrl: main?.url ?? null,
    status: main?.status ?? null,
    reachable,
    error: reachable ? null : (main?.error ?? https[0]?.error ?? 'UNREACHABLE'),
    tls: https[0]?.tls ?? null,
    headers: reachable ? Object.fromEntries(SHOWN_HEADERS.filter((name) => main.headers[name] !== undefined).map((name) => [name, [].concat(main.headers[name]).join(', ')])) : {},
    redirects: chain.map((hop) => ({ url: hop.url, status: hop.status, error: hop.error })),
    requests: client.log.length,
    startedAt: new Date(started).toISOString(),
    durationMs: Date.now() - started,
    findings,
    counts: Object.fromEntries([...SEVERITIES].reverse().map((severity) => [severity, findings.filter((finding) => finding.severity === severity).length])),
    score: rating.value,
    grade: rating.grade,
  };
}

export async function scanAll(inputs, options = {}) {
  const results = [];
  for (const input of inputs) results.push(await scanTarget(input, options));
  return results;
}
