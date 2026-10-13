import type { EntradaPublicacion } from '@omnistream/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { crearAutoguardado, type EstadoGuardado } from './autoguardado';

const entrada = (title: string): EntradaPublicacion => ({
  title,
  assetId: 'a1',
  base: { text: '', hashtags: [] },
  scheduledAt: null,
  parentId: null,
  destinos: [],
});

type Guardar = (entrada: EntradaPublicacion) => Promise<{ postId: string }>;

function preparar(guardar = vi.fn<Guardar>(async () => ({ postId: 'p1' }))) {
  const estados: EstadoGuardado[] = [];
  const autoguardado = crearAutoguardado({ guardar, alEstado: (e) => estados.push(e) });
  return { autoguardado, guardar, estados };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it('guarda una vez 1 s después del último cambio', async () => {
  const { autoguardado, guardar, estados } = preparar();
  autoguardado.programar(entrada('a'));
  await vi.advanceTimersByTimeAsync(600);
  autoguardado.programar(entrada('ab'));
  await vi.advanceTimersByTimeAsync(999);
  expect(guardar).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(guardar).toHaveBeenCalledTimes(1);
  expect(guardar).toHaveBeenCalledWith(entrada('ab'));
  expect(estados.at(-1)).toBe('guardado');
});

it('nunca hay dos guardados en curso y el segundo usa la última entrada', async () => {
  let terminar: (v: { postId: string }) => void = () => {};
  let enCurso = 0;
  let maximo = 0;
  const guardar = vi.fn<Guardar>(async () => {
    enCurso++;
    maximo = Math.max(maximo, enCurso);
    const resultado = await new Promise<{ postId: string }>((r) => (terminar = r));
    enCurso--;
    return resultado;
  });
  const { autoguardado } = preparar(guardar);
  autoguardado.programar(entrada('a'));
  await vi.advanceTimersByTimeAsync(1000);
  autoguardado.programar(entrada('b'));
  await vi.advanceTimersByTimeAsync(1000);
  autoguardado.programar(entrada('c'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(guardar).toHaveBeenCalledTimes(1);
  terminar({ postId: 'p1' });
  await vi.advanceTimersByTimeAsync(0);
  expect(guardar).toHaveBeenCalledTimes(2);
  // El segundo guardado usa la última entrada y el id que devolvió el primero.
  expect(guardar.mock.calls[1]?.[0]).toEqual({ ...entrada('c'), postId: 'p1' });
  terminar({ postId: 'p1' });
  await vi.advanceTimersByTimeAsync(0);
  expect(maximo).toBe(1);
});

it('vaciar guarda lo pendiente y devuelve el postId', async () => {
  const { autoguardado, guardar } = preparar();
  autoguardado.programar(entrada('a'));
  await expect(autoguardado.vaciar()).resolves.toBe('p1');
  expect(guardar).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2000);
  expect(guardar).toHaveBeenCalledTimes(1);
  await expect(autoguardado.vaciar()).resolves.toBe('p1');
});

it('un error deja el estado error y el siguiente cambio reintenta', async () => {
  const guardar = vi.fn<Guardar>(async () => ({ postId: 'p1' })).mockRejectedValueOnce(new Error('sin red'));
  const { autoguardado, estados } = preparar(guardar);
  autoguardado.programar(entrada('a'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(estados.at(-1)).toBe('error');
  autoguardado.programar(entrada('b'));
  await vi.advanceTimersByTimeAsync(1000);
  expect(guardar).toHaveBeenCalledTimes(2);
  expect(estados.at(-1)).toBe('guardado');
});
