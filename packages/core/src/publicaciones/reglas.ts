import { contarCaracteres } from './texto';
import type { FormatoDestino, Platform } from './tipos';

export type Proporcion = '16:9' | '9:16' | '1:1' | '4:5' | '1.91:1';

export const VALOR_PROPORCION: Record<Proporcion, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:5': 4 / 5,
  '1.91:1': 1.91,
};

// Misma tolerancia que describirProporcion.
const TOLERANCIA_PROPORCION = 0.02;

export interface ReglaFormato {
  etiqueta: string;
  tipoArchivo: 'video' | 'image';
  duracionMinSec?: number;
  duracionMaxSec?: number;
  duracionMaxEsAdvertencia?: boolean;
  proporciones: Proporcion[]; // recomendadas; vacía = libre
  rangoProporcion?: [number, number];
  limiteTexto?: number;
  limiteHashtags?: number;
}

// Spec 7.4. Los valores se verifican contra la documentación oficial en la fase 2B.
export const REGLAS: Record<Platform, Partial<Record<FormatoDestino, ReglaFormato>>> = {
  facebook: {
    reel: {
      etiqueta: 'Facebook · Reel',
      tipoArchivo: 'video',
      duracionMinSec: 3,
      duracionMaxSec: 90,
      proporciones: ['9:16'],
    },
    video_largo: { etiqueta: 'Facebook · Video', tipoArchivo: 'video', proporciones: [] },
    imagen: { etiqueta: 'Facebook · Imagen', tipoArchivo: 'image', proporciones: [] },
  },
  instagram: {
    reel: {
      etiqueta: 'Instagram · Reel',
      tipoArchivo: 'video',
      duracionMinSec: 3,
      duracionMaxSec: 900,
      proporciones: ['9:16'],
      limiteTexto: 2200,
      limiteHashtags: 30,
    },
    imagen: {
      etiqueta: 'Instagram · Imagen',
      tipoArchivo: 'image',
      proporciones: ['4:5', '1:1', '1.91:1'],
      rangoProporcion: [0.8, 1.91],
      limiteTexto: 2200,
      limiteHashtags: 30,
    },
  },
  youtube: {
    video_largo: { etiqueta: 'YouTube · Video largo', tipoArchivo: 'video', proporciones: ['16:9'] },
    short: {
      etiqueta: 'YouTube · Short',
      tipoArchivo: 'video',
      duracionMaxSec: 180,
      duracionMaxEsAdvertencia: true,
      proporciones: ['9:16', '1:1'],
    },
  },
  tiktok: {
    tiktok: { etiqueta: 'TikTok · Video', tipoArchivo: 'video', proporciones: ['9:16'], limiteTexto: 2200 },
    imagen: { etiqueta: 'TikTok · Imagen', tipoArchivo: 'image', proporciones: ['9:16'], limiteTexto: 2200 },
  },
};

export function reglaDe(platform: Platform, format: FormatoDestino): ReglaFormato {
  const regla = REGLAS[platform][format];
  if (!regla) throw new Error(`No hay regla para ${platform} ${format}`);
  return regla;
}

export function proporcionCompatible(regla: ReglaFormato, aspect: number): boolean {
  if (regla.rangoProporcion) {
    const [minimo, maximo] = regla.rangoProporcion;
    return aspect >= minimo * (1 - TOLERANCIA_PROPORCION) && aspect <= maximo * (1 + TOLERANCIA_PROPORCION);
  }
  if (regla.proporciones.length === 0) return true;
  return regla.proporciones.some(
    (p) => Math.abs(aspect - VALOR_PROPORCION[p]) / VALOR_PROPORCION[p] <= TOLERANCIA_PROPORCION,
  );
}

// La descripción se mide en bytes UTF-8 (spec 7.4, verificado en la fase 2B).
export const LIMITES_YOUTUBE = { titulo: 100, descripcion: 5000, etiquetas: 500 } as const;

export const contarBytesUtf8 = (texto: string): number => new TextEncoder().encode(texto).length;

export interface LimiteApi {
  tamanoMaxBytes?: number;
  tiposMime?: readonly string[];
  duracionMaxSec?: number;
}

// Límites de las APIs (V3, verificados el 2026-10-08). Solo aplican a destinos en modo API. MB decimales.
export const LIMITES_API: Record<Platform, Partial<Record<FormatoDestino, LimiteApi>>> = {
  facebook: {
    imagen: {
      tamanoMaxBytes: 10_000_000,
      tiposMime: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'],
    },
  },
  instagram: {
    reel: { tamanoMaxBytes: 300_000_000 },
    imagen: { tamanoMaxBytes: 8_000_000, tiposMime: ['image/jpeg'] },
  },
  youtube: {},
  tiktok: {
    tiktok: { tamanoMaxBytes: 4_000_000_000, duracionMaxSec: 600 },
    imagen: { tamanoMaxBytes: 20_000_000, tiposMime: ['image/jpeg', 'image/webp'] },
  },
};

export const LIMITE_MENCIONES_INSTAGRAM = 20;

// YouTube cuenta las comas entre etiquetas y las comillas que rodean a las etiquetas con espacios.
export function largoEtiquetasYoutube(tags: readonly string[]): number {
  const letras = tags.reduce((suma, t) => suma + contarCaracteres(t) + (t.includes(' ') ? 2 : 0), 0);
  return letras + Math.max(0, tags.length - 1);
}
