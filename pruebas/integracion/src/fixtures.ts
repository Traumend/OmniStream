import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const ejecutar = promisify(execFile);
const directorio = resolve(import.meta.dirname, '../.fixtures');

export interface Fixtures {
  video: string;
  imagen: string;
  danado: string;
}

export async function prepararFixtures(): Promise<Fixtures> {
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
