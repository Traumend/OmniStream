import { expect, it } from 'vitest';
import { reescrituras } from './reescrituras';

it('sin base y en producción no reescribe nada', () => {
  expect(reescrituras(undefined, false)).toEqual([]);
});

it('en desarrollo usa el emulador de funciones', () => {
  expect(reescrituras(undefined, true)).toContainEqual({
    source: '/api/conexiones/retorno',
    destination: 'http://127.0.0.1:5001/demo-omnistream/us-central1/retornoConexion',
  });
});

it('con base, las 3 reglas', () => {
  expect(reescrituras('https://us-central1-mi-proyecto.cloudfunctions.net', false)).toEqual([
    {
      source: '/api/conexiones/retorno',
      destination: 'https://us-central1-mi-proyecto.cloudfunctions.net/retornoConexion',
    },
    {
      source: '/api/meta/borrado-datos',
      destination: 'https://us-central1-mi-proyecto.cloudfunctions.net/borradoDatosMeta',
    },
    { source: '/api/media/:token', destination: 'https://us-central1-mi-proyecto.cloudfunctions.net/media/:token' },
  ]);
});
