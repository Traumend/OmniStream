import { expect, it } from 'vitest';
import {
  asignarHija,
  crearPromocion,
  fechaBasePromocion,
  PLANTILLA_PROMOCION_POR_DEFECTO,
  proximos,
  recalcularFechas,
  vencidosSinAviso,
  type ItemPromocion,
} from './promocion';

const BASE = new Date('2026-10-10T15:00:00Z');
const DIA = 86_400_000;
const en = (dias: number, desde = BASE) => new Date(desde.getTime() + dias * DIA);
const ids = () => {
  let n = 0;
  return () => `i${++n}`;
};
const item = (cambios: Partial<ItemPromocion> = {}): ItemPromocion => ({
  id: 'x',
  type: 'short',
  title: 'Short',
  offsetDays: 1,
  dueAt: en(1),
  dueAtEdited: false,
  status: 'pendiente',
  ...cambios,
});

it('la plantilla por defecto crea 5 pendientes con fechas relativas a la base', () => {
  const items = crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, ids());
  expect(items.map((i) => [i.id, i.type, i.title, i.dueAt?.toISOString(), i.status, i.dueAtEdited])).toEqual([
    ['i1', 'short', 'Short 1', '2026-10-11T15:00:00.000Z', 'pendiente', false],
    ['i2', 'short', 'Short 2', '2026-10-13T15:00:00.000Z', 'pendiente', false],
    ['i3', 'short', 'Short 3', '2026-10-15T15:00:00.000Z', 'pendiente', false],
    ['i4', 'comunidad', 'Post en Comunidad', '2026-10-12T15:00:00.000Z', 'pendiente', false],
    ['i5', 'exposicion', 'Exposición en medios propios', '2026-10-10T15:00:00.000Z', 'pendiente', false],
  ]);
});

it('sin fecha base los pendientes quedan sin fecha', () => {
  const items = crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, null, ids());
  expect(items.every((i) => i.dueAt === null)).toBe(true);
});

it('recalcular mueve las fechas no editadas, conserva las editadas y rearma el aviso', () => {
  const editada = item({ id: 'a', dueAt: en(10), dueAtEdited: true, notifiedAt: en(10) });
  const avisada = item({ id: 'b', offsetDays: 2, dueAt: en(2), notifiedAt: en(2) });
  const hecha = item({ id: 'c', offsetDays: 3, dueAt: en(3), status: 'hecho', notifiedAt: en(3) });
  const nuevaBase = en(5);
  const [a, b, c] = recalcularFechas([editada, avisada, hecha], nuevaBase);
  expect(a).toEqual(editada);
  expect(b?.dueAt).toEqual(en(2, nuevaBase));
  expect(b?.notifiedAt).toBeUndefined();
  expect(c?.dueAt).toEqual(en(3, nuevaBase));
  expect(c?.notifiedAt).toEqual(en(3));
  expect(recalcularFechas([avisada], BASE)[0]).toBe(avisada);
});

it('una Hija cumple el siguiente short y no se asigna dos veces', () => {
  const items = crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, ids());
  const primera = asignarHija(items, 'h1');
  expect(primera[0]).toMatchObject({ status: 'hecho', hijaId: 'h1' });
  expect(primera.slice(1).every((i) => i.status === 'pendiente')).toBe(true);
  expect(asignarHija(primera, 'h1')).toBe(primera);
  const segunda = asignarHija(primera, 'h2');
  expect(segunda[1]).toMatchObject({ status: 'hecho', hijaId: 'h2' });
  const sinShorts = asignarHija(asignarHija(segunda, 'h3'), 'h4');
  expect(sinShorts.filter((i) => i.hijaId === 'h4')).toEqual([]);
  expect(sinShorts.find((i) => i.type === 'comunidad')?.status).toBe('pendiente');
});

it('vencidosSinAviso excluye los hechos, los futuros y los ya avisados', () => {
  const ahora = en(3);
  const vencido = item({ id: 'v', dueAt: en(2) });
  const items = [
    vencido,
    item({ id: 'h', dueAt: en(2), status: 'hecho' }),
    item({ id: 'f', dueAt: en(4) }),
    item({ id: 'a', dueAt: en(1), notifiedAt: en(1) }),
    item({ id: 's', dueAt: null }),
  ];
  expect(vencidosSinAviso(items, ahora)).toEqual([vencido]);
});

it('proximos devuelve los pendientes de los próximos 7 días', () => {
  const ahora = BASE;
  const items = [
    item({ id: 'lejos', dueAt: en(8) }),
    item({ id: 'pronto', dueAt: en(3) }),
    item({ id: 'vencido', dueAt: en(-1) }),
    item({ id: 'hecho', dueAt: en(2), status: 'hecho' }),
    item({ id: 'sin', dueAt: null }),
  ];
  expect(proximos(items, ahora).map((i) => i.id)).toEqual(['vencido', 'pronto']);
  expect(proximos(items, ahora, 10).map((i) => i.id)).toEqual(['vencido', 'pronto', 'lejos']);
});

it('la fecha base prefiere la publicación real en YouTube', () => {
  const principal = { scheduledAt: en(0) };
  const publicada = en(1);
  const programada = en(2);
  expect(
    fechaBasePromocion(principal, {
      remote: { id: 'v', url: 'https://youtu.be/v', publishedAt: publicada },
      scheduledAt: programada,
    }),
  ).toEqual(publicada);
  expect(fechaBasePromocion(principal, { scheduledAt: programada })).toEqual(programada);
  expect(fechaBasePromocion(principal)).toEqual(en(0));
  expect(fechaBasePromocion({ scheduledAt: null })).toBeNull();
});
