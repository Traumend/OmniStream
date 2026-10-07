import { expect, it } from 'vitest';
import { verificarUsuario } from './bloqueos';

it('devuelve el claim owner para el correo permitido', () => {
  expect(
    verificarUsuario({ email: 'propietario@omnistream.test', emailVerified: true }, 'propietario@omnistream.test'),
  ).toEqual({ customClaims: { owner: true } });
});

it('lanza permission-denied con mensaje en español', () => {
  expect(() =>
    verificarUsuario({ email: 'intruso@ejemplo.com', emailVerified: true }, 'propietario@omnistream.test'),
  ).toThrowError(
    expect.objectContaining({ code: 'permission-denied', message: 'Esta cuenta no tiene acceso a OmniStream.' }),
  );
});
