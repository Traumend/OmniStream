import { expect, it } from 'vitest';
import { solicitar } from './http';
import { fetchGrabado } from './prueba/fetchGrabado';

it('devuelve la respuesta cuando clasificar no ve error', async () => {
  const http = fetchGrabado([
    { metodo: 'GET', url: 'https://api.test/a', respuesta: { status: 200, json: { ok: 1 } } },
  ]);
  const r = await solicitar(http, 'https://api.test/a', { method: 'GET' }, { red: 'YouTube', clasificar: () => null });
  expect(r.json).toEqual({ ok: 1 });
  expect(http.pendientes()).toBe(0);
});

it('un error de red es temporal y, en el paso final, ambiguo', async () => {
  const http = fetchGrabado([{ metodo: 'POST', url: 'https://api.test/b', respuesta: 'sin_respuesta' }]);
  await expect(
    solicitar(http, 'https://api.test/b', { method: 'POST' }, { red: 'YouTube', clasificar: () => null }),
  ).rejects.toMatchObject({ kind: 'temporal', code: 'red', message: 'No se pudo conectar con YouTube.' });
  const otra = fetchGrabado([{ metodo: 'POST', url: 'https://api.test/b', respuesta: 'sin_respuesta' }]);
  await expect(
    solicitar(otra, 'https://api.test/b', { method: 'POST' }, { red: 'YouTube', clasificar: () => null, final: true }),
  ).rejects.toMatchObject({ kind: 'ambiguo' });
});

it.each([
  [429, { kind: 'temporal' }],
  [503, { kind: 'temporal' }],
  [401, { kind: 'auth', message: 'El acceso a YouTube venció. Vuelve a conectarla.' }],
  [400, { kind: 'definitivo', message: 'YouTube respondió con un error (400).' }],
])('sin clasificación específica, %i', async (status, esperado) => {
  const http = fetchGrabado([{ metodo: 'GET', url: 'https://api.test/c', respuesta: { status, json: {} } }]);
  await expect(
    solicitar(http, 'https://api.test/c', { method: 'GET' }, { red: 'YouTube', clasificar: () => null }),
  ).rejects.toMatchObject(esperado);
});

it('la clasificación propia tiene prioridad', async () => {
  const http = fetchGrabado([{ metodo: 'GET', url: /\/d$/, respuesta: { status: 400, json: { error: 'x' } } }]);
  await expect(
    solicitar(
      http,
      'https://api.test/d',
      { method: 'GET' },
      { red: 'YouTube', clasificar: () => new PlatformErrorDePrueba() },
    ),
  ).rejects.toMatchObject({ kind: 'temporal', code: 'propio' });
});

it('fetchGrabado rechaza una petición inesperada', async () => {
  const http = fetchGrabado([{ metodo: 'GET', url: 'https://api.test/a', respuesta: { status: 200 } }]);
  await expect(http('https://api.test/otra', { method: 'GET' })).rejects.toThrow(/inesperada/);
});

import { PlatformError } from './errores';
class PlatformErrorDePrueba extends PlatformError {
  constructor() {
    super('temporal', 'propio', 'Propio.');
  }
}
