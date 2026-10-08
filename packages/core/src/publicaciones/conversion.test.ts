import { expect, it } from 'vitest';
import { destinoNuevo, leerDestino, leerPublicacion } from './conversion';

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
