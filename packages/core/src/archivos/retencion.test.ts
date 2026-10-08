import { expect, it } from 'vitest';
import { calcularPurga, fechaDePurgaVisible, posponerHasta } from './retencion';

const ahora = new Date('2026-10-07T12:00:00Z');
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
const base = { createdAt: hace(40), retentionDays: 7, ahora };

it('sin usos se purga a los 30 días de creado', () => {
  expect(calcularPurga({ ...base, usos: [] })).toEqual(hace(10));
});
it('con un uso no terminal no se purga', () => {
  expect(
    calcularPurga({
      ...base,
      usos: [
        { status: 'publicada', statusChangedAt: hace(9) },
        { status: 'programada', statusChangedAt: hace(9) },
      ],
    }),
  ).toBeNull();
});
it('todos terminales: el último más los días de retención', () => {
  expect(
    calcularPurga({
      ...base,
      usos: [
        { status: 'publicada', statusChangedAt: hace(9) },
        { status: 'cancelada', statusChangedAt: hace(8) },
      ],
    }),
  ).toEqual(hace(1));
});
it('un fallido cuenta como terminal a los 30 días', () => {
  expect(calcularPurga({ ...base, usos: [{ status: 'fallida', statusChangedAt: hace(10) }] })).toBeNull();
  expect(calcularPurga({ ...base, usos: [{ status: 'fallida', statusChangedAt: hace(35) }] })).toEqual(hace(-2));
});
it('posponer gana si es posterior', () => {
  expect(calcularPurga({ ...base, usos: [], retainUntil: hace(-5) })).toEqual(hace(-5));
});

it('fechaDePurgaVisible es la mayor entre purgeAt y retainUntil', () => {
  expect(fechaDePurgaVisible({})).toBeUndefined();
  expect(fechaDePurgaVisible({ purgeAt: hace(1), retainUntil: hace(-3) })).toEqual(hace(-3));
  expect(fechaDePurgaVisible({ purgeAt: hace(-4), retainUntil: hace(-3) })).toEqual(hace(-4));
});
it('posponerHasta suma 7 días a la fecha visible, o a hoy si ya pasó', () => {
  expect(posponerHasta({ purgeAt: hace(-2) }, ahora)).toEqual(hace(-9));
  expect(posponerHasta({ purgeAt: hace(3) }, ahora)).toEqual(hace(-7));
  expect(posponerHasta({}, ahora)).toEqual(hace(-7));
});

it('con 0 días de retención se purga en cuanto el último destino queda terminal', () => {
  expect(
    calcularPurga({
      ...base,
      retentionDays: 0,
      usos: [
        { status: 'publicada', statusChangedAt: hace(2) },
        { status: 'cancelada', statusChangedAt: hace(1) },
      ],
    }),
  ).toEqual(hace(1));
});
