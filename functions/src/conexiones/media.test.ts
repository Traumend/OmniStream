import { expect, it } from 'vitest';
import { firmarTokenMedia, verificarTokenMedia } from './media';

const CLAVE = Buffer.alloc(32, 4).toString('base64');
const AHORA = 1_900_000_000_000;
const HORA = 3_600_000;

it('el token de media vale una hora y no admite alteraciones', () => {
  const token = firmarTokenMedia(CLAVE, 'originales/a1', AHORA + HORA);
  expect(verificarTokenMedia(CLAVE, token, AHORA)).toBe('originales/a1');
  expect(verificarTokenMedia(CLAVE, token, AHORA + HORA + 1)).toBeNull();

  const [, expira, firma] = token.split('.');
  const otraRuta = Buffer.from('originales/a2').toString('base64url');
  expect(verificarTokenMedia(CLAVE, `${otraRuta}.${expira}.${firma}`, AHORA)).toBeNull();
  expect(verificarTokenMedia(CLAVE, token.replace(`.${expira}.`, `.${AHORA + 2 * HORA}.`), AHORA)).toBeNull();
  expect(verificarTokenMedia(Buffer.alloc(32, 5).toString('base64'), token, AHORA)).toBeNull();
  expect(verificarTokenMedia(CLAVE, 'basura', AHORA)).toBeNull();
});
