import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pixelesDeRecorte, type Crop } from '@omnistream/core';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';

const ejecutar = promisify(execFile);
const ffmpeg = ffmpegPath as unknown as string;

// Deja margen dentro de los 1.800 s de generarRecorte para marcar el resultado.
const LIMITE_RECORTE_MS = 1_700_000;

interface Rectangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParametrosRecorteVideo {
  url: string;
  cabeceras?: string;
  px: Rectangulo;
  salida: { width: number; height: number };
  destino: string;
}

// ffmpeg aplica la rotación del original antes del filtro (autorrotado por defecto), así que el recorte
// se expresa sobre el cuadro ya rotado y la salida no lleva rotación.
export function argumentosRecorteVideo({ url, cabeceras, px, salida, destino }: ParametrosRecorteVideo): string[] {
  // prettier-ignore
  return [
    '-v', 'error',
    ...(cabeceras ? ['-headers', cabeceras] : []),
    '-i', url,
    '-map', '0:v:0', '-map', '0:a:0?',
    '-vf', `crop=${px.w}:${px.h}:${px.x}:${px.y},scale=${salida.width}:${salida.height},setsar=1`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart',
    '-y', destino,
  ];
}

export async function recortarVideo(parametros: ParametrosRecorteVideo): Promise<void> {
  await ejecutar(ffmpeg, argumentosRecorteVideo(parametros), {
    timeout: LIMITE_RECORTE_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 10 * 1024 * 1024,
  });
}

// rotate() sin argumentos aplica la orientación EXIF, así el recorte se mide sobre la imagen como se ve.
export async function recortarImagen(
  entrada: Buffer,
  crop: Crop,
  salida: { width: number; height: number },
): Promise<Buffer> {
  const rotada = await sharp(entrada).rotate().toBuffer({ resolveWithObject: true });
  const px = pixelesDeRecorte(crop, rotada.info.width, rotada.info.height);
  return sharp(rotada.data)
    .extract({ left: px.x, top: px.y, width: px.w, height: px.h })
    .resize(salida.width, salida.height)
    .jpeg({ quality: 90 })
    .toBuffer();
}
