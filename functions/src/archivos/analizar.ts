import { dimensionesEfectivas } from '@omnistream/core';

export interface FfprobePista {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  duration?: string;
  tags?: Record<string, string>;
  side_data_list?: { side_data_type?: string; rotation?: number }[];
}

export interface FfprobeSalida {
  streams?: FfprobePista[];
  format?: { duration?: string };
}

export interface AnalisisVideo {
  width: number;
  height: number;
  aspect: number;
  durationSec: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  rotation: number;
}

export class ErrorAnalisis extends Error {
  constructor(readonly codigo: 'sin_pista_video' | 'duracion_invalida') {
    super(codigo);
    this.name = 'ErrorAnalisis';
  }
}

function leerRotacion(pista: FfprobePista): number {
  const matriz = pista.side_data_list?.find((d) => typeof d.rotation === 'number')?.rotation;
  const valor = matriz ?? Number(pista.tags?.rotate ?? 0);
  const rotacion = Number.isFinite(valor) ? valor : 0;
  return ((rotacion % 360) + 360) % 360;
}

function leerFps(fraccion?: string): number {
  const [numerador, denominador] = (fraccion ?? '0/1').split('/').map(Number);
  if (!numerador || !denominador) return 0;
  return Math.round((numerador / denominador) * 100) / 100;
}

export function analizarSalidaFfprobe(salida: FfprobeSalida): AnalisisVideo {
  const pistas = salida.streams ?? [];
  const video = pistas.find((p) => p.codec_type === 'video');
  if (!video?.width || !video.height) throw new ErrorAnalisis('sin_pista_video');

  const duracion = Number.parseFloat(salida.format?.duration ?? video.duration ?? '');
  if (!Number.isFinite(duracion) || duracion <= 0) throw new ErrorAnalisis('duracion_invalida');

  const rotation = leerRotacion(video);
  return {
    ...dimensionesEfectivas(video.width, video.height, rotation),
    durationSec: Math.round(duracion * 1000) / 1000,
    fps: leerFps(video.r_frame_rate),
    hasAudio: pistas.some((p) => p.codec_type === 'audio'),
    codec: video.codec_name ?? 'desconocido',
    rotation,
  };
}
