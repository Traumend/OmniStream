import { expect, it } from 'vitest';
import { accionConexionSchema } from './entrada';

it('acepta configurar mediaVerified en TikTok', () => {
  expect(
    accionConexionSchema.safeParse({ accion: 'configurar', platform: 'tiktok', mediaVerified: true }).success,
  ).toBe(true);
});

it('rechaza un proveedor desconocido', () => {
  expect(accionConexionSchema.safeParse({ accion: 'iniciar', proveedor: 'twitter' }).success).toBe(false);
});

it('acepta infoCreadorTiktok y desconectar', () => {
  expect(accionConexionSchema.safeParse({ accion: 'infoCreadorTiktok' }).success).toBe(true);
  expect(accionConexionSchema.safeParse({ accion: 'desconectar', proveedor: 'meta' }).success).toBe(true);
});
