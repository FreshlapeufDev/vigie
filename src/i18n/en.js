const list = (items) => items.join(', ');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const TLS_REASONS = {
  CERT_HAS_EXPIRED: 'the certificate has expired',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'the certificate is self-signed',
  SELF_SIGNED_CERT_IN_CHAIN: 'the chain ends with a self-signed certificate',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'the certificate chain is incomplete',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: 'the issuer is unknown or the chain is incomplete',
  ERR_TLS_CERT_ALTNAME_INVALID: 'the certificate was issued for another domain',
  CERT_NOT_YET_VALID: 'the certificate is not valid yet',
};

const CSP_REASONS = {
  'unsafe-inline': "inline scripts ('unsafe-inline')",
  'unsafe-eval': "eval() ('unsafe-eval')",
  wildcard: 'scripts from any host (*, https: or data:)',
  'no-script-src': 'scripts from anywhere (no script-src or default-src)',
};

export default {
  code: 'en',
  severities: { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'info' },
  severityTitles: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Informational' },
  categories: {
    transport: 'HTTPS & certificate',
    headers: 'Security headers',
    cookies: 'Cookies',
    exposure: 'Exposed files',
    content: 'Page content',
    disclosure: 'Information disclosure',
  },
  rules: {
    'no-https': {
      title: 'HTTPS is not available',
      description: 'The site cannot be reached over HTTPS. Everything visitors send or receive, passwords included, travels in clear text and can be read or modified on public Wi-Fi.',
      fix: 'Get a free certificate from Let\'s Encrypt (certbot) or enable HTTPS in your host\'s panel, then redirect all HTTP traffic to HTTPS.',
    },
    'tls-invalid-cert': {
      title: 'Certificate rejected by browsers',
      description: 'Browsers show a full-page security warning before your site. Most visitors leave, and those who click through become easy targets for interception.',
      fix: 'Install a valid certificate for this exact domain with its full chain (fullchain.pem with Let\'s Encrypt) and set up automatic renewal.',
    },
    'tls-old-protocol': {
      title: 'Obsolete TLS version accepted',
      description: 'TLS 1.0 and 1.1 have known weaknesses and were retired by every major browser in 2020. Accepting them only helps attackers force a weaker connection.',
      fix: 'Allow TLS 1.2 and TLS 1.3 only.',
    },
    'tls-expiring': {
      title: 'Certificate expires soon',
      description: 'When it expires, every visitor gets a security warning and the site becomes unusable.',
      fix: 'Renew the certificate now and check that automatic renewal works (certbot renew --dry-run).',
    },
    'http-no-redirect': {
      title: 'HTTP does not redirect to HTTPS',
      description: 'Visitors who type the address without https:// stay on an unencrypted connection, even though HTTPS exists.',
      fix: 'Redirect every http:// request to https:// with a permanent 301 redirect.',
    },
    'insecure-redirect': {
      title: 'Redirect back to HTTP',
      description: 'A redirect sends visitors from an HTTPS page to an HTTP one, which cancels the protection of HTTPS.',
      fix: 'Make every redirect point to an https:// address.',
    },
    'hsts-missing': {
      title: 'HSTS is not enabled',
      description: 'Without Strict-Transport-Security, the browser may still try HTTP first, which leaves a window for an attacker on the same network to downgrade the connection.',
      fix: 'Send Strict-Transport-Security with a max-age of at least one year.',
    },
    'hsts-weak': {
      title: 'HSTS duration too short',
      description: 'The browser forgets the HTTPS-only rule too quickly, which reopens the downgrade window.',
      fix: 'Use max-age=63072000 (two years) and add includeSubDomains once every subdomain supports HTTPS.',
    },
    'csp-missing': {
      title: 'No Content Security Policy',
      description: 'A Content-Security-Policy tells the browser which scripts may run. Without it, a single XSS flaw lets an attacker run any script in your visitors\' browsers.',
      fix: "Start with default-src 'self' and object-src 'none', then allow only the domains you really use. Test it first with Content-Security-Policy-Report-Only.",
    },
    'csp-unsafe': {
      title: 'Content Security Policy too permissive',
      description: 'The policy exists but lets injected scripts run anyway, which removes most of its protection against XSS.',
      fix: "Remove 'unsafe-inline' and 'unsafe-eval', replace wildcards with exact domains, and use nonces or hashes for the inline scripts you need.",
    },
    clickjacking: {
      title: 'Page can be framed by any site',
      description: 'Another site can load your page in an invisible frame and trick visitors into clicking buttons (clickjacking).',
      fix: "Send X-Frame-Options: SAMEORIGIN, or frame-ancestors 'self' in your Content-Security-Policy.",
    },
    'cors-reflected-origin': {
      title: 'CORS trusts every website',
      description: 'The server copies any Origin into Access-Control-Allow-Origin and allows credentials. Any website a logged-in visitor opens can read their private data from your site.',
      fix: 'Check the Origin against a fixed list of trusted domains before returning it, or never allow credentials.',
    },
    'cors-wildcard-credentials': {
      title: 'CORS wildcard with credentials',
      description: 'Access-Control-Allow-Origin: * combined with credentials is invalid and shows the CORS policy was never thought through.',
      fix: 'Return an explicit trusted origin when credentials are needed, or drop Access-Control-Allow-Credentials.',
    },
    'nosniff-missing': {
      title: 'MIME sniffing not blocked',
      description: 'Without X-Content-Type-Options: nosniff, a browser may execute an uploaded file as a script if it looks like one.',
      fix: 'Send X-Content-Type-Options: nosniff on every response.',
    },
    'referrer-policy': {
      title: 'Full URLs leak to other sites',
      description: 'Links to other sites can send them the full address of the page, including tokens or private paths it may contain.',
      fix: 'Send Referrer-Policy: strict-origin-when-cross-origin.',
    },
    'permissions-policy-missing': {
      title: 'No Permissions-Policy',
      description: 'Permissions-Policy turns off browser features the site never uses (camera, microphone, location), so injected code cannot use them either.',
      fix: 'Disable the features you do not need, for example camera=(), microphone=(), geolocation=().',
    },
    'cookie-not-secure': {
      title: 'Cookies sent without Secure',
      description: 'Cookies without the Secure flag can be sent over plain HTTP, where anyone on the network can steal them, session cookies included.',
      fix: 'Add Secure to every cookie, and HttpOnly plus SameSite=Lax to session cookies.',
    },
    'cookie-no-httponly': {
      title: 'Session cookie readable by JavaScript',
      description: 'Without HttpOnly, any XSS flaw lets an attacker steal the session cookie and log in as the visitor.',
      fix: 'Add HttpOnly to session and authentication cookies.',
    },
    'cookie-no-samesite': {
      title: 'Cookies without SameSite',
      description: 'Without SameSite, older browsers attach the cookie to requests made by other sites, which enables cross-site request forgery (CSRF).',
      fix: 'Add SameSite=Lax, or SameSite=Strict for sensitive cookies.',
    },
    'exposed-git': {
      title: 'Git repository downloadable',
      description: 'The .git folder is public. Anyone can rebuild your entire source code and history with free tools, including passwords and keys ever committed.',
      fix: 'Block every path starting with a dot except /.well-known/, remove .git from the web root, and change every secret that was ever committed.',
    },
    'exposed-env': {
      title: '.env file downloadable',
      description: 'The .env file usually holds database passwords, API keys and tokens. Bots scan the whole Internet for it every day.',
      fix: 'Move .env outside the web root, block dotfiles, and change every secret it contains right now.',
    },
    'exposed-backup': {
      title: 'Backup or dump downloadable',
      description: 'A database dump, archive or configuration backup is public. It often contains user data and passwords.',
      fix: 'Delete the file from the web root, keep backups outside it, and block .sql, .zip, .bak and ~ files.',
    },
    'exposed-config': {
      title: 'Configuration file with credentials exposed',
      description: 'A tool configuration file (SFTP, npm, Docker) with hosts, passwords or tokens is publicly readable.',
      fix: 'Remove it from the web root, block dotfiles and change the credentials it contains.',
    },
    'exposed-htpasswd': {
      title: '.htpasswd downloadable',
      description: 'The password file of your protected areas is public. Its hashes can be cracked offline.',
      fix: 'Block .ht* files and move .htpasswd outside the web root.',
    },
    'exposed-phpinfo': {
      title: 'phpinfo() page exposed',
      description: 'phpinfo() reveals the exact PHP version, modules, paths and sometimes environment variables: a ready-made map for an attacker.',
      fix: 'Delete the file.',
    },
    'exposed-server-status': {
      title: 'Server status page public',
      description: 'The Apache status page lists live requests, client IPs and internal URLs.',
      fix: 'Restrict /server-status to localhost or disable mod_status.',
    },
    'directory-listing': {
      title: 'Directory listing enabled',
      description: 'The server lists the content of folders, so anyone can browse and download files that were never linked.',
      fix: 'Disable automatic indexes.',
    },
    'exposed-ds-store': {
      title: '.DS_Store file exposed',
      description: 'This macOS file lists the names of the files in a folder, including ones that were never meant to be found.',
      fix: 'Delete .DS_Store files from the server and add them to .gitignore.',
    },
    'security-txt-missing': {
      title: 'No security.txt',
      description: 'security.txt (RFC 9116) tells researchers how to report a vulnerability to you instead of publishing it.',
      fix: 'Create /.well-known/security.txt with at least a Contact and an Expires line.',
    },
    'insecure-form': {
      title: 'Password sent over HTTP',
      description: 'A login form sends the password to an http:// address. It travels in clear text, even if the page itself uses HTTPS.',
      fix: 'Point every form action to https://, or use a relative URL.',
    },
    'mixed-content': {
      title: 'Mixed content',
      description: 'The HTTPS page loads resources over http://. Browsers block scripts and styles loaded this way, and images can be swapped in transit.',
      fix: 'Load every resource over https:// or with a relative URL.',
    },
    'outdated-library': {
      title: 'Vulnerable JavaScript library',
      description: 'The page loads a library version with publicly known vulnerabilities that attackers know how to exploit.',
      fix: 'Update the library to a fixed version and remove old copies from the server.',
    },
    'sri-missing': {
      title: 'External scripts without integrity check',
      description: 'If the CDN serving these scripts is compromised, the modified code runs on your site. Subresource Integrity lets the browser refuse it.',
      fix: 'Add integrity="sha384-…" and crossorigin="anonymous" to scripts loaded from a CDN.',
    },
    'version-disclosure': {
      title: 'Software versions disclosed',
      description: 'Exact versions let attackers look up the matching vulnerabilities in seconds.',
      fix: 'Hide version numbers in server headers and remove the generator meta tag.',
    },
  },
  messages: {
    'no-https': (p) => `https://${p.host} cannot be reached (${p.error})`,
    'tls-invalid-cert': (p) => `Browsers reject the certificate: ${TLS_REASONS[p.reason] ?? p.reason}`,
    'tls-old-protocol': (p) => `The server still accepts ${p.protocol}`,
    'tls-expiring': (p) => `The certificate expires in ${plural(p.days, 'day', 'days')} (${p.date})`,
    'http-no-redirect': (p) => `http:// serves the site (HTTP ${p.status}) instead of redirecting to https://`,
    'insecure-redirect': (p) => `${p.from} redirects to ${p.to}`,
    'hsts-missing': () => 'No Strict-Transport-Security header',
    'hsts-weak': (p) => `max-age is ${plural(p.days, 'day', 'days')}, below the recommended 180 days`,
    'csp-missing': (p) => (p.reportOnly ? 'Only a report-only policy is set: nothing is blocked' : 'No Content-Security-Policy header or meta tag'),
    'csp-unsafe': (p) => `The policy allows ${list(p.reasons.map((reason) => CSP_REASONS[reason] ?? reason))}`,
    clickjacking: () => 'Neither X-Frame-Options nor frame-ancestors is set',
    'cors-reflected-origin': (p) => `The server trusts Origin ${p.origin} and allows credentials`,
    'cors-wildcard-credentials': () => 'Access-Control-Allow-Origin: * is sent with Access-Control-Allow-Credentials: true',
    'nosniff-missing': () => 'X-Content-Type-Options: nosniff is missing',
    'referrer-policy': (p) => (p.value ? `Referrer-Policy "${p.value}" sends full URLs to other sites` : 'No Referrer-Policy'),
    'permissions-policy-missing': () => 'No Permissions-Policy header',
    'cookie-not-secure': (p) => `${list(p.names)} ${p.names.length === 1 ? 'is' : 'are'} set without Secure`,
    'cookie-no-httponly': (p) => `${list(p.names)} ${p.names.length === 1 ? 'is' : 'are'} readable by JavaScript`,
    'cookie-no-samesite': (p) => `${list(p.names)} ${p.names.length === 1 ? 'has' : 'have'} no SameSite attribute`,
    'exposed-git': (p) => `${list(p.paths)} publicly downloadable`,
    'exposed-env': (p) => `${list(p.paths)} publicly downloadable`,
    'exposed-backup': (p) => `${list(p.paths)} publicly downloadable`,
    'exposed-config': (p) => `${list(p.paths)} publicly downloadable`,
    'exposed-htpasswd': (p) => `${list(p.paths)} publicly downloadable`,
    'exposed-phpinfo': (p) => `${list(p.paths)} shows phpinfo()`,
    'exposed-server-status': (p) => `${list(p.paths)} is public`,
    'directory-listing': (p) => `Folder content listed at ${list(p.paths ?? [p.path])}`,
    'exposed-ds-store': (p) => `${list(p.paths)} publicly downloadable`,
    'security-txt-missing': () => 'No /.well-known/security.txt with a Contact line',
    'insecure-form': (p) => `Password form submitted to ${list(p.actions)}`,
    'mixed-content': (p) => `${plural(p.active, 'active resource', 'active resources')} and ${plural(p.passive, 'image', 'images')} loaded over http://`,
    'outdated-library': (p) => (p.name === 'AngularJS' ? `AngularJS ${p.version} has been unmaintained since 2022` : `${p.name} ${p.version} is affected by ${p.advisory} (fixed in ${p.fixed})`),
    'sri-missing': (p) => `${plural(p.count, 'script', 'scripts')} from ${list(p.hosts)} without integrity attribute`,
    'version-disclosure': (p) => `${plural(p.items.length, 'header or tag reveals', 'headers or tags reveal')} software versions`,
  },
  verdicts: {
    'A+': 'Excellent. Keep checking after every change.',
    A: 'Very good. Only small improvements left.',
    B: 'Good base, a few weaknesses to fix.',
    C: 'Several weaknesses. Plan the fixes soon.',
    D: 'Weak. Visitors and data are exposed.',
    F: 'Critical. Fix the critical findings now.',
  },
  ui: {
    tagline: (v) => `v${v} · website security checker · crafted by FreshDev`,
    target: 'target',
    final: 'landed on',
    tls: 'tls',
    requests: 'requests',
    unreachable: 'unreachable',
    findings: (n) => plural(n, 'finding', 'findings'),
    score: 'score',
    fix: 'fix',
    evidence: 'evidence',
    written: { html: 'HTML report', json: 'JSON' },
    probeOff: 'exposed-file checks skipped (--no-probe)',
    certValid: (to) => `valid until ${to}`,
  },
  report: {
    documentTitle: 'Website security report',
    reference: 'Reference',
    date: 'Date',
    scope: 'Scope',
    tool: 'Tool',
    overallRisk: 'Overall rating',
    preparedWith: 'Prepared with vigie by FreshDev',
    contents: 'Contents',
    sections: { summary: 'Executive summary', matrix: 'Risk matrix', findings: 'Findings', scope: 'Scope and method' },
    summary: (s) => {
      const parts = [`vigie checked ${plural(s.targets, 'website', 'websites')} with ${plural(s.requests, 'request', 'requests')}.`];
      if (s.total === 0) parts.push('No finding was raised.');
      else parts.push(`It raised ${plural(s.total, 'finding', 'findings')} (${s.breakdown.map(([sev, n]) => `${n} ${sev}`).join(', ')}).`);
      return parts.join(' ');
    },
    statement: {
      'A+': 'The site follows current best practices for HTTPS, security headers, cookies and file exposure.',
      A: 'The configuration is solid. The remaining points are hardening measures.',
      B: 'The essentials are in place, but some protections are missing.',
      C: 'Several common attacks are not mitigated. The fixes are usually a few lines of server configuration.',
      D: 'Important protections are missing and some weaknesses can be exploited directly.',
      F: 'At least one finding exposes the site, its data or its visitors right now. It must be fixed before anything else.',
    },
    priorities: 'Priority actions',
    noPriorities: 'No action required.',
    category: 'Category',
    total: 'Total',
    severity: 'Severity',
    rule: 'Check',
    location: 'Website',
    weakness: 'Weakness',
    description: 'Description',
    observation: 'Observation',
    evidence: 'Evidence',
    recommendation: 'Recommendation',
    example: 'Example',
    noFindings: 'No finding.',
    scopeIntro: 'The following websites were checked. Only public pages were requested, as any visitor would.',
    website: 'Website',
    findingsCol: 'Findings',
    landed: 'Landed on',
    grade: 'Rating',
    score: 'Score',
    status: 'Status',
    unreachable: 'Unreachable',
    certificate: 'Certificate',
    headersTitle: 'Response headers',
    redirects: 'Redirects',
    method: 'Method',
    methodText: 'vigie sends ordinary HTTP requests, like a browser: it follows redirects, reads the TLS certificate, the response headers, the cookies and the HTML of the home page, then requests a short list of sensitive paths (.git, .env, backups, phpinfo…). A file is only reported when its content matches what that file really looks like, so sites that answer every address with their home page do not cause false alarms. Secrets found in exposed files are never displayed.',
    limits: 'Limits',
    limitsText: 'vigie does not log in, submit forms or attempt any attack. It only sees what an anonymous visitor sees on the address given. A good rating does not prove the application itself is free of vulnerabilities.',
    print: 'Print / PDF',
    filter: 'Show',
    scoreOf: (n) => `${n}/100`,
  },
  help: (c) => `  ${c.bold('Usage')}
    vigie ${c.gray('<url> [url…]')}             check one or more websites

  ${c.bold('Options')}
    --html <file>             write a bilingual HTML audit report
    --json                    print JSON instead of the console report
    --lang <en|fr>            language of the output ${c.gray('(default: system language)')}
    --fail-under <grade>      exit code 1 below this grade (A+, A, B, C, D) ${c.gray('(for CI)')}
    --no-probe                only read the home page, skip the exposed-file checks
    --timeout <seconds>       per request ${c.gray('(default: 10)')}
    -q, --quiet               only print the summary
    --no-banner               hide the FreshDev logo

  ${c.bold('Examples')}
    ${c.gray('$')} vigie example.com
    ${c.gray('$')} vigie https://shop.example.com --html audit.html --lang fr
    ${c.gray('$')} vigie example.com --fail-under B

  ${c.gray('Only check websites you own or are allowed to test.')}
`,
  errors: {
    noTarget: 'Missing website address',
    noTargetHint: 'Example: vigie example.com',
    invalidUrl: (value) => `Invalid address: ${value}`,
    invalidGrade: (value) => `Invalid grade '${value}'`,
    gradeHint: 'Use A+, A, B, C or D',
    invalidLang: (value) => `Unsupported language '${value}'`,
    needsFile: (flag) => `--${flag} needs a file name`,
    invalidTimeout: (value) => `Invalid timeout '${value}'`,
  },
};
