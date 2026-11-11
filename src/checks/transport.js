import { isIP } from 'node:net';
import tls from 'node:tls';

const DAY = 24 * 60 * 60 * 1000;
const HSTS_MIN = 15552000;

export function legacyTlsAccepted(host, port, servername, timeout) {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      servername,
      rejectUnauthorized: false,
      minVersion: 'TLSv1',
      maxVersion: 'TLSv1.1',
      ciphers: 'DEFAULT:@SECLEVEL=0',
      timeout,
    });
    const end = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.once('secureConnect', () => end(socket.getProtocol()));
    socket.once('error', () => end(null));
    socket.once('timeout', () => end(null));
  });
}

export async function transportChecks(ctx) {
  const { add, https: secureChain, http: plainChain, target, client } = ctx;
  const first = secureChain[0];

  if (!first || first.error) {
    add('no-https', { host: target.host, error: first?.error ?? 'ERROR' }, [`GET https://${target.host}/ → ${first?.error ?? 'ERROR'}`]);
  } else {
    const info = first.tls;
    if (info && !info.authorized) {
      add('tls-invalid-cert', { reason: info.error || 'UNKNOWN' }, [
        `${info.error || 'UNKNOWN'}`,
        `subject: ${info.subject ?? '?'} · issuer: ${info.issuer ?? '?'}`,
        info.validTo ? `valid until: ${info.validTo.slice(0, 10)}` : null,
      ].filter(Boolean));
    }
    if (info?.validTo) {
      const days = Math.floor((new Date(info.validTo).getTime() - Date.now()) / DAY);
      if (days >= 0 && days <= 30) {
        add('tls-expiring', { days, date: info.validTo.slice(0, 10) }, [`notAfter: ${info.validTo}`], days <= 14 ? 'medium' : 'low');
      }
    }
    const legacy = await legacyTlsAccepted(target.hostname.replace(/^\[|\]$/g, ''), Number(target.port) || 443, isIP(target.hostname) ? undefined : target.hostname, client.timeout);
    if (legacy) add('tls-old-protocol', { protocol: legacy }, [`${legacy} handshake accepted`]);

    for (let i = 1; i < secureChain.length; i++) {
      if (secureChain[i].url.startsWith('http:')) {
        add('insecure-redirect', { from: secureChain[i - 1].url, to: secureChain[i].url }, secureChain.slice(0, i + 1).map((hop) => `${hop.status ?? hop.error} ${hop.url}`));
        break;
      }
    }

    const page = ctx.main;
    if (page && page.url.startsWith('https:') && page.headers) {
      const raw = page.headers['strict-transport-security'];
      if (!raw) add('hsts-missing', {}, ['Strict-Transport-Security: —']);
      else {
        const maxAge = Number((/max-age\s*=\s*"?(\d+)/i.exec(raw) || [])[1] ?? 0);
        if (maxAge < HSTS_MIN) add('hsts-weak', { maxAge, days: Math.floor(maxAge / 86400) }, [`Strict-Transport-Security: ${raw}`]);
      }
    }
  }

  const plainFirst = plainChain[0];
  if (plainFirst && !plainFirst.error) {
    const last = plainChain[plainChain.length - 1];
    const upgraded = plainChain.some((hop) => hop.url.startsWith('https:'));
    if (!upgraded && last.status && last.status < 400) {
      add('http-no-redirect', { status: last.status }, plainChain.map((hop) => `${hop.status ?? hop.error} ${hop.url}`));
    }
  }
}
