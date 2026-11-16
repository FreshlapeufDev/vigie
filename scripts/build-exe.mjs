import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const windows = process.platform === 'win32';
const output = join(dist, windows ? 'vigie.exe' : 'vigie');
const bundle = join(dist, 'vigie.cjs');
const blob = join(dist, 'vigie.blob');
const seaConfig = join(dist, 'sea-config.json');

const [major] = process.versions.node.split('.').map(Number);
if (major < 20) {
  console.error(`Node ${process.versions.node} is too old to build a standalone executable (20 or newer required).`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log('› bundling');
await build({
  entryPoints: [join(root, 'bin', 'vigie.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: `node${major}`,
  outfile: bundle,
  legalComments: 'none',
  logLevel: 'warning',
});
writeFileSync(bundle, readFileSync(bundle, 'utf8').replace(/^#!.*\n/, ''));

console.log('› preparing the application blob');
writeFileSync(seaConfig, JSON.stringify({ main: bundle, output: blob, disableExperimentalSEAWarning: true, useCodeCache: false }, null, 2));
execFileSync(process.execPath, ['--experimental-sea-config', seaConfig], { stdio: 'inherit' });

console.log('› copying the Node.js runtime');
copyFileSync(process.execPath, output);

if (windows) {
  console.log('› setting the icon and file details');
  const { rcedit } = await import('rcedit');
  const version = `${pkg.version}.0`;
  await rcedit(output, {
    icon: join(root, 'assets', 'vigie.ico'),
    'file-version': version,
    'product-version': version,
    'version-string': {
      CompanyName: 'FreshDev',
      ProductName: 'vigie',
      FileDescription: 'vigie · website security checker',
      InternalName: 'vigie',
      OriginalFilename: 'vigie.exe',
      LegalCopyright: `MIT © FreshDev`,
    },
  });
}

if (process.platform === 'darwin') execFileSync('codesign', ['--remove-signature', output], { stdio: 'inherit' });

console.log('› injecting the application');
const postject = join(root, 'node_modules', 'postject', 'dist', 'cli.js');
const args = [postject, output, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'];
if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA');
execFileSync(process.execPath, args, { stdio: 'inherit' });

if (process.platform === 'darwin') execFileSync('codesign', ['--sign', '-', output], { stdio: 'inherit' });

rmSync(blob, { force: true });
rmSync(seaConfig, { force: true });

console.log(`\n✔ ${output}`);
