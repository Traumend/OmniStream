import { expect, it } from 'vitest';
import { describirProporcion, dimensionesEfectivas, tiemposDeFotogramas } from './fotogramas';

it('usa segundo 1, mitad y un segundo antes del final', () => {
  expect(tiemposDeFotogramas(60)).toEqual({ start: 1, middle: 30, end: 59 });
});
it('ajusta videos de menos de 2 segundos', () => {
  expect(tiemposDeFotogramas(1.5)).toEqual({ start: 0, middle: 0.75, end: 1.4 });
});
it('rechaza duraciones inválidas', () => {
  expect(() => tiemposDeFotogramas(0)).toThrow(RangeError);
  expect(() => tiemposDeFotogramas(Number.NaN)).toThrow(RangeError);
});
it('intercambia dimensiones con rotación de 90 o 270 grados', () => {
  expect(dimensionesEfectivas(1920, 1080, 90)).toEqual({ width: 1080, height: 1920, aspect: 0.5625 });
  expect(dimensionesEfectivas(1920, 1080, -90)).toEqual({ width: 1080, height: 1920, aspect: 0.5625 });
  expect(dimensionesEfectivas(1920, 1080, 180)).toEqual({ width: 1920, height: 1080, aspect: 1.7778 });
});
it('describe proporciones comunes con tolerancia del 2 %', () => {
  expect(describirProporcion(0.5625)).toBe('9:16');
  expect(describirProporcion(0.565)).toBe('9:16');
  expect(describirProporcion(1.7778)).toBe('16:9');
  expect(describirProporcion(1)).toBe('1:1');
  expect(describirProporcion(0.8)).toBe('4:5');
  expect(describirProporcion(1.91)).toBe('1.91:1');
  expect(describirProporcion(1.5)).toBe('1.5:1');
});
