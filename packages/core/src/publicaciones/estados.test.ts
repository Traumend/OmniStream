import { describe, expect, it } from 'vitest';
import { esEditable, estadoPublicacion, sePuedeEliminar, sePuedeMover } from './estados';

describe('estadoPublicacion', () => {
  it.each([
    [[], 'programada', 'borrador'],
    [['cancelada', 'cancelada'], 'programada', 'borrador'],
    [['borrador'], 'idea', 'idea'],
    [['borrador', 'borrador'], 'borrador', 'borrador'],
    [['publicada', 'publicada'], 'programada', 'publicada'],
    [['publicada', 'publicando'], 'programada', 'publicando'],
    [['publicada', 'pendiente_manual'], 'programada', 'programada'],
    [['programada', 'fallida'], 'programada', 'programada'],
    [['publicada', 'fallida'], 'programada', 'parcial'],
    [['fallida', 'cancelada'], 'programada', 'fallida'],
    [['publicada', 'cancelada'], 'programada', 'publicada'],
  ] as const)('%j desde %s → %s', (estados, actual, esperado) => {
    expect(estadoPublicacion(estados, actual)).toBe(esperado);
  });
});

it('esEditable solo con borrador, programada o cancelada', () => {
  expect(esEditable([])).toBe(true);
  expect(esEditable(['borrador', 'programada', 'cancelada'])).toBe(true);
  expect(esEditable(['programada', 'pendiente_manual'])).toBe(false);
  expect(esEditable(['fallida'])).toBe(false);
});

it('sePuedeEliminar salvo publicada o publicando', () => {
  expect(sePuedeEliminar(['fallida', 'pendiente_manual', 'cancelada'])).toBe(true);
  expect(sePuedeEliminar(['publicada'])).toBe(false);
  expect(sePuedeEliminar(['publicando'])).toBe(false);
});

it('sePuedeMover exige que sea editable y que la nueva fecha sea futura', () => {
  const ahora = new Date('2026-10-07T12:00:00Z');
  expect(sePuedeMover(['programada'], new Date('2026-10-08T12:00:00Z'), ahora)).toBe(true);
  expect(sePuedeMover(['programada'], new Date('2026-10-07T11:59:00Z'), ahora)).toBe(false);
  expect(sePuedeMover(['publicada'], new Date('2026-10-08T12:00:00Z'), ahora)).toBe(false);
});
