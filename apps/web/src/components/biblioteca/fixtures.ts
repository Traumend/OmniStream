import type { Asset } from '@omnistream/core';
import type { ProgresoSubida } from '@/lib/archivos/gestorSubidas';

export const subiendo: Asset = {
  id: 'a1',
  kind: 'video',
  source: 'subida',
  originalName: 'clip.mp4',
  storagePath: 'originales/a1',
  mimeType: 'video/mp4',
  sizeBytes: 1000,
  status: 'subiendo',
  createdAt: new Date('2026-10-07T12:00:00Z'),
};

export const videoListo: Asset = {
  ...subiendo,
  id: 'a2',
  originalName: 'video-vertical.mp4',
  status: 'listo',
  width: 720,
  height: 1280,
  aspect: 0.5625,
  durationSec: 4,
  fps: 30,
  hasAudio: true,
  codec: 'h264',
  frames: { start: 'fotogramas/a2/start.jpg', middle: 'fotogramas/a2/middle.jpg', end: 'fotogramas/a2/end.jpg' },
};

export const imagenLista: Asset = {
  ...subiendo,
  id: 'a3',
  kind: 'image',
  originalName: 'foto.jpg',
  mimeType: 'image/jpeg',
  status: 'listo',
  width: 1200,
  height: 800,
  aspect: 1.5,
  frames: { start: 'fotogramas/a3/start.jpg' },
};

export const progreso: ProgresoSubida = {
  assetId: 'a1',
  nombre: 'clip.mp4',
  bytesTransferidos: 0,
  bytesTotales: 1000,
  estado: 'subiendo',
};
