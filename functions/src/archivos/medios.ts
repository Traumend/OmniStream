import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dimensionesEfectivas } from '@omnistream/core';
import ffmpegPath from 'ffmpeg-static';
import ffprobe from 'ffprobe-static';
import convertirHeic from 'heic-convert';
import sharp from 'sharp';
import type { FfprobeSalida } from './analizar';

const ejecutar = promisify(execFile);
const ffmpeg = ffmpegPath as unknown as string;

const opcionesCabeceras = (cabeceras?: string) => (cabeceras ? ['-headers', cabeceras] : []);

export async function probar(url: string, cabeceras?: string): Promise<FfprobeSalida> {
  const { stdout } = await ejecutar(
    ffprobe.path,
    ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', ...opcionesCabeceras(cabeceras), url],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as FfprobeSalida;
}

export async function extraerFotograma(url: string, segundo: number, destino: string, cabeceras?: string): Promise<void> {
  await ejecutar(ffmpeg, [
    '-v', 'error',
    '-ss', String(segundo),
    ...opcionesCabeceras(cabeceras),
    '-i', url,
    '-frames:v', '1',
    '-vf', "scale='min(1280,iw)':-2",
    '-q:v', '3',
    '-y', destino,
  ]);
}

const ROTACION_EXIF: Record<number, number> = { 3: 180, 5: 90, 6: 90, 7: 270, 8: 270 };

export async function procesarImagen(
  entrada: Buffer,
): Promise<{ width: number; height: number; aspect: number; rotation: number; miniatura: Buffer }> {
  const metadatos = await sharp(entrada).metadata();
  const rotation = ROTACION_EXIF[metadatos.orientation ?? 1] ?? 0;
  const miniatura = await sharp(entrada)
    .rotate()
    .resize({ width: 1280, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  return { ...dimensionesEfectivas(metadatos.width ?? 0, metadatos.height ?? 0, rotation), rotation, miniatura };
}

export async function convertirHeicAJpeg(entrada: Buffer): Promise<Buffer> {
  return Buffer.from(await convertirHeic({ buffer: entrada, format: 'JPEG', quality: 0.9 }));
}
