import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function makeCert(days = 3650, cn = 'localhost') {
  const dir = mkdtempSync(join(tmpdir(), 'vigie-cert-'));
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
      '-days', String(days), '-subj', `/CN=${cn}`,
      '-addext', `subjectAltName=DNS:${cn},IP:127.0.0.1,IP:0:0:0:0:0:0:0:1`,
    ], { stdio: 'ignore' });
    return { key: readFileSync(join(dir, 'key.pem'), 'utf8'), cert: readFileSync(join(dir, 'cert.pem'), 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const hasOpenssl = (() => {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const listen = (server) => new Promise((resolve) => server.listen(0, () => resolve(server.address().port)));

const VULNERABLE_HTML = `<!doctype html>
<html><head>
<meta name="generator" content="WordPress 5.8.1">
<title>Vulnerable shop</title>
<link rel="stylesheet" href="http://cdn.example.com/bootstrap/3.3.7/css/bootstrap.min.css">
<script src="https://code.jquery.com/jquery-1.12.4.min.js"></script>
<script src="http://cdn.example.com/tracker.js"></script>
</head><body>
<img src="http://cdn.example.com/logo.png">
<form action="http://shop.example.com/login" method="post"><input name="user"><input type="password" name="pass"></form>
</body></html>`;

const VULNERABLE_FILES = {
  '/.git/HEAD': 'ref: refs/heads/main\n',
  '/.git/config': '[core]\n\trepositoryformatversion = 0\n',
  '/.env': 'APP_KEY=base64:abcdefghijklmnop\nDB_PASSWORD=SuperSecret42\nDISCORD_TOKEN=xyz\n',
  '/phpinfo.php': '<html><head><title>phpinfo()</title></head><body><h1 class="p">PHP Version 7.4.3</h1></body></html>',
  '/backup.sql': '-- MySQL dump 10.13\nCREATE TABLE `users` (id int);\nINSERT INTO users VALUES (1);\n',
  '/uploads/': '<html><head><title>Index of /uploads</title></head><body><h1>Index of /uploads</h1></body></html>',
};

export async function vulnerableSite({ key, cert }) {
  const handler = (secure) => (req, res) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Server', 'Apache/2.4.41 (Ubuntu)');
    res.setHeader('X-Powered-By', 'PHP/7.4.3');
    if (VULNERABLE_FILES[req.url]) {
      res.setHeader('Content-Type', req.url.endsWith('/') || req.url.endsWith('.php') ? 'text/html' : 'text/plain');
      res.end(VULNERABLE_FILES[req.url]);
      return;
    }
    if (req.url === '/') {
      res.setHeader('Set-Cookie', ['PHPSESSID=abc123; path=/', 'theme=dark; path=/']);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Strict-Transport-Security', 'max-age=3600');
      res.end(VULNERABLE_HTML);
      return;
    }
    res.statusCode = 404;
    res.end('Not found');
  };
  const secure = https.createServer({ key, cert, minVersion: 'TLSv1', ciphers: 'DEFAULT:@SECLEVEL=0' }, handler(true));
  const plain = http.createServer(handler(false));
  const httpsPort = await listen(secure);
  const httpPort = await listen(plain);
  return { httpsPort, httpPort, close: () => Promise.all([new Promise((r) => secure.close(r)), new Promise((r) => plain.close(r))]) };
}

const HARDENED_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>App</title>
<script nonce="r4nd0m" src="/assets/app.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js" integrity="sha384-abc" crossorigin="anonymous"></script>
</head><body><div id="root"></div>
<form action="/login" method="post"><input name="user"><input type="password" name="pass"></form>
</body></html>`;

export async function hardenedSite({ key, cert }, { httpsPortRef } = {}) {
  const secureHandler = (req, res) => {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Server', 'nginx');
    if (req.url === '/.well-known/security.txt') {
      res.setHeader('Content-Type', 'text/plain');
      res.end('Contact: mailto:security@example.com\nExpires: 2030-01-01T00:00:00.000Z\n');
      return;
    }
    if (req.url === '/') res.setHeader('Set-Cookie', ['__Host-session=xyz; Path=/; Secure; HttpOnly; SameSite=Lax', 'XSRF-TOKEN=abc; Path=/; Secure; SameSite=Strict']);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(HARDENED_HTML);
  };
  const secure = https.createServer({ key, cert, minVersion: 'TLSv1.2' }, secureHandler);
  const httpsPort = await listen(secure);
  const plain = http.createServer((req, res) => {
    res.statusCode = 301;
    res.setHeader('Location', `https://localhost:${httpsPort}${req.url}`);
    res.end();
  });
  const httpPort = await listen(plain);
  return { httpsPort, httpPort, close: () => Promise.all([new Promise((r) => secure.close(r)), new Promise((r) => plain.close(r))]) };
}