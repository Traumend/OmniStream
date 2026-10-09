import { expect, it } from 'vitest';
import { ETIQUETAS_ESTADO, estadoVisible, rutaFotograma, rutaOriginal } from './asset';

it('construye rutas de Storage', () => {
  expect(rutaOriginal('abc')).toBe('originales/abc');
  expect(rutaFotograma('abc', 'middle')).toBe('fotogramas/abc/middle.jpg');
});
it('marca como interrumpida una subida que no está activa en esta sesión', () => {
  expect(estadoVisible({ id: 'a', status: 'subiendo' }, new Set(['a']))).toBe('subiendo');
  expect(estadoVisible({ id: 'a', status: 'subiendo' }, new Set())).toBe('interrumpido');
  expect(estadoVisible({ id: 'a', status: 'listo' }, new Set())).toBe('listo');
});
it('tiene etiquetas en español', () => {
  expect(ETIQUETAS_ESTADO).toEqual({
    subiendo: 'Subiendo',
    procesando: 'Procesando',
    listo: 'Listo',
    fallido: 'Error',
    interrumpido: 'Subida interrumpida',
    purgado: 'Purgado',
  });
});
