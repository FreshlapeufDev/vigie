import { test } from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../src/catalog.js';
import { cspWeaknesses, parseCookie } from '../src/checks/headers.js';
import { LIBRARIES } from '../src/checks/content.js';
import { PROBES, isListing } from '../src/checks/exposure.js';
import { normalizeTarget } from '../src/net.js';

test('target normalisation', () => {
  assert.equal(normalizeTarget('example.com').href, 'https://example.com/');
  assert.equal(normalizeTarget('http://example.com/shop#top').href, 'http://example.com/shop');
  assert.equal(normalizeTarget('  https://example.com:8443  ').port, '8443');
  assert.throws(() => normalizeTarget('ftp://example.com'));
});

test('CSP weaknesses follow browser semantics', () => {
  assert.deepEqual(cspWeaknesses("default-src 'self'"), []);
  assert.deepEqual(cspWeaknesses("script-src 'self' 'unsafe-inline'"), ['unsafe-inline']);
  assert.deepEqual(cspWeaknesses("script-src 'self' 'unsafe-inline' 'nonce-abc'"), []);
  assert.deepEqual(cspWeaknesses("script-src 'self' 'unsafe-eval' https:"), ['unsafe-eval', 'wildcard']);
  assert.deepEqual(cspWeaknesses("script-src 'nonce-abc' 'strict-dynamic' https:"), []);
  assert.deepEqual(cspWeaknesses('img-src *'), ['no-script-src']);
});

test('cookie attributes are parsed case-insensitively', () => {
  assert.deepEqual(parseCookie('sid=1; Path=/; SECURE; httponly; SameSite=Strict'), { name: 'sid', secure: true, httpOnly: true, sameSite: 'strict' });
  assert.deepEqual(parseCookie('theme=dark'), { name: 'theme', secure: false, httpOnly: false, sameSite: null });
});

test('library versions are compared correctly', () => {
  const check = (name, url) => {
    const lib = LIBRARIES.find((item) => item.name === name);
    const match = lib.re.exec(url);
    return match ? lib.vulnerable(match[1]) : null;
  };
  assert.equal(check('jQuery', 'https://code.jquery.com/jquery-3.4.1.min.js'), true);
  assert.equal(check('jQuery', 'https://code.jquery.com/jquery-3.10.0.min.js'), false);
  assert.equal(check('jQuery', 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js'), false);
  assert.equal(check('jQuery', 'https://cdn.jsdelivr.net/npm/jquery@2.2.4/dist/jquery.min.js'), true);
  assert.equal(check('Bootstrap', '/css/bootstrap-4.6.2.min.css'), false);
  assert.equal(check('Bootstrap', '/css/bootstrap/4.1.0/bootstrap.min.css'), true);
  assert.equal(check('AngularJS', 'https://ajax.googleapis.com/ajax/libs/angularjs/1.8.2/angular.min.js'), true);
  assert.equal(check('Lodash', 'https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js'), false);
});

test('exposure signatures reject HTML pages that answer every path', () => {
  const html = { text: '<!doctype html><html><body>ref: refs/heads/main\nAPP_KEY=x\nDB=y</body></html>', body: Buffer.from('<!doctype html>'), headers: { 'content-type': 'text/html' } };
  for (const probe of PROBES.filter((item) => ['exposed-git', 'exposed-env'].includes(item.rule))) assert.equal(probe.test(html), false, probe.path);
  const env = { text: 'APP_KEY=abc\nDB_PASSWORD=secret\n', body: Buffer.from('APP_KEY'), headers: { 'content-type': 'text/plain' } };
  assert.equal(PROBES.find((item) => item.path === '/.env').test(env), true);
  assert.deepEqual(PROBES.find((item) => item.path === '/.env').evidence(env), ['APP_KEY=••••••', 'DB_PASSWORD=••••••']);
  assert.ok(isListing('<html><head><title>Index of /uploads</title>'));
  assert.ok(!isListing('<html><head><title>Index of products</title>'));
});

test('grades', () => {
  const f = (...severities) => severities.map((severity) => ({ severity }));
  assert.deepEqual(score(f()), { value: 100, grade: 'A+' });
  assert.deepEqual(score(f('info', 'info')), { value: 100, grade: 'A+' });
  assert.equal(score(f('low')).grade, 'A');
  assert.equal(score(f('medium', 'low', 'low')).grade, 'B');
  assert.equal(score(f('high', 'medium', 'low')).grade, 'C');
  assert.equal(score(f('high', 'high', 'medium')).grade, 'D');
  assert.equal(score(f('critical')).grade, 'F');
  assert.equal(score(f('high', 'high', 'high', 'high', 'high', 'high')).value, 0);
});
