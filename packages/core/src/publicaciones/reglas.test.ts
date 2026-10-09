import { expect, it } from 'vitest';
import { FORMATOS, FORMATOS_POR_RED, PLATAFORMAS } from './tipos';
import { largoEtiquetasYoutube, REGLAS } from './reglas';

it('hay regla exactamente para cada formato permitido', () => {
  for (const p of PLATAFORMAS)
    for (const f of FORMATOS) expect(REGLAS[p][f] !== undefined).toBe(FORMATOS_POR_RED[p].includes(f));
});
it('largoEtiquetasYoutube cuenta comas y comillas de las etiquetas con espacios', () => {
  expect(largoEtiquetasYoutube(['uno', 'dos palabras'])).toBe(3 + 14 + 1);
});
