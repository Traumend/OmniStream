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

it('con recorte sin derivado listo, el paquete dice que el recorte se está generando', () => {
  const crop = { aspect: '9:16', x: 0.34, y: 0, w: 0.3164, h: 1 } as const;
  const asset = { id: 'a1', status: 'listo', storagePath: 'originales/a1' } as const;
  const destino = { overrides: { crop }, derivative: { cropHash: 'otra', status: 'pendiente' } } as const;
  expect(estadoDescarga({ cargandoArchivos: false, asset, destino, url: undefined, error: false })).toBe('generando');
  expect(estadoDescarga({ cargandoArchivos: true, asset: undefined, destino, url: undefined, error: false })).toBe(
    'preparando',
  );
});
