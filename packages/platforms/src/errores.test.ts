import { expect, it } from 'vitest';
import { esPlatformError, PlatformError } from './errores';

it('PlatformError conserva tipo, código y mensaje', () => {
  const e = new PlatformError('auth', 'token', 'Vuelve a conectar.');
  expect(e).toBeInstanceOf(Error);
  expect(e).toMatchObject({ kind: 'auth', code: 'token', message: 'Vuelve a conectar.' });
  expect(esPlatformError(e)).toBe(true);
  expect(esPlatformError(new Error('x'))).toBe(false);
});
