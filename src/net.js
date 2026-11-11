import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import tls from 'node:tls';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';

const DEFAULT_LIMIT = 512 * 1024;

export class Client {
  constructor({ timeout = 10000, userAgent, ca } = {}) {
    this.timeout = timeout;
    this.userAgent = userAgent;
    this.ca = ca ? [...tls.rootCertificates, ...[].concat(ca)] : undefined;
    this.log = [];
  }

  request(target, { method = 'GET', headers = {}, limit = DEFAULT_LIMIT } = {}) {
    const url = new URL(target);
    const secure = url.protocol === 'https:';
    const lib = secure ? https : http;
    const started = Date.now();
    const options = {
      method,
      hostname: url.hostname.replace(/^\[|\]$/g, ''),
      port: url.port || (secure ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      headers: {
        'user-agent': this.userAgent,
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'accept-encoding': 'gzip, deflate, br',
        ...headers,
      },
      timeout: this.timeout,
      agent: false,
    };
    if (secure) {
      Object.assign(options, {
        servername: isIP(options.hostname) ? undefined : options.hostname,
        rejectUnauthorized: false,
        minVersion: 'TLSv1',
        ciphers: 'DEFAULT:@SECLEVEL=0',
        ca: this.ca,
      });
    }

    return new Promise((resolve) => {
      let tlsInfo = null;
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        const entry = { method, url: url.href, status: value.status ?? null, error: value.error ?? null, ms: Date.now() - started };
        this.log.push(entry);
        resolve({ ...value, url: url.href, tls: tlsInfo, ms: entry.ms });
      };

      const req = lib.request(options, (res) => {
        const chunks = [];
        let size = 0;
        let truncated = false;
        res.on('data', (chunk) => {
          if (truncated) return;
          size += chunk.length;
          if (size > limit) {
            chunks.push(chunk.subarray(0, chunk.length - (size - limit)));
            truncated = true;
            res.destroy();
            done();
            return;
          }
          chunks.push(chunk);
        });
        const done = () => {
          let raw = Buffer.concat(chunks);
          const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
          if (!truncated) {
            try {
              if (encoding === 'gzip' || encoding === 'x-gzip') raw = gunzipSync(raw);
              else if (encoding === 'deflate') raw = inflateSync(raw);
              else if (encoding === 'br') raw = brotliDecompressSync(raw);
            } catch {}
          }
          finish({
            status: res.statusCode,
            headers: res.headers,
            setCookies: [].concat(res.headers['set-cookie'] || []),
            body: raw,
            text: raw.toString('utf8'),
            truncated,
          });
        };
        res.on('end', done);
        res.on('error', () => done());
      });

      req.on('socket', (socket) => {
        if (!secure) return;
        socket.once('secureConnect', () => {
          const cert = socket.getPeerCertificate();
          let authorized = socket.authorized;
          let error = socket.authorizationError ? String(socket.authorizationError) : null;
          if (authorized && cert && Object.keys(cert).length) {
            const mismatch = tls.checkServerIdentity(options.hostname, cert);
            if (mismatch) {
              authorized = false;
              error = 'ERR_TLS_CERT_ALTNAME_INVALID';
            }
          }
          tlsInfo = {
            protocol: socket.getProtocol(),
            cipher: socket.getCipher()?.name ?? null,
            authorized,
            error,
            subject: cert?.subject?.CN ?? null,
            issuer: cert?.issuer?.O ?? cert?.issuer?.CN ?? null,
            validFrom: cert?.valid_from ? new Date(cert.valid_from).toISOString() : null,
            validTo: cert?.valid_to ? new Date(cert.valid_to).toISOString() : null,
            altNames: cert?.subjectaltname ?? null,
          };
        });
      });
      req.on('timeout', () => {
        req.destroy();
        finish({ error: 'TIMEOUT' });
      });
      req.on('error', (err) => finish({ error: err.code || err.message }));
      req.end();
    });
  }

  async follow(target, { max = 10, headers } = {}) {
    const chain = [];
    let current = target;
    for (let i = 0; i <= max; i++) {
      const res = await this.request(current, { headers });
      chain.push(res);
      if (res.error || !res.status || res.status < 300 || res.status >= 400 || !res.headers.location) break;
      let next;
      try {
        next = new URL(res.headers.location, current).href;
      } catch {
        break;
      }
      if (chain.some((hop) => hop.url === next)) break;
      current = next;
    }
    return chain;
  }
}

export function normalizeTarget(input) {
  let value = String(input).trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error(`Unsupported protocol ${url.protocol}`);
  url.hash = '';
  if (!url.pathname) url.pathname = '/';
  return url;
}
