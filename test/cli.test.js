import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS } from '../src/i18n/index.js';
import { RULES } from '../src/catalog.js';
import { hardenedSite, hasOpenssl, makeCert, vulnerableSite } from './servers.js';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'vigie.js');
const skip = !hasOpenssl && 'openssl is required to create test certificates';
let dir;
let cert;
let vulnerable;
let hardened;

const cli = (args, env = {}) => new Promise((resolve) => {
  execFile(process.execPath, [BIN, ...args], { env: { ...process.env, NO_COLOR: '1', VIGIE_LANG: 'en', VIGIE_EXTRA_CA: join(dir, 'ca.pem'), ...env } }, (error, stdout, stderr) => {
    resolve({ code: error ? error.code : 0, out: stdout + stderr });
  });
});

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'vigie-cli-'));
  if (skip) {
    writeFileSync(join(dir, 'ca.pem'), '');
    return;
  }
  cert = makeCert();
  writeFileSync(join(dir, 'ca.pem'), cert.cert);
  vulnerable = await vulnerableSite(cert);
  hardened = await hardenedSite(cert);
});

after(async () => {
  await vulnerable?.close();
  await hardened?.close();
  rmSync(dir, { recursive: true, force: true });
});

test('every rule is translated in every language', () => {
  for (const [code, d] of Object.entries(LANGS)) {
    for (const id of Object.keys(RULES)) {
      for (const key of ['title', 'description', 'fix']) assert.ok(d.rules[id]?.[key], `${code} ${id}.${key}`);
      assert.equal(typeof d.messages[id], 'function', `${code} message ${id}`);
    }
    assert.deepEqual(Object.keys(d.report).sort(), Object.keys(LANGS.en.report).sort(), code);
    assert.deepEqual(Object.keys(d.ui).sort(), Object.keys(LANGS.en.ui).sort(), code);
    assert.deepEqual(Object.keys(d.errors).sort(), Object.keys(LANGS.en.errors).sort(), code);
  }
});

test('console report in English and French with the FreshDev banner', { skip }, async () => {
  const url = `https://localhost:${vulnerable.httpsPort}/`;
  const en = await cli([url], { VIGIE_HTTP_PORT: String(vulnerable.httpPort) });
  assert.equal(en.code, 0);
  assert.match(en.out, /███████╗██████╗/);
  assert.match(en.out, /crafted by FreshDev/);
  assert.match(en.out, /Git repository downloadable/);
  assert.match(en.out, /\[ F  \]/);
  const fr = await cli([url, '--lang', 'fr', '--no-banner', '-q']);
  assert.doesNotMatch(fr.out, /███/);
  assert.match(fr.out, /Critique\. Corrigez les constats critiques immédiatement\./);
  assert.doesNotMatch(fr.out, /Dépôt Git/);
});

test('--fail-under drives the exit code', { skip }, async () => {
  assert.equal((await cli([`https://localhost:${hardened.httpsPort}/`, '--fail-under', 'A', '-q'])).code, 0);
  assert.equal((await cli([`https://localhost:${vulnerable.httpsPort}/`, '--fail-under', 'D', '-q', '--no-probe'])).code, 1);
  assert.equal((await cli([`https://localhost:${vulnerable.httpsPort}/`, '--fail-under', 'Z'])).code, 2);
});

test('JSON output', { skip }, async () => {
  const res = await cli([`https://localhost:${hardened.httpsPort}/`, `https://localhost:${vulnerable.httpsPort}/`, '--json', '--lang', 'fr']);
  const report = JSON.parse(res.out);
  assert.equal(report.lang, 'fr');
  assert.deepEqual(report.targets.map((target) => target.grade), ['A+', 'F']);
  const git = report.targets[1].findings.find((finding) => finding.rule === 'exposed-git');
  assert.equal(git.title, 'Dépôt Git téléchargeable');
  assert.match(git.message, /sont téléchargeables publiquement/);
});

test('bilingual HTML report', { skip }, async () => {
  const file = join(dir, 'report.html');
  await cli([`https://localhost:${vulnerable.httpsPort}/`, '--html', file, '--lang', 'fr', '-q']);
  const html = readFileSync(file, 'utf8');
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /data-set-lang="en"/);
  assert.match(html, /Rapport de sécurité web/);
  assert.match(html, /Website security report/);
  assert.match(html, /VG-\d{8}-[0-9A-F]{4}/);
  assert.match(html, /id="VG-01"/);
  assert.match(html, /aria-label="FreshDev"/);
  assert.match(html, /RedirectMatch 404/);
  assert.ok(!html.includes('SuperSecret42'));
  assert.ok(!/<script[^>]+src=|<link[^>]+href="http/.test(html));
});

test('usage errors', async () => {
  assert.match((await cli(['--help', '--no-banner'])).out, /--fail-under/);
  assert.match((await cli(['--help', '--lang', 'fr', '--no-banner'])).out, /Utilisation/);
  assert.match((await cli(['--version'])).out, /^\d+\.\d+\.\d+/);
  const bad = await cli(['ftp://example.com']);
  assert.equal(bad.code, 2);
  assert.match(bad.out, /Invalid address/);
  assert.equal((await cli(['example.com', '--lang', 'de'])).code, 2);
  assert.equal((await cli(['example.com', '--timeout', 'abc'])).code, 2);
  assert.match((await cli(['--json'])).out, /Missing website address/);
});
