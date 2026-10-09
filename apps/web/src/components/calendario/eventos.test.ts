import type { Publicacion } from '@omnistream/core';
import { expect, it } from 'vitest';
import { aEventos } from './eventos';

const ahora = new Date('2026-10-07T12:00:00Z');
const manana = new Date('2026-10-09T10:00:00Z');
const pub = (cambios: Partial<Publicacion> = {}): Publicacion => ({
  id: 'p1',
  kind: 'independiente',
  status: 'programada',
  title: 'Mi corto',
  base: { text: '', hashtags: [] },
  scheduledAt: manana,
  targetStatus: { tiktok: 'programada' },
  createdAt: ahora,
  updatedAt: ahora,
  ...cambios,
});

it('una publicación programada futura es arrastrable', () => {
  const [e] = aEventos([pub()], ahora);
  expect(e).toMatchObject({
    id: 'p1',
    title: 'Mi corto',
    start: manana,
    editable: true,
    classNames: ['evento-publicacion', 'evento-programada'],
    extendedProps: { status: 'programada', targetStatus: { tiktok: 'programada' } },
  });
});

it('publicada, en curso o en el pasado no se arrastra', () => {
  const [publicada, enCurso, pasada] = aEventos(
    [
      pub({ id: 'a', status: 'publicada', targetStatus: { tiktok: 'publicada' } }),
      pub({ id: 'b', targetStatus: { tiktok: 'pendiente_manual' } }),
      pub({ id: 'c', scheduledAt: new Date('2026-10-07T11:00:00Z') }),
    ],
    ahora,
  );
  expect(publicada?.editable).toBe(false);
  expect(enCurso?.editable).toBe(false);
  expect(pasada?.editable).toBe(false);
});

it('las ideas llevan su clase propia y se mueven si son futuras', () => {
  const [e] = aEventos([pub({ status: 'idea', targetStatus: {} })], ahora);
  expect(e).toMatchObject({ editable: true, classNames: ['evento-publicacion', 'evento-idea'] });
});

it('resalta la publicación indicada', () => {
  const [otra, resaltada] = aEventos([pub({ id: 'p0' }), pub({ id: 'p1' })], ahora, 'p1');
  expect(otra?.classNames).not.toContain('evento-resaltado');
  expect(resaltada?.classNames).toContain('evento-resaltado');
});

it('omite publicaciones sin fecha', () => {
  expect(aEventos([pub({ scheduledAt: null })], ahora)).toEqual([]);
});
