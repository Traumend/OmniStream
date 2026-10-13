import type { Asset } from '../archivos/asset';
import { VALOR_PROPORCION, type Proporcion } from './reglas';

export type { Proporcion } from './reglas';

export const ASPECTOS_RECORTE = ['16:9', '9:16', '1:1', '4:5', '1.91:1'] as const satisfies readonly Proporcion[];

// Coordenadas normalizadas de 0 a 1 sobre el original ya rotado (spec 6.4).
export interface Crop {
  aspect: Proporcion;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Spec 7.4.
export const RESOLUCION_SALIDA: Record<Proporcion, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
  '1.91:1': { width: 1080, height: 566 },
};

// Spec 8.3: el recorte de video se limita a 15 minutos y 2 GB.
export const LIMITE_RECORTE_VIDEO = { duracionSec: 900, bytes: 2 * 1024 ** 3 };
// Ningún lado del recorte baja del 10 % del lado correspondiente del original.
export const LADO_MINIMO_RECORTE = 0.1;

const redondear = (valor: number): number => Math.round(valor * 10_000) / 10_000;
const acotar = (valor: number, minimo: number, maximo: number): number => Math.min(Math.max(valor, minimo), maximo);

// El recorte más grande posible con esa proporción, centrado.
export function recorteCentrado(aspect: Proporcion, ancho: number, alto: number): Crop {
  const objetivo = VALOR_PROPORCION[aspect];
  if (ancho / alto > objetivo) {
    const w = redondear((alto * objetivo) / ancho);
    return { aspect, x: redondear((1 - w) / 2), y: 0, w, h: 1 };
  }
  const h = redondear(ancho / objetivo / alto);
  return { aspect, x: 0, y: redondear((1 - h) / 2), w: 1, h };
}

// Mueve (dx, dy en unidades normalizadas) y escala desde el centro. La escala se acota para que el recorte
// quepa en el cuadro y ningún lado baje del mínimo; la proporción se conserva porque ambos lados escalan igual.
export function ajustarRecorte(crop: Crop, cambio: { dx?: number; dy?: number; escala?: number }): Crop {
  const escalaMinima = Math.max(LADO_MINIMO_RECORTE / crop.w, LADO_MINIMO_RECORTE / crop.h);
  const escalaMaxima = Math.min(1 / crop.w, 1 / crop.h);
  const escala = acotar(cambio.escala ?? 1, Math.min(escalaMinima, escalaMaxima), escalaMaxima);
  const w = Math.min(crop.w * escala, 1);
  const h = Math.min(crop.h * escala, 1);
  const centroX = crop.x + crop.w / 2 + (cambio.dx ?? 0);
  const centroY = crop.y + crop.h / 2 + (cambio.dy ?? 0);
  return {
    aspect: crop.aspect,
    x: acotar(centroX - w / 2, 0, 1 - w),
    y: acotar(centroY - h / 2, 0, 1 - h),
    w,
    h,
  };
}

const parHaciaAbajo = (valor: number): number => Math.max(0, Math.floor(valor / 2) * 2);

// Píxeles del recorte para ffmpeg y sharp: todos pares (yuv420p lo exige) y siempre dentro del cuadro.
export function pixelesDeRecorte(
  crop: Crop,
  ancho: number,
  alto: number,
): { x: number; y: number; w: number; h: number } {
  const x = parHaciaAbajo(crop.x * ancho);
  const y = parHaciaAbajo(crop.y * alto);
  const w = Math.max(2, Math.min(parHaciaAbajo(crop.w * ancho), parHaciaAbajo(ancho - x)));
  const h = Math.max(2, Math.min(parHaciaAbajo(crop.h * alto), parHaciaAbajo(alto - y)));
  return { x, y, w, h };
}

// FNV-1a de 32 bits en base 36. Sin node:crypto porque core también corre en el navegador.
export function hashRecorte(assetId: string, crop: Crop): string {
  const fuente = [assetId, crop.aspect, crop.x, crop.y, crop.w, crop.h]
    .map((v) => (typeof v === 'number' ? redondear(v).toFixed(4) : v))
    .join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < fuente.length; i++) {
    hash ^= fuente.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function recortePermitido(asset: Pick<Asset, 'kind' | 'durationSec' | 'sizeBytes'>): boolean {
  if (asset.kind !== 'video') return true;
  return (asset.durationSec ?? 0) <= LIMITE_RECORTE_VIDEO.duracionSec && asset.sizeBytes <= LIMITE_RECORTE_VIDEO.bytes;
}
