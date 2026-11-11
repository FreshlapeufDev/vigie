import { randomBytes } from 'node:crypto';

const isHtml = (res) => /text\/html/i.test(String(res.headers?.['content-type'] || '')) || /^\s*<(!doctype|html|head|body)/i.test(res.text.slice(0, 200));

const envKeys = (text) => {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^(?:export\s+)?([A-Z][A-Z0-9_]{1,63})\s*=/.exec(line);
    if (match) keys.push(match[1]);
  }
  return keys;
};

export const PROBES = [
  { path: '/.git/HEAD', rule: 'exposed-git', test: (res) => !isHtml(res) && /^(ref: refs\/|[0-9a-f]{40}\s*$)/.test(res.text) },
  { path: '/.git/config', rule: 'exposed-git', test: (res) => !isHtml(res) && /^\s*\[core\]/m.test(res.text) },
  { path: '/.env', rule: 'exposed-env', test: (res) => !isHtml(res) && envKeys(res.text).length >= 2, evidence: (res) => envKeys(res.text).slice(0, 6).map((key) => `${key}=••••••`) },
  { path: '/.env.local', rule: 'exposed-env', test: (res) => !isHtml(res) && envKeys(res.text).length >= 2, evidence: (res) => envKeys(res.text).slice(0, 6).map((key) => `${key}=••••••`) },
  { path: '/.env.production', rule: 'exposed-env', test: (res) => !isHtml(res) && envKeys(res.text).length >= 2, evidence: (res) => envKeys(res.text).slice(0, 6).map((key) => `${key}=••••••`) },
  { path: '/.htpasswd', rule: 'exposed-htpasswd', test: (res) => !isHtml(res) && /^[^:\s<]{1,64}:(\$apr1\$|\$2[aby]\$|\{SHA\}|[./0-9A-Za-z]{13})/m.test(res.text), evidence: (res) => [`${res.text.split(':')[0]}:••••••`] },
  { path: '/backup.sql', rule: 'exposed-backup', test: (res) => !isHtml(res) && /(CREATE TABLE|INSERT INTO|-- MySQL dump|PostgreSQL database dump)/i.test(res.text) },
  { path: '/dump.sql', rule: 'exposed-backup', test: (res) => !isHtml(res) && /(CREATE TABLE|INSERT INTO|-- MySQL dump|PostgreSQL database dump)/i.test(res.text) },
  { path: '/database.sql', rule: 'exposed-backup', test: (res) => !isHtml(res) && /(CREATE TABLE|INSERT INTO|-- MySQL dump|PostgreSQL database dump)/i.test(res.text) },
  { path: '/backup.zip', rule: 'exposed-backup', test: (res) => res.body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  { path: '/site.zip', rule: 'exposed-backup', test: (res) => res.body.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  { path: '/wp-config.php.bak', rule: 'exposed-backup', test: (res) => /DB_PASSWORD|DB_USER/.test(res.text) },
  { path: '/wp-config.php~', rule: 'exposed-backup', test: (res) => /DB_PASSWORD|DB_USER/.test(res.text) },
  { path: '/config.php.bak', rule: 'exposed-backup', test: (res) => /<\?php/.test(res.text) && /pass|pwd|secret|key/i.test(res.text) },
  { path: '/.vscode/sftp.json', rule: 'exposed-config', test: (res) => !isHtml(res) && /"host"\s*:/.test(res.text) && /"(password|privateKeyPath|username)"\s*:/.test(res.text) },
  { path: '/.npmrc', rule: 'exposed-config', test: (res) => !isHtml(res) && /_authToken\s*=|_auth\s*=/.test(res.text) },
  { path: '/docker-compose.yml', rule: 'exposed-config', test: (res) => !isHtml(res) && /^services\s*:/m.test(res.text) && /(PASSWORD|SECRET|TOKEN)\w*\s*[:=]/i.test(res.text) },
  { path: '/phpinfo.php', rule: 'exposed-phpinfo', test: (res) => /<title>phpinfo\(\)<\/title>|>PHP Version [0-9]/i.test(res.text) },
  { path: '/info.php', rule: 'exposed-phpinfo', test: (res) => /<title>phpinfo\(\)<\/title>|>PHP Version [0-9]/i.test(res.text) },
  { path: '/server-status', rule: 'exposed-server-status', test: (res) => /Apache Server Status for/i.test(res.text) },
  { path: '/.DS_Store', rule: 'exposed-ds-store', test: (res) => res.body.subarray(0, 8).equals(Buffer.from([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31])) },
  { path: '/uploads/', rule: 'directory-listing', test: (res) => isListing(res.text) },
  { path: '/backup/', rule: 'directory-listing', test: (res) => isListing(res.text) },
];

export const isListing = (text) => /<title>\s*Index of \//i.test(text) || /<h1>\s*Index of \//i.test(text) || /<title>Directory listing for \//i.test(text);

export async function exposureChecks(ctx, { probe = true, concurrency = 4 } = {}) {
  const { add, main, client, origin } = ctx;

  if (main?.text && isListing(main.text)) add('directory-listing', { path: new URL(main.url).pathname }, [`GET ${main.url} → Index of /`]);

  if (!probe) return;

  const baseline = await client.request(`${origin}/vigie-${randomBytes(6).toString('hex')}-not-found`, { limit: 64 * 1024 });
  const sameAsBaseline = (res) => baseline.status === 200 && res.status === 200 && baseline.text === res.text;

  const found = new Map();
  const queue = [...PROBES];
  const worker = async () => {
    while (queue.length) {
      const probeSpec = queue.shift();
      const res = await client.request(`${origin}${probeSpec.path}`, { limit: 64 * 1024 });
      if (res.error || res.status !== 200 || !res.body?.length || sameAsBaseline(res)) continue;
      let hit = false;
      try {
        hit = probeSpec.test(res);
      } catch {}
      if (!hit) continue;
      const paths = found.get(probeSpec.rule) ?? [];
      paths.push({ path: probeSpec.path, evidence: probeSpec.evidence ? probeSpec.evidence(res) : [] , size: res.body.length });
      found.set(probeSpec.rule, paths);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));

  const order = PROBES.map((spec) => spec.rule).filter((rule, index, all) => all.indexOf(rule) === index);
  for (const rule of order) {
    const hits = found.get(rule);
    if (!hits) continue;
    hits.sort((a, b) => PROBES.findIndex((spec) => spec.path === a.path) - PROBES.findIndex((spec) => spec.path === b.path));
    add(rule, { paths: hits.map((hit) => hit.path) }, hits.flatMap((hit) => [`GET ${origin}${hit.path} → 200 (${hit.size} B)`, ...hit.evidence.map((line) => `  ${line}`)]));
  }

  const securityTxt = await client.request(`${origin}/.well-known/security.txt`, { limit: 16 * 1024 });
  if (securityTxt.error || securityTxt.status !== 200 || !/^contact\s*:/im.test(securityTxt.text) || isHtml(securityTxt)) {
    add('security-txt-missing', {}, [`GET ${origin}/.well-known/security.txt → ${securityTxt.status ?? securityTxt.error}`]);
  }
}
