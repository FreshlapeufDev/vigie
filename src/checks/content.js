const ATTR = (name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');

const attr = (tag, name) => {
  const match = ATTR(name).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
};

export function tags(html, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

const cmp = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

export const LIBRARIES = [
  { name: 'jQuery', re: /jquery(?:[.-]|\/|@)(\d+\.\d+\.\d+)(?:[./-]|$)/i, vulnerable: (v) => cmp(v, '3.5.0') < 0, advisory: 'CVE-2020-11022', fixed: '3.5.0' },
  { name: 'Bootstrap', re: /bootstrap(?:[.-]|\/|@)(\d+\.\d+\.\d+)(?:[./-]|$)/i, vulnerable: (v) => cmp(v, '3.4.1') < 0 || (v.startsWith('4.') && cmp(v, '4.3.1') < 0), advisory: 'CVE-2019-8331', fixed: '4.3.1' },
  { name: 'AngularJS', re: /angular(?:js)?(?:[.-]|\/|@)(1\.\d+\.\d+)(?:[./-]|$)/i, vulnerable: () => true, advisory: 'EOL 2022', fixed: 'Angular' },
  { name: 'Lodash', re: /lodash(?:[.-]|\/|@)(\d+\.\d+\.\d+)(?:[./-]|$)/i, vulnerable: (v) => cmp(v, '4.17.21') < 0, advisory: 'CVE-2021-23337', fixed: '4.17.21' },
];

export function contentChecks(ctx) {
  const { add, main } = ctx;
  const html = ctx.html;
  if (!main || !html) return;
  const page = new URL(main.url);
  const secure = page.protocol === 'https:';

  const scripts = tags(html, 'script').map((tag) => ({ tag, src: attr(tag, 'src') })).filter((item) => item.src);
  const styles = tags(html, 'link').filter((tag) => /\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)).map((tag) => ({ tag, src: attr(tag, 'href') })).filter((item) => item.src);
  const frames = tags(html, 'iframe').map((tag) => ({ tag, src: attr(tag, 'src') })).filter((item) => item.src);
  const images = tags(html, 'img').map((tag) => ({ tag, src: attr(tag, 'src') })).filter((item) => item.src);

  if (secure) {
    const active = [...scripts, ...styles, ...frames].map((item) => item.src).filter((src) => /^http:\/\//i.test(src));
    const passive = images.map((item) => item.src).filter((src) => /^http:\/\//i.test(src));
    if (active.length || passive.length) {
      add('mixed-content', { active: active.length, passive: passive.length }, [...active, ...passive].slice(0, 8), active.length ? undefined : 'low');
    }
  }

  const forms = html.match(/<form\b[^>]*>[\s\S]*?<\/form>/gi) || [];
  const unsafeForms = [];
  for (const form of forms) {
    const open = form.match(/<form\b[^>]*>/i)[0];
    const action = attr(open, 'action');
    const target = action ? new URL(action, page).href : page.href;
    const password = /<input\b[^>]*type\s*=\s*["']?password/i.test(form);
    if (password && target.startsWith('http:')) unsafeForms.push(target);
  }
  if (unsafeForms.length) add('insecure-form', { actions: unsafeForms }, unsafeForms.map((target) => `<form action="${target}"> + <input type="password">`));

  const external = scripts.filter((item) => {
    try {
      const url = new URL(item.src, page);
      return url.origin !== page.origin && /^https?:/.test(url.protocol);
    } catch {
      return false;
    }
  });
  const unsigned = external.filter((item) => !attr(item.tag, 'integrity'));
  if (unsigned.length) add('sri-missing', { count: unsigned.length, hosts: [...new Set(unsigned.map((item) => new URL(item.src, page).host))] }, unsigned.slice(0, 6).map((item) => `<script src="${item.src}">`));

  const outdated = [];
  for (const { src } of [...scripts, ...styles]) {
    for (const lib of LIBRARIES) {
      const match = lib.re.exec(src);
      if (match && lib.vulnerable(match[1]) && !outdated.some((item) => item.name === lib.name)) {
        outdated.push({ name: lib.name, version: match[1], advisory: lib.advisory, fixed: lib.fixed, src });
      }
    }
  }
  for (const lib of outdated) {
    add('outdated-library', { name: lib.name, version: lib.version, advisory: lib.advisory, fixed: lib.fixed }, [lib.src]);
  }
}

export function disclosureChecks(ctx) {
  const { add, main } = ctx;
  if (!main?.headers) return;
  const h = main.headers;
  const leaks = [];
  if (h.server && /\d/.test(h.server)) leaks.push(`Server: ${h.server}`);
  for (const name of ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator', 'x-drupal-cache', 'x-runtime']) {
    if (h[name] && (name !== 'x-runtime' || !/^\d/.test(h[name]))) leaks.push(`${name.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())}: ${h[name]}`);
  }
  const generator = /<meta\b[^>]*name\s*=\s*["']generator["'][^>]*>/i.exec(ctx.html || '');
  if (generator) {
    const content = /content\s*=\s*["']([^"']*)/i.exec(generator[0]);
    if (content && /\d/.test(content[1])) leaks.push(`<meta name="generator" content="${content[1]}">`);
  }
  if (leaks.length) add('version-disclosure', { items: leaks }, leaks);
}
