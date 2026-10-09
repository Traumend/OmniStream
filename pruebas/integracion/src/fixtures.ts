import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const ejecutar = promisify(execFile);
// Se busca la raíz del monorepo desde el directorio actual para funcionar tanto en Vitest (ESM) como en Playwright (CJS).
function raizDelRepositorio(): string {
  let actual = process.cwd();
  while (!existsSync(join(actual, 'pnpm-workspace.yaml'))) {
    const padre = dirname(actual);
    if (padre === actual) throw new Error('No se encontró la raíz del monorepo');
    actual = padre;
  }
  return actual;
}

export interface Fixtures {
  video: string;
  imagen: string;
  danado: string;
}

export async function prepararFixtures(): Promise<Fixtures> {
  const directorio = join(raizDelRepositorio(), 'pruebas/integracion/.fixtures');
  await mkdir(directorio, { recursive: true });
  const fixtures: Fixtures = {
    video: join(directorio, 'video-vertical.mp4'),
    imagen: join(directorio, 'imagen.jpg'),
    danado: join(directorio, 'danado.mp4'),
  };
  const ffmpeg = ffmpegPath as unknown as string;
  if (!existsSync(fixtures.video)) {
    await ejecutar(ffmpeg, [
      '-v', 'error',
      '-f', 'lavfi', '-i', 'testsrc=size=720x1280:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440',
      '-t', '4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart',
      '-y', fixtures.video,
    ]);
  }
  if (!existsSync(fixtures.imagen)) {
    await ejecutar(ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=0xB08442:s=1200x800', '-frames:v', '1', '-y', fixtures.imagen]);
  }
  if (!existsSync(fixtures.danado)) await writeFile(fixtures.danado, randomBytes(64 * 1024));
  return fixtures;
}
