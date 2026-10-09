import { expect, it } from 'vitest';
import { particionTiktok, rangoDeParte, TAMANO_PARTE_YOUTUBE } from './particion';

it.each([
  [3_000_000, { chunkSize: 3_000_000, total: 1 }],
  [60_000_000, { chunkSize: 60_000_000, total: 1 }],
  [100_000_000, { chunkSize: 33_554_432, total: 2 }],
])('particionTiktok(%i)', (size, esperado) => expect(particionTiktok(size)).toEqual(esperado));

it('la última parte absorbe el resto', () => {
  const p = particionTiktok(100_000_000);
  expect(rangoDeParte(0, 100_000_000, p)).toEqual({ inicio: 0, fin: 33_554_431 });
  expect(rangoDeParte(1, 100_000_000, p)).toEqual({ inicio: 33_554_432, fin: 99_999_999 });
});

it('TAMANO_PARTE_YOUTUBE es múltiplo de 256 KiB', () => expect(TAMANO_PARTE_YOUTUBE % 262_144).toBe(0));
