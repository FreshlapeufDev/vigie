# Changelog

All notable changes to vigie are listed here. Versions follow [Semantic Versioning](https://semver.org).

## 1.1.0

### Added
- `vigie.exe`: a standalone Windows app, attached to every GitHub release. Double-click it, type an address, read the results. No Node.js needed.
- Step-by-step assistant, started by `vigie` with no argument or by `--interactive`: live progress, big grade, problems grouped by urgency, a plain-language explanation and the concrete risk for every check, and the full report saved to `Documents/vigie` and opened in the browser.
- Plain-language explanations of all 34 checks in English and French.

### Changed
- The version number is now built into the code, so the bundled app does not need to read `package.json`.

## 1.0.0

### Added
- 34 checks across HTTPS and certificates, security headers, cookies, exposed files, page content and information disclosure.
- Content signatures and a soft-404 baseline, so sites that answer every path with their home page do not cause false alarms.
- Score out of 100 and grades from A+ to F.
- Console output with the FreshDev logo, JSON output and a bilingual HTML audit report that prints to A4.
- nginx and Apache configuration examples for every fix that can be done in the server.
- English and French everywhere, with `--lang` and system language detection.
- `--fail-under` for CI and `--no-probe` for passive checks only.
