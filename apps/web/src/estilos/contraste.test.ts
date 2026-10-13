import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8');
const vars: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);

const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contraste(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro! + 0.05) / (oscuro! + 0.05);
}

const textos = ['--texto', '--texto-secundario', '--oro-profundo', '--exito', '--alerta', '--peligro'];
const fondos = ['--fondo', '--superficie', '--superficie-elevada'];

describe('contraste del tema', () => {
  it.each(textos.flatMap((t) => fondos.map((f) => [t, f])))('%s sobre %s cumple 4.5:1', (t, f) => {
    expect(contraste(vars[t], vars[f])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(['--boton-oro-inicio', '--boton-oro-fin'])('--sobre-oro sobre %s cumple 4.5:1', (f) => {
    expect(contraste(vars['--sobre-oro'], vars[f])).toBeGreaterThanOrEqual(4.5);
  });
  it('--oro sobre --superficie cumple 3:1 para elementos no textuales', () => {
    expect(contraste(vars['--oro'], vars['--superficie'])).toBeGreaterThanOrEqual(3);
  });
});
