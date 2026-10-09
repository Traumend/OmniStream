import type { Destino, EstadoDestino, Platform, Publicacion } from '@omnistream/core';

export const publicacionDePrueba = (cambios: Partial<Publicacion> = {}): Publicacion => ({
  id: 'p1',
  kind: 'independiente',
  status: 'programada',
  title: 'Mi corto',
  assetId: 'a1',
  base: { text: 'Hola', hashtags: ['mar'] },
  scheduledAt: new Date('2026-10-08T16:30:00Z'),
  targetStatus: {},
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
  ...cambios,
});

export const destinoDePrueba = (
  platform: Platform,
  status: EstadoDestino = 'pendiente_manual',
  cambios: Partial<Destino> = {},
): Destino => ({
  platform,
  format: platform === 'youtube' ? 'short' : platform === 'tiktok' ? 'tiktok' : 'reel',
  overrides: {},
  scheduleVersion: 1,
  publishMode: 'manual',
  status,
  statusChangedAt: new Date('2026-10-08T16:30:00Z'),
  scheduledAt: new Date('2026-10-08T16:30:00Z'),
  parentRef: { status: 'no_aplica' },
  attempts: 1,
  ...cambios,
});
