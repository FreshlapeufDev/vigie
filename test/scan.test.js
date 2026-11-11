import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { scanTarget } from '../src/scan.js';
import { hardenedSite, hasOpenssl, makeCert, vulnerableSite } from './servers.js';

const skip = !hasOpenssl && 'openssl is required to create test certificates';
let cert;
let vulnerable;
let hardened;

before(async () => {
  if (skip) return;
  cert = makeCert();
  vulnerable = await vulnerableSite(cert);
  hardened = await hardenedSite(cert);
});

after(async () => {
  await vulnerable?.close();
  await hardened?.close();
});

const rules = (result) => result.findings.map((finding) => finding.rule).sort();

test('vulnerable site: every planted issue is reported', { skip }, async () => {
  const result = await scanTarget(`https://localhost:${vulnerable.httpsPort}/`, { ca: cert.cert, httpPort: vulnerable.httpPort, timeout: 5000 });
  assert.equal(result.grade, 'F');
  assert.deepEqual(rules(result), [
    'clickjacking', 'cookie-no-httponly', 'cookie-no-samesite', 'cookie-not-secure', 'cors-reflected-origin', 'csp-missing',
    'directory-listing', 'exposed-backup', 'exposed-env', 'exposed-git', 'exposed-phpinfo', 'hsts-weak', 'http-no-redirect',
    'insecure-form', 'mixed-content', 'nosniff-missing', 'outdated-library', 'outdated-library', 'permissions-policy-missing',
    'referrer-policy', 'security-txt-missing', 'sri-missing', 'tls-old-protocol', 'version-disclosure',
  ]);
  const cookie = result.findings.find((finding) => finding.rule === 'cookie-not-secure');
  assert.equal(cookie.severity, 'high');
  assert.deepEqual(cookie.params.names, ['PHPSESSID', 'theme']);
  assert.deepEqual(result.findings.find((finding) => finding.rule === 'cookie-no-httponly').params.names, ['PHPSESSID']);
  assert.deepEqual(result.findings.find((finding) => finding.rule === 'exposed-git').params.paths, ['/.git/HEAD', '/.git/config']);
  assert.deepEqual(result.findings.filter((finding) => finding.rule === 'outdated-library').map((finding) => finding.params.name), ['jQuery', 'Bootstrap']);
});

test('secrets from exposed files never appear in the result', { skip }, async () => {
  const result = await scanTarget(`https://localhost:${vulnerable.httpsPort}/`, { ca: cert.cert, timeout: 5000 });
  const text = JSON.stringify(result);
  for (const secret of ['SuperSecret42', 'base64:abcdefghijklmnop', 'abc123']) assert.ok(!text.includes(secret), secret);
  assert.ok(text.includes('DB_PASSWORD=••••••'));
});

test('hardened single-page app: A+ and no false positive', { skip }, async () => {
  const result = await scanTarget(`https://localhost:${hardened.httpsPort}/`, { ca: cert.cert, httpPort: hardened.httpPort, timeout: 5000 });
  assert.deepEqual(result.findings, []);
  assert.equal(result.grade, 'A+');
  assert.equal(result.score, 100);
  assert.equal(result.tls.authorized, true);
});

test('--no-probe sends only a handful of requests', { skip }, async () => {
  const result = await scanTarget(`https://localhost:${vulnerable.httpsPort}/`, { ca: cert.cert, timeout: 5000, probe: false });
  assert.ok(result.requests <= 3, String(result.requests));
  assert.ok(!rules(result).some((rule) => rule.startsWith('exposed-')));
});

test('untrusted, foreign and expiring certificates', { skip }, async () => {
  const untrusted = await scanTarget(`https://localhost:${hardened.httpsPort}/`, { timeout: 5000, probe: false });
  assert.equal(untrusted.findings[0].rule, 'tls-invalid-cert');
  assert.equal(untrusted.findings[0].params.reason, 'DEPTH_ZERO_SELF_SIGNED_CERT');

  const otherCert = makeCert(3650, 'other.example');
  const foreign = await hardenedSite(otherCert);
  const mismatch = await scanTarget(`https://localhost:${foreign.httpsPort}/`, { ca: otherCert.cert, timeout: 5000, probe: false });
  assert.equal(mismatch.findings[0].params.reason, 'ERR_TLS_CERT_ALTNAME_INVALID');
  await foreign.close();

  const soonCert = makeCert(10);
  const soon = await hardenedSite(soonCert);
  const expiring = await scanTarget(`https://localhost:${soon.httpsPort}/`, { ca: soonCert.cert, timeout: 5000, probe: false });
  assert.deepEqual(expiring.findings.map((finding) => `${finding.rule}:${finding.severity}`), ['tls-expiring:medium']);
  assert.ok(expiring.findings[0].params.days >= 9 && expiring.findings[0].params.days <= 10);
  await soon.close();
});

test('unreachable host', async () => {
  const result = await scanTarget('https://127.0.0.1:1/', { timeout: 2000 });
  assert.equal(result.reachable, false);
  assert.equal(result.grade, 'F');
  assert.deepEqual(rules(result), ['no-https']);
});
