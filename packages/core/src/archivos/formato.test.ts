import { expect, it } from 'vitest';
import { formatearBytes, formatearDuracion } from './formato';

it('formatea bytes', () => {
  expect(formatearBytes(0)).toBe('0 B');
  expect(formatearBytes(1536)).toBe('1.5 KB');
  expect(formatearBytes(10.25 * 1024 ** 2)).toBe('10.3 MB');
  expect(formatearBytes(2 * 1024 ** 3)).toBe('2 GB');
});
it('formatea duraciones', () => {
  expect(formatearDuracion(4)).toBe('0:04');
  expect(formatearDuracion(75.4)).toBe('1:15');
  expect(formatearDuracion(3725)).toBe('1:02:05');
});
