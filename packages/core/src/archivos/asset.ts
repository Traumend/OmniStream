import type { Fotograma } from './fotogramas';

export type EstadoAsset = 'subiendo' | 'procesando' | 'listo' | 'fallido' | 'purgado';
export type EstadoVisible = EstadoAsset | 'interrumpido';

export interface Asset {
  id: string;
  kind: 'video' | 'image' | 'audio';
  source: 'subida' | 'tts';
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  aspect?: number;
  durationSec?: number;
  fps?: number;
  hasAudio?: boolean;
  codec?: string;
  rotation?: number;
  frames?: { start: string; middle?: string; end?: string };
  status: EstadoAsset;
  error?: string;
  createdAt: Date;
  purgeAt?: Date;
  retainUntil?: Date;
}

export const rutaOriginal = (assetId: string) => `originales/${assetId}`;
export const rutaFotograma = (assetId: string, fotograma: Fotograma) => `fotogramas/${assetId}/${fotograma}.jpg`;

export function estadoVisible(asset: Pick<Asset, 'id' | 'status'>, subidasActivas: ReadonlySet<string>): EstadoVisible {
  if (asset.status === 'subiendo' && !subidasActivas.has(asset.id)) return 'interrumpido';
  return asset.status;
}

export const ETIQUETAS_ESTADO: Record<EstadoVisible, string> = {
  subiendo: 'Subiendo',
  procesando: 'Procesando',
  listo: 'Listo',
  fallido: 'Error',
  interrumpido: 'Subida interrumpida',
  purgado: 'Purgado',
};
