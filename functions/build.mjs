// Empaqueta las funciones en dist/ para el emulador y el despliegue.
// Los paquetes del monorepo (@omnistream/*) quedan dentro del paquete; las dependencias de npm
// se instalan en dist/ como en Cloud Functions.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const raiz = import.meta.dirname;
const dist = join(raiz, 'dist');
const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const dependencias = paquete.dependencies ?? {};

rmSync(join(dist, 'index.js'), { force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(raiz, 'src/index.ts')],
  outfile: join(dist, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: Object.keys(dependencias).flatMap((nombre) => [nombre, `${nombre}/*`]),
  logLevel: 'warning',
});

writeFileSync(
  join(dist, 'package.json'),
  `${JSON.stringify(
    { name: 'omnistream-functions', private: true, main: 'index.js', engines: { node: '22' }, dependencies: dependencias },
    null,
    2,
  )}\n`,
);

for (const archivo of readdirSync(raiz)) {
  if (archivo.startsWith('.env')) copyFileSync(join(raiz, archivo), join(dist, archivo));
}

if (!process.argv.includes('--sin-instalar')) {
  execFileSync('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], {
    cwd: dist,
    stdio: 'inherit',
  });
}
