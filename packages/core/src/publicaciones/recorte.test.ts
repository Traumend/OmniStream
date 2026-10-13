import { describe, expect, it } from 'vitest';
import {
  ajustarRecorte,
  hashRecorte,
  LADO_MINIMO_RECORTE,
  pixelesDeRecorte,
  recorteCentrado,
  recortePermitido,
  RESOLUCION_SALIDA,
} from './recorte';

describe('recorteCentrado', () => {
  it('el recorte centrado 9:16 de un 1920×1080 ocupa todo el alto', () => {
    const crop = recorteCentrado('9:16', 1920, 1080);
    const w = Number(((1080 * 9) / 16 / 1920).toFixed(4));
    expect(crop.aspect).toBe('9:16');
    expect(crop.h).toBe(1);
    expect(crop.y).toBe(0);
    expect(crop.w).toBeCloseTo(w, 4);
    expect(crop.x).toBeCloseTo((1 - crop.w) / 2, 4);
  });
  it('el recorte centrado 16:9 de un vertical ocupa todo el ancho', () => {
    const crop = recorteCentrado('16:9', 1080, 1920);
    expect(crop.w).toBe(1);
    expect(crop.x).toBe(0);
    expect(crop.h).toBeCloseTo((1080 * 9) / 16 / 1920, 4);
    expect(crop.y).toBeCloseTo((1 - crop.h) / 2, 4);
  });
});

describe('ajustarRecorte', () => {
  it('ajustar no sale del cuadro, conserva la proporción y respeta el lado mínimo', () => {
    const ancho = 1920;
    const alto = 1080;
    const inicial = recorteCentrado('9:16', ancho, alto);
    const movido = ajustarRecorte(inicial, { dx: 0.5 });
    expect(movido.x + movido.w).toBeCloseTo(1, 6);
    expect(movido.x + movido.w).toBeLessThanOrEqual(1);
    expect((movido.w * ancho) / (movido.h * alto)).toBeCloseTo(9 / 16, 2);

    const reducido = ajustarRecorte(inicial, { escala: 0.01 });
    expect(Math.min(reducido.w, reducido.h)).toBeGreaterThanOrEqual(LADO_MINIMO_RECORTE - 1e-9);
    expect(Math.abs((reducido.w * ancho) / (reducido.h * alto) - 9 / 16)).toBeLessThanOrEqual(0.01);
    expect(reducido.x).toBeGreaterThanOrEqual(0);
    expect(reducido.y).toBeGreaterThanOrEqual(0);
    expect(reducido.x + reducido.w).toBeLessThanOrEqual(1);
    expect(reducido.y + reducido.h).toBeLessThanOrEqual(1);

    const ampliado = ajustarRecorte(reducido, { escala: 100 });
    expect(ampliado.h).toBeLessThanOrEqual(1);
    expect(ampliado.w).toBeLessThanOrEqual(1);
    expect(Math.abs((ampliado.w * ancho) / (ampliado.h * alto) - 9 / 16)).toBeLessThanOrEqual(0.01);
  });
});

describe('pixelesDeRecorte', () => {
  it('los píxeles son pares y caben en el cuadro', () => {
    const ancho = 1081;
    const alto = 1921;
    for (const aspect of ['16:9', '9:16', '1:1', '4:5', '1.91:1'] as const) {
      const px = pixelesDeRecorte(recorteCentrado(aspect, ancho, alto), ancho, alto);
      for (const v of [px.x, px.y, px.w, px.h]) expect(v % 2).toBe(0);
      expect(px.w).toBeGreaterThan(0);
      expect(px.h).toBeGreaterThan(0);
      expect(px.x + px.w).toBeLessThanOrEqual(ancho);
      expect(px.y + px.h).toBeLessThanOrEqual(alto);
    }
    const completo = pixelesDeRecorte({ aspect: '9:16', x: 0, y: 0, w: 1, h: 1 }, ancho, alto);
    expect(completo).toEqual({ x: 0, y: 0, w: 1080, h: 1920 });
  });
});

describe('hashRecorte', () => {
  it('la huella cambia con el archivo y con el recorte, y no con ruido de redondeo', () => {
    const crop = { aspect: '9:16' as const, x: 0.3, y: 0, w: 0.3164, h: 1 };
    const base = hashRecorte('a1', crop);
    expect(base).toMatch(/^[0-9a-z]+$/);
    expect(hashRecorte('a2', crop)).not.toBe(base);
    expect(hashRecorte('a1', { ...crop, x: crop.x + 0.00001 })).toBe(base);
    expect(hashRecorte('a1', { ...crop, x: crop.x + 0.001 })).not.toBe(base);
    expect(hashRecorte('a1', { ...crop, aspect: '1:1' })).not.toBe(base);
  });
});

describe('recortePermitido', () => {
  it('el recorte de video solo hasta 15 minutos y 2 GB', () => {
    expect(recortePermitido({ kind: 'video', durationSec: 900, sizeBytes: 1000 })).toBe(true);
    expect(recortePermitido({ kind: 'video', durationSec: 901, sizeBytes: 1000 })).toBe(false);
    expect(recortePermitido({ kind: 'video', durationSec: 60, sizeBytes: 2 * 1024 ** 3 + 1 })).toBe(false);
    expect(recortePermitido({ kind: 'image', durationSec: undefined, sizeBytes: 10 * 1024 ** 3 })).toBe(true);
  });
});

it('las resoluciones de salida siguen la spec 7.4', () => {
  expect(RESOLUCION_SALIDA).toEqual({
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
    '16:9': { width: 1920, height: 1080 },
    '1.91:1': { width: 1080, height: 566 },
  });
});
