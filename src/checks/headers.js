const EVIL_ORIGIN = 'https://vigie-origin-check.invalid';

export function parseCsp(value) {
  const directives = {};
  for (const part of String(value).split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    if (!(name in directives)) directives[name] = tokens.slice(1);
  }
  return directives;
}

export function cspWeaknesses(value) {
  const directives = parseCsp(value);
  const script = directives['script-src'] ?? directives['default-src'];
  if (!script) return ['no-script-src'];
  const lower = script.map((source) => source.toLowerCase());
  const nonceOrHash = lower.some((source) => source.startsWith("'nonce-") || /^'sha(256|384|512)-/.test(source));
  const strictDynamic = lower.includes("'strict-dynamic'");
  const reasons = [];
  if (lower.includes("'unsafe-inline'") && !nonceOrHash) reasons.push('unsafe-inline');
  if (lower.includes("'unsafe-eval'")) reasons.push('unsafe-eval');
  if (!(strictDynamic && nonceOrHash) && lower.some((source) => ['*', 'http:', 'https:', 'data:'].includes(source))) reasons.push('wildcard');
  return reasons;
}

export function metaContent(html, attribute, name) {
  const re = new RegExp(`<meta\\b[^>]*${attribute}\\s*=\\s*["']?${name}["']?[^>]*>`, 'i');
  const tag = re.exec(html);
  if (!tag) return null;
  const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag[0]);
  return content ? content[1] ?? content[2] : null;
}

export async function headerChecks(ctx) {
  const { add, main, client } = ctx;
  if (!main || !main.headers) return;
  const h = main.headers;
  const html = ctx.html;

  const cspHeader = [].concat(h['content-security-policy'] || []).join('; ');
  const cspMeta = metaContent(html, 'http-equiv', 'Content-Security-Policy');
  const csp = cspHeader || cspMeta;
  if (!csp) {
    const reportOnly = h['content-security-policy-report-only'];
    add('csp-missing', { reportOnly: Boolean(reportOnly) }, [reportOnly ? `Content-Security-Policy-Report-Only: ${String(reportOnly).slice(0, 160)}` : 'Content-Security-Policy: —']);
  } else {
    const reasons = cspWeaknesses(csp);
    if (reasons.length) add('csp-unsafe', { reasons }, [`Content-Security-Policy: ${csp.slice(0, 200)}`]);
  }

  const xfo = String(h['x-frame-options'] || '').toUpperCase();
  const frameAncestors = cspHeader ? parseCsp(cspHeader)['frame-ancestors'] : null;
  if (!['DENY', 'SAMEORIGIN'].includes(xfo.trim()) && !frameAncestors) {
    add('clickjacking', {}, [`X-Frame-Options: ${h['x-frame-options'] ?? '—'}`, `frame-ancestors: ${frameAncestors ? frameAncestors.join(' ') : '—'}`]);
  }

  if (String(h['x-content-type-options'] || '').toLowerCase().trim() !== 'nosniff') {
    add('nosniff-missing', {}, [`X-Content-Type-Options: ${h['x-content-type-options'] ?? '—'}`]);
  }

  const referrer = h['referrer-policy'] ?? metaContent(html, 'name', 'referrer');
  const lastPolicy = referrer ? String(referrer).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean).pop() : null;
  if (!lastPolicy) add('referrer-policy', { value: null }, ['Referrer-Policy: —']);
  else if (['unsafe-url', 'no-referrer-when-downgrade'].includes(lastPolicy)) add('referrer-policy', { value: lastPolicy }, [`Referrer-Policy: ${referrer}`]);

  if (!h['permissions-policy']) add('permissions-policy-missing', {}, ['Permissions-Policy: —']);

  const acao = h['access-control-allow-origin'];
  const acac = String(h['access-control-allow-credentials'] || '').toLowerCase() === 'true';
  if (acao === '*' && acac) {
    add('cors-wildcard-credentials', {}, [`Access-Control-Allow-Origin: *`, 'Access-Control-Allow-Credentials: true']);
  }
  const probe = await client.request(main.url, { headers: { origin: EVIL_ORIGIN }, limit: 1024 });
  if (!probe.error && probe.headers) {
    const reflected = probe.headers['access-control-allow-origin'] === EVIL_ORIGIN;
    const credentials = String(probe.headers['access-control-allow-credentials'] || '').toLowerCase() === 'true';
    if (reflected && credentials) {
      add('cors-reflected-origin', { origin: EVIL_ORIGIN }, [`Origin: ${EVIL_ORIGIN}`, `Access-Control-Allow-Origin: ${EVIL_ORIGIN}`, 'Access-Control-Allow-Credentials: true']);
    }
  }
}

const SESSION = /sess|^sid$|_sid$|token|auth|jwt|login|remember|connect\.sid|phpsessid|jsessionid|aspxauth|laravel|identity|refresh/i;
const READABLE = /xsrf|csrf/i;

export function parseCookie(raw) {
  const [pair, ...attributes] = String(raw).split(';');
  const name = pair.split('=')[0].trim();
  const flags = {};
  for (const attribute of attributes) {
    const [key, ...rest] = attribute.split('=');
    flags[key.trim().toLowerCase()] = rest.join('=').trim() || true;
  }
  return { name, secure: 'secure' in flags, httpOnly: 'httponly' in flags, sameSite: typeof flags.samesite === 'string' ? flags.samesite.toLowerCase() : null };
}

export function cookieChecks(ctx) {
  const { add } = ctx;
  const seen = new Map();
  for (const hop of ctx.https) {
    for (const raw of hop.setCookies || []) {
      const cookie = parseCookie(raw);
      if (cookie.name && !seen.has(cookie.name)) seen.set(cookie.name, { ...cookie, secureSite: hop.url.startsWith('https:') });
    }
  }
  const cookies = [...seen.values()];
  const insecure = cookies.filter((cookie) => cookie.secureSite && !cookie.secure);
  if (insecure.length) {
    const session = insecure.some((cookie) => SESSION.test(cookie.name));
    add('cookie-not-secure', { names: insecure.map((cookie) => cookie.name) }, insecure.map((cookie) => `Set-Cookie: ${cookie.name}=…`), session ? 'high' : undefined);
  }
  const scriptable = cookies.filter((cookie) => SESSION.test(cookie.name) && !READABLE.test(cookie.name) && !cookie.httpOnly);
  if (scriptable.length) add('cookie-no-httponly', { names: scriptable.map((cookie) => cookie.name) }, scriptable.map((cookie) => `Set-Cookie: ${cookie.name}=…`));
  const loose = cookies.filter((cookie) => !cookie.sameSite);
  if (loose.length) add('cookie-no-samesite', { names: loose.map((cookie) => cookie.name) }, loose.map((cookie) => `Set-Cookie: ${cookie.name}=…`));
}
