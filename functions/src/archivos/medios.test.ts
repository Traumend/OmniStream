import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { analizarSalidaFfprobe } from './analizar';
import { extraerFotograma, probar, procesarImagen } from './medios';

let directorio: string;
let rutaVideo: string;

beforeAll(async () => {
  directorio = await mkdtemp(join(tmpdir(), 'medios-'));
  rutaVideo = join(directorio, 'vertical.mp4');
  await promisify(execFile)(ffmpegPath as unknown as string, [
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=720x1280:rate=30',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440',
    '-t',
    '3',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-y',
    rutaVideo,
  ]);
});

afterAll(async () => {
  await rm(directorio, { recursive: true, force: true });
});

it('probar y analizar leen el video generado', async () => {
  const r = analizarSalidaFfprobe(await probar(rutaVideo));
  expect(r).toMatchObject({ width: 720, height: 1280, hasAudio: true });
  expect(r.durationSec).toBeCloseTo(3, 0);
});

it('extraerFotograma escribe un JPEG', async () => {
  const destino = join(directorio, 'fotograma.jpg');
  await extraerFotograma(rutaVideo, 1.5, destino);
  expect((await readFile(destino)).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
});

it('procesarImagen aplica la orientación EXIF', async () => {
  const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#B08442' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const r = await procesarImagen(jpg);
  expect(r).toMatchObject({ width: 800, height: 1200, rotation: 90 });
  expect((await sharp(r.miniatura).metadata()).format).toBe('jpeg');
});

async function servidorMudo(): Promise<{ servidor: Server; url: string }> {
  const servidor = createServer(() => {});
  await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const { port } = servidor.address() as AddressInfo;
  return { servidor, url: `http://127.0.0.1:${port}/video.mp4` };
}

function cerrar(servidor: Server) {
  servidor.closeAllConnections();
  servidor.close();
}

it('probar falla si el origen no responde dentro del tiempo máximo', async () => {
  const { servidor, url } = await servidorMudo();
  const inicio = Date.now();
  try {
    await expect(probar(url, undefined, 1_000)).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(8_000);
  } finally {
    cerrar(servidor);
  }
}, 15_000);

it('extraerFotograma falla si el origen no responde dentro del tiempo máximo', async () => {
  const { servidor, url } = await servidorMudo();
  const inicio = Date.now();
  try {
    await expect(extraerFotograma(url, 1, join(directorio, 'nunca.jpg'), undefined, 1_000)).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(8_000);
  } finally {
    cerrar(servidor);
  }
}, 15_000);
