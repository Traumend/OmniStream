import { expect, it } from 'vitest';
import { crearCifrador } from './cifrado';

const clave = Buffer.alloc(32, 7).toString('base64');

it('cifra y descifra', () => {
  const c = crearCifrador(clave);
  const s = c.cifrar('{"accessToken":"secreto"}');
  expect(s.keyVersion).toBe(1);
  expect(s.ciphertext).not.toContain('secreto');
  expect(c.descifrar(s)).toBe('{"accessToken":"secreto"}');
});

it('dos cifrados del mismo texto usan iv distinto', () => {
  const c = crearCifrador(clave);
  expect(c.cifrar('x').iv).not.toBe(c.cifrar('x').iv);
});

it('un authTag alterado no descifra', () => {
  const c = crearCifrador(clave);
  const s = c.cifrar('x');
  const etiqueta = Buffer.from(s.authTag, 'base64');
  etiqueta[0] = (etiqueta[0] ?? 0) ^ 0xff;
  expect(() => c.descifrar({ ...s, authTag: etiqueta.toString('base64') })).toThrow();
});

it('otra llave no descifra', () => {
  const s = crearCifrador(clave).cifrar('x');
  expect(() => crearCifrador(Buffer.alloc(32, 8).toString('base64')).descifrar(s)).toThrow();
});

it('la llave debe tener 32 bytes', () => {
  expect(() => crearCifrador('YWJj')).toThrow('La llave de cifrado debe tener 32 bytes en base64.');
});
