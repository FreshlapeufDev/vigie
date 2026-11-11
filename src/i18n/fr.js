const list = (items) => items.join(', ');
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const verb = (names, one, many) => (names.length === 1 ? one : many);

const TLS_REASONS = {
  CERT_HAS_EXPIRED: 'le certificat a expiré',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'le certificat est auto-signé',
  SELF_SIGNED_CERT_IN_CHAIN: 'la chaîne se termine par un certificat auto-signé',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'la chaîne de certificats est incomplète',
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "l'émetteur est inconnu ou la chaîne est incomplète",
  ERR_TLS_CERT_ALTNAME_INVALID: 'le certificat a été émis pour un autre domaine',
  CERT_NOT_YET_VALID: "le certificat n'est pas encore valide",
};

const CSP_REASONS = {
  'unsafe-inline': "les scripts inline ('unsafe-inline')",
  'unsafe-eval': "eval() ('unsafe-eval')",
  wildcard: "les scripts de n'importe quel domaine (*, https: ou data:)",
  'no-script-src': "les scripts de n'importe où (ni script-src ni default-src)",
};

export default {
  code: 'fr',
  severities: { critical: 'critique', high: 'élevée', medium: 'moyenne', low: 'faible', info: 'info' },
  severityTitles: { critical: 'Critique', high: 'Élevée', medium: 'Moyenne', low: 'Faible', info: 'Information' },
  categories: {
    transport: 'HTTPS et certificat',
    headers: 'En-têtes de sécurité',
    cookies: 'Cookies',
    exposure: 'Fichiers exposés',
    content: 'Contenu de la page',
    disclosure: "Fuite d'informations",
  },
  rules: {
    'no-https': {
      title: 'HTTPS indisponible',
      description: "Le site n'est pas joignable en HTTPS. Tout ce que les visiteurs envoient ou reçoivent, mots de passe compris, circule en clair et peut être lu ou modifié sur un Wi-Fi public.",
      fix: "Obtenez un certificat gratuit avec Let's Encrypt (certbot) ou activez HTTPS dans le panneau de votre hébergeur, puis redirigez tout le trafic HTTP vers HTTPS.",
    },
    'tls-invalid-cert': {
      title: 'Certificat refusé par les navigateurs',
      description: "Les navigateurs affichent une alerte de sécurité plein écran avant votre site. La plupart des visiteurs repartent, et ceux qui passent outre deviennent des cibles faciles pour une interception.",
      fix: "Installez un certificat valide pour ce domaine exact, avec sa chaîne complète (fullchain.pem avec Let's Encrypt), et mettez en place le renouvellement automatique.",
    },
    'tls-old-protocol': {
      title: 'Version de TLS obsolète acceptée',
      description: "TLS 1.0 et 1.1 ont des faiblesses connues et ont été abandonnés par tous les navigateurs en 2020. Les accepter ne sert qu'à permettre à un attaquant d'imposer une connexion plus faible.",
      fix: "N'autorisez que TLS 1.2 et TLS 1.3.",
    },
    'tls-expiring': {
      title: 'Certificat bientôt expiré',
      description: "À son expiration, chaque visiteur verra une alerte de sécurité et le site deviendra inutilisable.",
      fix: 'Renouvelez le certificat maintenant et vérifiez que le renouvellement automatique fonctionne (certbot renew --dry-run).',
    },
    'http-no-redirect': {
      title: 'HTTP ne redirige pas vers HTTPS',
      description: "Les visiteurs qui tapent l'adresse sans https:// restent sur une connexion non chiffrée, alors que HTTPS existe.",
      fix: 'Redirigez chaque requête http:// vers https:// avec une redirection permanente 301.',
    },
    'insecure-redirect': {
      title: 'Redirection vers HTTP',
      description: "Une redirection renvoie les visiteurs d'une page HTTPS vers une page HTTP, ce qui annule la protection de HTTPS.",
      fix: 'Faites pointer chaque redirection vers une adresse https://.',
    },
    'hsts-missing': {
      title: 'HSTS non activé',
      description: "Sans Strict-Transport-Security, le navigateur peut encore essayer HTTP en premier, ce qui laisse à un attaquant sur le même réseau la possibilité de dégrader la connexion.",
      fix: "Envoyez Strict-Transport-Security avec un max-age d'au moins un an.",
    },
    'hsts-weak': {
      title: 'Durée HSTS trop courte',
      description: 'Le navigateur oublie trop vite la règle « HTTPS uniquement », ce qui rouvre la possibilité de dégrader la connexion.',
      fix: 'Utilisez max-age=63072000 (deux ans) et ajoutez includeSubDomains dès que tous vos sous-domaines gèrent HTTPS.',
    },
    'csp-missing': {
      title: 'Aucune Content Security Policy',
      description: "Une Content-Security-Policy indique au navigateur quels scripts ont le droit de s'exécuter. Sans elle, une seule faille XSS permet à un attaquant d'exécuter n'importe quel script chez vos visiteurs.",
      fix: "Commencez par default-src 'self' et object-src 'none', puis autorisez uniquement les domaines réellement utilisés. Testez d'abord avec Content-Security-Policy-Report-Only.",
    },
    'csp-unsafe': {
      title: 'Content Security Policy trop permissive',
      description: 'La politique existe, mais elle laisse quand même passer les scripts injectés, ce qui lui retire la plus grande partie de sa protection contre les XSS.',
      fix: "Retirez 'unsafe-inline' et 'unsafe-eval', remplacez les jokers par des domaines précis, et utilisez des nonces ou des hash pour les scripts inline nécessaires.",
    },
    clickjacking: {
      title: "Page intégrable par n'importe quel site",
      description: 'Un autre site peut charger votre page dans un cadre invisible et piéger vos visiteurs pour les faire cliquer sur vos boutons (clickjacking).',
      fix: "Envoyez X-Frame-Options: SAMEORIGIN, ou frame-ancestors 'self' dans votre Content-Security-Policy.",
    },
    'cors-reflected-origin': {
      title: 'CORS fait confiance à tous les sites',
      description: "Le serveur recopie n'importe quelle Origin dans Access-Control-Allow-Origin et autorise les identifiants. N'importe quel site ouvert par un visiteur connecté peut lire ses données privées sur votre site.",
      fix: "Vérifiez l'Origin dans une liste fixe de domaines de confiance avant de la renvoyer, ou n'autorisez jamais les identifiants.",
    },
    'cors-wildcard-credentials': {
      title: 'CORS ouvert à tous avec identifiants',
      description: "Access-Control-Allow-Origin: * associé aux identifiants est invalide et montre que la politique CORS n'a pas été pensée.",
      fix: 'Renvoyez une origine de confiance explicite quand les identifiants sont nécessaires, ou supprimez Access-Control-Allow-Credentials.',
    },
    'nosniff-missing': {
      title: 'Détection MIME non bloquée',
      description: "Sans X-Content-Type-Options: nosniff, un navigateur peut exécuter un fichier envoyé par un utilisateur comme un script s'il y ressemble.",
      fix: 'Envoyez X-Content-Type-Options: nosniff sur chaque réponse.',
    },
    'referrer-policy': {
      title: "Adresses complètes transmises à d'autres sites",
      description: "Les liens vers d'autres sites peuvent leur envoyer l'adresse complète de la page, y compris les jetons ou chemins privés qu'elle contient.",
      fix: 'Envoyez Referrer-Policy: strict-origin-when-cross-origin.',
    },
    'permissions-policy-missing': {
      title: 'Aucune Permissions-Policy',
      description: "Permissions-Policy désactive les fonctions du navigateur que le site n'utilise pas (caméra, micro, position), pour qu'un code injecté ne puisse pas s'en servir non plus.",
      fix: 'Désactivez les fonctions inutiles, par exemple camera=(), microphone=(), geolocation=().',
    },
    'cookie-not-secure': {
      title: 'Cookies envoyés sans Secure',
      description: "Sans l'attribut Secure, les cookies peuvent partir en HTTP non chiffré, où n'importe qui sur le réseau peut les voler, cookies de session compris.",
      fix: 'Ajoutez Secure à chaque cookie, et HttpOnly avec SameSite=Lax aux cookies de session.',
    },
    'cookie-no-httponly': {
      title: 'Cookie de session lisible par JavaScript',
      description: "Sans HttpOnly, la moindre faille XSS permet à un attaquant de voler le cookie de session et de se connecter à la place du visiteur.",
      fix: "Ajoutez HttpOnly aux cookies de session et d'authentification.",
    },
    'cookie-no-samesite': {
      title: 'Cookies sans SameSite',
      description: "Sans SameSite, les anciens navigateurs joignent le cookie aux requêtes faites par d'autres sites, ce qui rend possibles les attaques CSRF.",
      fix: 'Ajoutez SameSite=Lax, ou SameSite=Strict pour les cookies sensibles.',
    },
    'exposed-git': {
      title: 'Dépôt Git téléchargeable',
      description: "Le dossier .git est public. N'importe qui peut reconstruire tout votre code source et son historique avec des outils gratuits, y compris les mots de passe et clés déjà commités.",
      fix: 'Bloquez tous les chemins qui commencent par un point sauf /.well-known/, retirez .git du dossier public, et changez chaque secret qui a été commité.',
    },
    'exposed-env': {
      title: 'Fichier .env téléchargeable',
      description: "Le fichier .env contient en général les mots de passe de base de données, les clés d'API et les tokens. Des robots le cherchent sur tout Internet chaque jour.",
      fix: 'Déplacez .env hors du dossier public, bloquez les fichiers cachés, et changez immédiatement tous les secrets qu\'il contient.',
    },
    'exposed-backup': {
      title: 'Sauvegarde ou export téléchargeable',
      description: "Un export de base de données, une archive ou une copie de configuration est public. Il contient souvent des données d'utilisateurs et des mots de passe.",
      fix: 'Supprimez le fichier du dossier public, gardez les sauvegardes ailleurs, et bloquez les fichiers .sql, .zip, .bak et ~.',
    },
    'exposed-config': {
      title: 'Fichier de configuration avec identifiants exposé',
      description: "Le fichier de configuration d'un outil (SFTP, npm, Docker) contenant des hôtes, mots de passe ou tokens est lisible publiquement.",
      fix: 'Retirez-le du dossier public, bloquez les fichiers cachés et changez les identifiants qu\'il contient.',
    },
    'exposed-htpasswd': {
      title: '.htpasswd téléchargeable',
      description: 'Le fichier des mots de passe de vos zones protégées est public. Ses empreintes peuvent être cassées hors ligne.',
      fix: 'Bloquez les fichiers .ht* et déplacez .htpasswd hors du dossier public.',
    },
    'exposed-phpinfo': {
      title: 'Page phpinfo() exposée',
      description: "phpinfo() révèle la version exacte de PHP, les modules, les chemins et parfois les variables d'environnement : une carte toute prête pour un attaquant.",
      fix: 'Supprimez le fichier.',
    },
    'exposed-server-status': {
      title: 'Page de statut du serveur publique',
      description: "La page de statut d'Apache affiche les requêtes en cours, les IP des clients et des adresses internes.",
      fix: 'Limitez /server-status à localhost ou désactivez mod_status.',
    },
    'directory-listing': {
      title: 'Listage des dossiers activé',
      description: "Le serveur affiche le contenu des dossiers : n'importe qui peut parcourir et télécharger des fichiers qui n'ont jamais été mis en lien.",
      fix: 'Désactivez les index automatiques.',
    },
    'exposed-ds-store': {
      title: 'Fichier .DS_Store exposé',
      description: "Ce fichier de macOS liste les noms des fichiers d'un dossier, y compris ceux qui n'étaient pas censés être trouvés.",
      fix: 'Supprimez les fichiers .DS_Store du serveur et ajoutez-les au .gitignore.',
    },
    'security-txt-missing': {
      title: 'Aucun security.txt',
      description: 'security.txt (RFC 9116) indique aux chercheurs comment vous signaler une faille au lieu de la publier.',
      fix: 'Créez /.well-known/security.txt avec au moins une ligne Contact et une ligne Expires.',
    },
    'insecure-form': {
      title: 'Mot de passe envoyé en HTTP',
      description: 'Un formulaire de connexion envoie le mot de passe vers une adresse http://. Il circule en clair, même si la page elle-même est en HTTPS.',
      fix: "Faites pointer chaque action de formulaire vers https://, ou utilisez une adresse relative.",
    },
    'mixed-content': {
      title: 'Contenu mixte',
      description: "La page HTTPS charge des ressources en http://. Les navigateurs bloquent les scripts et feuilles de style chargés ainsi, et les images peuvent être remplacées en chemin.",
      fix: 'Chargez chaque ressource en https:// ou avec une adresse relative.',
    },
    'outdated-library': {
      title: 'Bibliothèque JavaScript vulnérable',
      description: 'La page charge une version de bibliothèque avec des failles connues publiquement, que les attaquants savent exploiter.',
      fix: 'Mettez la bibliothèque à jour vers une version corrigée et supprimez les anciennes copies du serveur.',
    },
    'sri-missing': {
      title: "Scripts externes sans contrôle d'intégrité",
      description: "Si le CDN qui sert ces scripts est compromis, le code modifié s'exécute sur votre site. Subresource Integrity permet au navigateur de le refuser.",
      fix: 'Ajoutez integrity="sha384-…" et crossorigin="anonymous" aux scripts chargés depuis un CDN.',
    },
    'version-disclosure': {
      title: 'Versions des logiciels dévoilées',
      description: "Les versions exactes permettent à un attaquant de retrouver les failles correspondantes en quelques secondes.",
      fix: "Masquez les numéros de version dans les en-têtes du serveur et retirez la balise meta generator.",
    },
  },
  messages: {
    'no-https': (p) => `https://${p.host} est injoignable (${p.error})`,
    'tls-invalid-cert': (p) => `Les navigateurs refusent le certificat : ${TLS_REASONS[p.reason] ?? p.reason}`,
    'tls-old-protocol': (p) => `Le serveur accepte encore ${p.protocol}`,
    'tls-expiring': (p) => `Le certificat expire dans ${plural(p.days, 'jour', 'jours')} (${p.date})`,
    'http-no-redirect': (p) => `http:// affiche le site (HTTP ${p.status}) au lieu de rediriger vers https://`,
    'insecure-redirect': (p) => `${p.from} redirige vers ${p.to}`,
    'hsts-missing': () => "Pas d'en-tête Strict-Transport-Security",
    'hsts-weak': (p) => `max-age vaut ${plural(p.days, 'jour', 'jours')}, sous les 180 jours recommandés`,
    'csp-missing': (p) => (p.reportOnly ? "Seule une politique en mode rapport est définie : rien n'est bloqué" : 'Ni en-tête ni balise meta Content-Security-Policy'),
    'csp-unsafe': (p) => `La politique autorise ${list(p.reasons.map((reason) => CSP_REASONS[reason] ?? reason))}`,
    clickjacking: () => "Ni X-Frame-Options ni frame-ancestors n'est défini",
    'cors-reflected-origin': (p) => `Le serveur fait confiance à l'Origin ${p.origin} et autorise les identifiants`,
    'cors-wildcard-credentials': () => 'Access-Control-Allow-Origin: * est envoyé avec Access-Control-Allow-Credentials: true',
    'nosniff-missing': () => 'X-Content-Type-Options: nosniff est absent',
    'referrer-policy': (p) => (p.value ? `Referrer-Policy "${p.value}" envoie les adresses complètes aux autres sites` : 'Aucune Referrer-Policy'),
    'permissions-policy-missing': () => "Pas d'en-tête Permissions-Policy",
    'cookie-not-secure': (p) => `${list(p.names)} ${verb(p.names, 'est défini', 'sont définis')} sans Secure`,
    'cookie-no-httponly': (p) => `${list(p.names)} ${verb(p.names, 'est lisible', 'sont lisibles')} par JavaScript`,
    'cookie-no-samesite': (p) => `${list(p.names)} ${verb(p.names, "n'a", "n'ont")} pas d'attribut SameSite`,
    'exposed-git': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'exposed-env': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'exposed-backup': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'exposed-config': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'exposed-htpasswd': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'exposed-phpinfo': (p) => `${list(p.paths)} ${verb(p.paths, 'affiche', 'affichent')} phpinfo()`,
    'exposed-server-status': (p) => `${list(p.paths)} ${verb(p.paths, 'est public', 'sont publics')}`,
    'directory-listing': (p) => `Contenu du dossier affiché sur ${list(p.paths ?? [p.path])}`,
    'exposed-ds-store': (p) => `${list(p.paths)} ${verb(p.paths, 'est téléchargeable', 'sont téléchargeables')} publiquement`,
    'security-txt-missing': () => 'Aucun /.well-known/security.txt avec une ligne Contact',
    'insecure-form': (p) => `Formulaire de mot de passe envoyé vers ${list(p.actions)}`,
    'mixed-content': (p) => `${plural(p.active, 'ressource active', 'ressources actives')} et ${plural(p.passive, 'image', 'images')} en http://`,
    'outdated-library': (p) => (p.name === 'AngularJS' ? `AngularJS ${p.version} n'est plus maintenu depuis 2022` : `${p.name} ${p.version} est concerné par ${p.advisory} (corrigé en ${p.fixed})`),
    'sri-missing': (p) => `${plural(p.count, 'script', 'scripts')} de ${list(p.hosts)} sans attribut integrity`,
    'version-disclosure': (p) => `${plural(p.items.length, 'en-tête ou balise révèle', 'en-têtes ou balises révèlent')} des versions de logiciels`,
  },
  verdicts: {
    'A+': 'Excellent. Continuez à vérifier après chaque changement.',
    A: 'Très bien. Il ne reste que de petites améliorations.',
    B: 'Bonne base, quelques faiblesses à corriger.',
    C: 'Plusieurs faiblesses. Prévoyez les corrections rapidement.',
    D: 'Faible. Les visiteurs et les données sont exposés.',
    F: 'Critique. Corrigez les constats critiques immédiatement.',
  },
  ui: {
    tagline: (v) => `v${v} · vérificateur de sécurité web · conçu par FreshDev`,
    target: 'cible',
    final: 'arrivée',
    tls: 'tls',
    requests: 'requêtes',
    unreachable: 'injoignable',
    findings: (n) => plural(n, 'constat', 'constats'),
    score: 'score',
    fix: 'correctif',
    evidence: 'preuve',
    written: { html: 'Rapport HTML', json: 'JSON' },
    probeOff: 'recherche de fichiers exposés désactivée (--no-probe)',
    certValid: (to) => `valide jusqu'au ${to}`,
  },
  report: {
    documentTitle: 'Rapport de sécurité web',
    reference: 'Référence',
    date: 'Date',
    scope: 'Périmètre',
    tool: 'Outil',
    overallRisk: 'Note globale',
    preparedWith: 'Établi avec vigie par FreshDev',
    contents: 'Sommaire',
    sections: { summary: 'Synthèse', matrix: 'Matrice des risques', findings: 'Constats', scope: 'Périmètre et méthode' },
    summary: (s) => {
      const parts = [`vigie a vérifié ${plural(s.targets, 'site', 'sites')} en ${plural(s.requests, 'requête', 'requêtes')}.`];
      if (s.total === 0) parts.push("Aucun constat n'a été relevé.");
      else parts.push(`L'analyse a relevé ${plural(s.total, 'constat', 'constats')} (${s.breakdown.map(([sev, n]) => `${n} ${sev}`).join(', ')}).`);
      return parts.join(' ');
    },
    statement: {
      'A+': "Le site suit les bonnes pratiques actuelles pour HTTPS, les en-têtes de sécurité, les cookies et l'exposition des fichiers.",
      A: 'La configuration est solide. Les points restants sont des mesures de durcissement.',
      B: "L'essentiel est en place, mais certaines protections manquent.",
      C: "Plusieurs attaques courantes ne sont pas bloquées. Les corrections tiennent en général en quelques lignes de configuration du serveur.",
      D: 'Des protections importantes manquent et certaines faiblesses sont directement exploitables.',
      F: 'Au moins un constat expose dès maintenant le site, ses données ou ses visiteurs. Il doit être corrigé en priorité absolue.',
    },
    priorities: 'Actions prioritaires',
    noPriorities: 'Aucune action requise.',
    category: 'Catégorie',
    total: 'Total',
    severity: 'Sévérité',
    rule: 'Contrôle',
    location: 'Site',
    weakness: 'Faiblesse',
    description: 'Description',
    observation: 'Constat',
    evidence: 'Preuve',
    recommendation: 'Recommandation',
    example: 'Exemple',
    noFindings: 'Aucun constat.',
    scopeIntro: "Les sites suivants ont été vérifiés. Seules des pages publiques ont été demandées, comme le ferait n'importe quel visiteur.",
    website: 'Site',
    findingsCol: 'Constats',
    landed: 'Arrivée',
    grade: 'Note',
    score: 'Score',
    status: 'Statut',
    unreachable: 'Injoignable',
    certificate: 'Certificat',
    headersTitle: 'En-têtes de réponse',
    redirects: 'Redirections',
    method: 'Méthode',
    methodText: "vigie envoie des requêtes HTTP ordinaires, comme un navigateur : il suit les redirections, lit le certificat TLS, les en-têtes de réponse, les cookies et le HTML de la page d'accueil, puis demande une courte liste de chemins sensibles (.git, .env, sauvegardes, phpinfo…). Un fichier n'est signalé que si son contenu correspond vraiment à ce type de fichier : les sites qui répondent à toutes les adresses avec leur page d'accueil ne provoquent donc pas de fausse alerte. Les secrets trouvés dans les fichiers exposés ne sont jamais affichés.",
    limits: 'Limites',
    limitsText: "vigie ne se connecte à aucun compte, n'envoie aucun formulaire et ne tente aucune attaque. Il ne voit que ce qu'un visiteur anonyme voit à l'adresse donnée. Une bonne note ne prouve pas que l'application elle-même est exempte de failles.",
    print: 'Imprimer / PDF',
    filter: 'Afficher',
    scoreOf: (n) => `${n}/100`,
  },
  help: (c) => `  ${c.bold('Utilisation')}
    vigie ${c.gray('<url> [url…]')}             vérifier un ou plusieurs sites

  ${c.bold('Options')}
    --html <fichier>          rapport d'audit HTML bilingue
    --json                    sortie JSON au lieu du rapport console
    --lang <fr|en>            langue de la sortie ${c.gray('(défaut : langue du système)')}
    --fail-under <note>       code de sortie 1 sous cette note (A+, A, B, C, D) ${c.gray('(pour la CI)')}
    --no-probe                lire seulement la page d'accueil, sans chercher de fichiers exposés
    --timeout <secondes>      par requête ${c.gray('(défaut : 10)')}
    -q, --quiet               n'afficher que le résumé
    --no-banner               masquer le logo FreshDev

  ${c.bold('Exemples')}
    ${c.gray('$')} vigie exemple.fr
    ${c.gray('$')} vigie https://boutique.exemple.fr --html audit.html --lang fr
    ${c.gray('$')} vigie exemple.fr --fail-under B

  ${c.gray('Ne vérifiez que des sites qui vous appartiennent ou que vous êtes autorisé à tester.')}
`,
  errors: {
    noTarget: 'Adresse du site manquante',
    noTargetHint: 'Exemple : vigie exemple.fr',
    invalidUrl: (value) => `Adresse invalide : ${value}`,
    invalidGrade: (value) => `Note invalide : '${value}'`,
    gradeHint: 'Utilisez A+, A, B, C ou D',
    invalidLang: (value) => `Langue non prise en charge : '${value}'`,
    needsFile: (flag) => `--${flag} attend un nom de fichier`,
    invalidTimeout: (value) => `Délai invalide : '${value}'`,
  },
};
