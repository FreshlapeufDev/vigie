export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];

export const severityRank = (severity) => SEVERITIES.indexOf(severity);

export const CATEGORIES = ['transport', 'headers', 'cookies', 'exposure', 'content', 'disclosure'];

export const RULES = {
  'no-https': { severity: 'critical', category: 'transport', cwe: 319 },
  'tls-invalid-cert': { severity: 'critical', category: 'transport', cwe: 295 },
  'tls-old-protocol': { severity: 'high', category: 'transport', cwe: 326 },
  'tls-expiring': { severity: 'medium', category: 'transport', cwe: 298 },
  'http-no-redirect': { severity: 'high', category: 'transport', cwe: 319 },
  'insecure-redirect': { severity: 'medium', category: 'transport', cwe: 319 },
  'hsts-missing': { severity: 'medium', category: 'transport', cwe: 523 },
  'hsts-weak': { severity: 'low', category: 'transport', cwe: 523 },
  'csp-missing': { severity: 'medium', category: 'headers', cwe: 693 },
  'csp-unsafe': { severity: 'medium', category: 'headers', cwe: 693 },
  clickjacking: { severity: 'medium', category: 'headers', cwe: 1021 },
  'cors-reflected-origin': { severity: 'high', category: 'headers', cwe: 942 },
  'cors-wildcard-credentials': { severity: 'medium', category: 'headers', cwe: 942 },
  'nosniff-missing': { severity: 'low', category: 'headers', cwe: 693 },
  'referrer-policy': { severity: 'low', category: 'headers', cwe: 200 },
  'permissions-policy-missing': { severity: 'info', category: 'headers', cwe: 693 },
  'cookie-not-secure': { severity: 'medium', category: 'cookies', cwe: 614 },
  'cookie-no-httponly': { severity: 'medium', category: 'cookies', cwe: 1004 },
  'cookie-no-samesite': { severity: 'low', category: 'cookies', cwe: 1275 },
  'exposed-git': { severity: 'critical', category: 'exposure', cwe: 538 },
  'exposed-env': { severity: 'critical', category: 'exposure', cwe: 538 },
  'exposed-backup': { severity: 'critical', category: 'exposure', cwe: 530 },
  'exposed-config': { severity: 'critical', category: 'exposure', cwe: 538 },
  'exposed-htpasswd': { severity: 'critical', category: 'exposure', cwe: 522 },
  'exposed-phpinfo': { severity: 'high', category: 'exposure', cwe: 200 },
  'exposed-server-status': { severity: 'medium', category: 'exposure', cwe: 200 },
  'directory-listing': { severity: 'medium', category: 'exposure', cwe: 548 },
  'exposed-ds-store': { severity: 'low', category: 'exposure', cwe: 538 },
  'security-txt-missing': { severity: 'info', category: 'exposure', cwe: null },
  'insecure-form': { severity: 'high', category: 'content', cwe: 319 },
  'mixed-content': { severity: 'medium', category: 'content', cwe: 319 },
  'outdated-library': { severity: 'medium', category: 'content', cwe: 1104 },
  'sri-missing': { severity: 'low', category: 'content', cwe: 353 },
  'version-disclosure': { severity: 'low', category: 'disclosure', cwe: 200 },
};

export const PENALTY = { critical: 40, high: 20, medium: 10, low: 5, info: 0 };

export function score(findings) {
  const value = Math.max(0, 100 - findings.reduce((sum, finding) => sum + PENALTY[finding.severity], 0));
  let grade;
  if (findings.some((finding) => finding.severity === 'critical')) grade = 'F';
  else if (!findings.some((finding) => finding.severity !== 'info')) grade = 'A+';
  else if (value >= 90) grade = 'A';
  else if (value >= 75) grade = 'B';
  else if (value >= 60) grade = 'C';
  else if (value >= 40) grade = 'D';
  else grade = 'F';
  return { value, grade };
}

export const SNIPPETS = {
  'http-no-redirect': {
    nginx: 'server {\n    listen 80;\n    server_name example.com;\n    return 301 https://$host$request_uri;\n}',
    apache: 'RewriteEngine On\nRewriteCond %{HTTPS} off\nRewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]',
  },
  'tls-old-protocol': {
    nginx: 'ssl_protocols TLSv1.2 TLSv1.3;',
    apache: 'SSLProtocol -all +TLSv1.2 +TLSv1.3',
  },
  'hsts-missing': {
    nginx: 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;',
    apache: 'Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"',
  },
  'hsts-weak': {
    nginx: 'add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;',
    apache: 'Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains"',
  },
  'csp-missing': {
    nginx: "add_header Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'\" always;",
    apache: "Header always set Content-Security-Policy \"default-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'\"",
  },
  clickjacking: {
    nginx: 'add_header X-Frame-Options "SAMEORIGIN" always;',
    apache: 'Header always set X-Frame-Options "SAMEORIGIN"',
  },
  'nosniff-missing': {
    nginx: 'add_header X-Content-Type-Options "nosniff" always;',
    apache: 'Header always set X-Content-Type-Options "nosniff"',
  },
  'referrer-policy': {
    nginx: 'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    apache: 'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
  },
  'permissions-policy-missing': {
    nginx: 'add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;',
    apache: 'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=()"',
  },
  'exposed-git': {
    nginx: 'location ~ /\\.(?!well-known/) {\n    deny all;\n}',
    apache: 'RedirectMatch 404 /\\.(?!well-known/)',
  },
  'exposed-env': {
    nginx: 'location ~ /\\.(?!well-known/) {\n    deny all;\n}',
    apache: 'RedirectMatch 404 /\\.(?!well-known/)',
  },
  'exposed-htpasswd': {
    nginx: 'location ~ /\\.ht {\n    deny all;\n}',
    apache: '<Files ".ht*">\n    Require all denied\n</Files>',
  },
  'exposed-backup': {
    nginx: 'location ~* \\.(sql|zip|tar|gz|bak|old|swp)$|~$ {\n    deny all;\n}',
    apache: '<FilesMatch "\\.(sql|zip|tar|gz|bak|old|swp)$|~$">\n    Require all denied\n</FilesMatch>',
  },
  'exposed-server-status': {
    nginx: 'location = /nginx_status {\n    allow 127.0.0.1;\n    deny all;\n}',
    apache: '<Location "/server-status">\n    Require local\n</Location>',
  },
  'directory-listing': {
    nginx: 'autoindex off;',
    apache: 'Options -Indexes',
  },
  'version-disclosure': {
    nginx: 'server_tokens off;',
    apache: 'ServerTokens Prod\nServerSignature Off\nHeader always unset X-Powered-By',
  },
  'cookie-not-secure': {
    nginx: 'proxy_cookie_flags ~ secure httponly samesite=lax;',
    apache: 'Header always edit Set-Cookie ^(.*)$ "$1; Secure; HttpOnly; SameSite=Lax"',
  },
  'cookie-no-httponly': {
    nginx: 'proxy_cookie_flags ~ secure httponly samesite=lax;',
    apache: 'Header always edit Set-Cookie ^(.*)$ "$1; Secure; HttpOnly; SameSite=Lax"',
  },
  'cookie-no-samesite': {
    nginx: 'proxy_cookie_flags ~ samesite=lax;',
    apache: 'Header always edit Set-Cookie ^(.*)$ "$1; SameSite=Lax"',
  },
  'security-txt-missing': {
    file: 'Contact: mailto:security@example.com\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: fr, en',
  },
};
