import { describe, expect, it } from 'vitest';
import {
  decidirToma,
  estaAtascado,
  estaVencida,
  idContinuacion,
  idReferencia,
  idTarea,
  necesitaEncolarse,
} from './cola';

const ahora = new Date('2026-10-07T12:00:00Z');
const en = (ms: number) => new Date(ahora.getTime() + ms);

describe('decidirToma', () => {
  const programada = { status: 'programada', scheduleVersion: 2, scheduledAt: ahora } as const;
  it.each([
    [null, 2, { tomar: false, motivo: 'inexistente' }],
    [programada, 1, { tomar: false, motivo: 'version' }],
    [{ ...programada, scheduledAt: en(61_000) }, 2, { tomar: false, motivo: 'anticipada' }],
    [{ ...programada, scheduledAt: en(30_000) }, 2, { tomar: true, continuar: false }],
    [programada, 2, { tomar: true, continuar: false }],
    [
      { ...programada, status: 'publicando', lease: { attemptId: 'a', until: en(60_000) } },
      2,
      { tomar: false, motivo: 'ocupada' },
    ],
    [
      { ...programada, status: 'publicando', lease: { attemptId: 'a', until: en(-1) } },
      2,
      { tomar: true, continuar: true },
    ],
    [{ ...programada, status: 'publicando' }, 2, { tomar: true, continuar: true }],
    [{ ...programada, status: 'publicada' }, 2, { tomar: false, motivo: 'estado' }],
  ] as const)('%#', (destino, version, esperado) => {
    expect(decidirToma(destino, version, ahora)).toEqual(esperado);
  });
});

it('idTarea', () => {
  expect(idTarea('abc', 'tiktok', 3)).toBe('abc-tiktok-v3');
  expect(idTarea('abc', 'tiktok', 3, 2)).toBe('abc-tiktok-v3-r2');
});

it('necesitaEncolarse: programada, sin tarea de su versión y dentro de 29 días', () => {
  const base = { status: 'programada', scheduleVersion: 1, scheduledAt: en(1000) } as const;
  expect(necesitaEncolarse(base, ahora)).toBe(true);
  expect(necesitaEncolarse({ ...base, enqueuedVersion: 1 }, ahora)).toBe(false);
  expect(necesitaEncolarse({ ...base, scheduledAt: en(30 * 86_400_000) }, ahora)).toBe(false);
  expect(necesitaEncolarse({ ...base, status: 'borrador' }, ahora)).toBe(false);
});

it('estaAtascado: publicando sin lease vigente', () => {
  const hace = (ms: number) => ({ status: 'publicando', statusChangedAt: en(-ms) }) as const;
  expect(estaAtascado({ ...hace(0), lease: { attemptId: 'a', until: en(-1) } }, ahora)).toBe(true);
  expect(estaAtascado(hace(16 * 60_000), ahora)).toBe(true);
  expect(estaAtascado({ ...hace(0), lease: { attemptId: 'a', until: en(1000) } }, ahora)).toBe(false);
});

it('estaAtascado: sin lease y con cambio reciente espera su continuación', () => {
  expect(estaAtascado({ status: 'publicando', statusChangedAt: en(-60_000) }, ahora)).toBe(false);
});

it('estaVencida: programada con su tarea encolada y la hora pasada hace más de 15 minutos', () => {
  const base = { status: 'programada', scheduleVersion: 2, enqueuedVersion: 2, scheduledAt: en(-16 * 60_000) } as const;
  expect(estaVencida(base, ahora)).toBe(true);
  expect(estaVencida({ ...base, scheduledAt: en(-14 * 60_000) }, ahora)).toBe(false);
  expect(estaVencida({ ...base, enqueuedVersion: 1 }, ahora)).toBe(false);
  expect(estaVencida({ ...base, status: 'pendiente_manual' }, ahora)).toBe(false);
});

it('ids de continuación y de referencia', () => {
  expect(idContinuacion('p1', 'tiktok', 3, 2)).toBe('p1-tiktok-v3-c2');
  expect(idReferencia('p1', 'facebook', 3)).toBe('p1-facebook-ref-v3');
});
