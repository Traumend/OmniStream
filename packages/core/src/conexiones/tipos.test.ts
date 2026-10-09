import { expect, it } from 'vitest';
import { leerConexion, proveedorDe, REDES_DE_PROVEEDOR } from './tipos';

it('sin datos la conexión queda sin conectar y en manual', () => {
  expect(leerConexion('tiktok', undefined)).toEqual({
    platform: 'tiktok',
    authStatus: 'sin_conectar',
    readEnabled: false,
    publishMode: 'manual',
    scopes: [],
  });
});

it('convierte las fechas y conserva la cuenta', () => {
  const fecha = new Date('2026-10-08T00:00:00Z');
  const ts = { toDate: () => fecha };
  const c = leerConexion('youtube', {
    authStatus: 'expirada',
    readEnabled: true,
    publishMode: 'api',
    scopes: ['a'],
    account: { id: 'UC1', name: 'Canal' },
    tokenExpiresAt: ts,
    lastError: { code: 'x', message: 'Vencido', at: ts },
    mediaVerified: true,
  });
  expect(c).toMatchObject({
    authStatus: 'expirada',
    readEnabled: true,
    publishMode: 'api',
    account: { id: 'UC1', name: 'Canal' },
    tokenExpiresAt: fecha,
    lastError: { code: 'x', message: 'Vencido', at: fecha },
    mediaVerified: true,
  });
});

it('proveedores y redes', () => {
  expect(proveedorDe('instagram')).toBe('meta');
  expect(proveedorDe('youtube')).toBe('youtube');
  expect(REDES_DE_PROVEEDOR.meta).toEqual(['facebook', 'instagram']);
});
