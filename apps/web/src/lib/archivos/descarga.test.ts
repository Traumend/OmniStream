import type { Asset } from '@omnistream/core';
import { expect, it } from 'vitest';
import { estadoDescarga } from './descarga';

const listo = { status: 'listo' } as Pick<Asset, 'status'>;

it.each([
  [{ cargandoArchivos: true, asset: undefined, url: undefined, error: false }, 'preparando'],
  [{ cargandoArchivos: false, asset: listo, url: undefined, error: false }, 'preparando'],
  [{ cargandoArchivos: false, asset: listo, url: 'https://x.test/v.mp4', error: false }, 'lista'],
  [{ cargandoArchivos: false, asset: listo, url: undefined, error: true }, 'no_disponible'],
  [{ cargandoArchivos: false, asset: undefined, url: undefined, error: false }, 'no_disponible'],
  [
    { cargandoArchivos: false, asset: { status: 'purgado' } as Pick<Asset, 'status'>, url: undefined, error: false },
    'no_disponible',
  ],
] as const)('%j → %s', (entrada, esperado) => {
  expect(estadoDescarga(entrada)).toBe(esperado);
});
