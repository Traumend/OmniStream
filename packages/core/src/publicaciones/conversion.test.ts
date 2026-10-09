import { expect, it } from 'vitest';
import { destinoNuevo, leerDestino, leerPublicacion } from './conversion';
import { CAMPOS_TIKTOK_POR_DEFECTO } from './tipos';

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

it('leerPublicacion convierte fechas y aplica valores por defecto', () => {
  const p = leerPublicacion('p1', {
    kind: 'independiente',
    status: 'borrador',
    title: 'x',
    base: { text: '', hashtags: [] },
    createdAt: ts('2026-10-01T00:00:00Z'),
    updatedAt: ts('2026-10-02T00:00:00Z'),
  });
  expect(p).toMatchObject({
    id: 'p1',
    scheduledAt: null,
    targetStatus: {},
    updatedAt: new Date('2026-10-02T00:00:00Z'),
  });
});
it('leerDestino convierte fechas anidadas y completa valores por defecto', () => {
  const d = leerDestino({
    platform: 'facebook',
    format: 'reel',
    status: 'publicando',
    statusChangedAt: ts('2026-10-07T10:00:00Z'),
    lease: { attemptId: 'a', until: ts('2026-10-07T10:15:00Z') },
  });
  expect(d).toMatchObject({
    overrides: {},
    attempts: 0,
    scheduleVersion: 0,
    publishMode: 'manual',
    parentRef: { status: 'no_aplica' },
    lease: { attemptId: 'a', until: new Date('2026-10-07T10:15:00Z') },
  });
});
it('destinoNuevo crea un borrador', () => {
  const ahora = new Date('2026-10-07T12:00:00Z');
  expect(destinoNuevo('instagram', 'reel', { esHija: true, ahora })).toEqual({
    platform: 'instagram',
    format: 'reel',
    overrides: {},
    scheduleVersion: 0,
    publishMode: 'manual',
    status: 'borrador',
    statusChangedAt: ahora,
    parentRef: { status: 'en_espera' },
    attempts: 0,
  });
});

it('leerDestino conserva los campos de TikTok y el seq del checkpoint', () => {
  const tiktok = { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' as const };
  const d = leerDestino({
    platform: 'tiktok',
    format: 'tiktok',
    tiktok,
    checkpoint: { stage: 'subiendo', data: { parte: 1 }, seq: 3 },
    parentRef: { status: 'pendiente', error: 'Falló' },
  });
  expect(d.tiktok).toEqual(tiktok);
  expect(d.checkpoint).toEqual({ stage: 'subiendo', data: { parte: 1 }, seq: 3 });
  expect(d.parentRef).toEqual({ status: 'pendiente', error: 'Falló' });
});

it('destinoNuevo incluye los campos de TikTok', () => {
  const d = destinoNuevo('tiktok', 'tiktok', { esHija: false, ahora: new Date(0), tiktok: CAMPOS_TIKTOK_POR_DEFECTO });
  expect(d.tiktok).toEqual(CAMPOS_TIKTOK_POR_DEFECTO);
});

it('leerPublicacion convierte la promoción, el origen y la espera de publicación', () => {
  const ts = (iso: string) => ({ toDate: () => new Date(iso) });
  const publicacion = leerPublicacion('p1', {
    title: 'Importado',
    origin: 'youtube_importado',
    awaitingPublicationUntil: ts('2026-10-20T00:00:00Z'),
    promotion: {
      items: [
        {
          id: 'i1',
          type: 'short',
          title: 'Short 1',
          offsetDays: 1,
          dueAt: ts('2026-10-11T15:00:00Z'),
          dueAtEdited: false,
          status: 'pendiente',
          notifiedAt: ts('2026-10-11T16:00:00Z'),
        },
        { id: 'i2', type: 'comunidad', title: 'Post', offsetDays: 2, dueAt: null, status: 'hecho', hijaId: 'h1' },
      ],
    },
  });
  expect(publicacion.origin).toBe('youtube_importado');
  expect(publicacion.awaitingPublicationUntil).toEqual(new Date('2026-10-20T00:00:00Z'));
  expect(publicacion.promotion?.items).toEqual([
    {
      id: 'i1',
      type: 'short',
      title: 'Short 1',
      offsetDays: 1,
      dueAt: new Date('2026-10-11T15:00:00Z'),
      dueAtEdited: false,
      status: 'pendiente',
      notifiedAt: new Date('2026-10-11T16:00:00Z'),
    },
    {
      id: 'i2',
      type: 'comunidad',
      title: 'Post',
      offsetDays: 2,
      dueAt: null,
      dueAtEdited: false,
      status: 'hecho',
      hijaId: 'h1',
    },
  ]);
});
