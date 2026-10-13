import { PROVEEDORES, REDES_DE_PROVEEDOR, type Platform, type Proveedor } from '@omnistream/core';
import { crearCifrador } from '@omnistream/functions/src/conexiones/cifrado';
import { guardarSesion, leerSesion } from '@omnistream/functions/src/conexiones/secretos';
import {
  renovarSesionesAhora,
  sesionVigente,
  type DependenciasSesion,
} from '@omnistream/functions/src/conexiones/sesiones';
import { crearNotificador } from '@omnistream/functions/src/publicacion/notificaciones';
import { PlatformError, type OAuthProvider, type SesionProveedor } from '@omnistream/platforms';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { adminDemo } from '../admin';

const { db } = adminDemo('sesiones');
const cifrador = crearCifrador(Buffer.alloc(32, 5).toString('base64'));
const MINUTO = 60_000;

function proveedorFalso(proveedor: Proveedor, refresh: OAuthProvider['refresh']): OAuthProvider {
  return {
    proveedor,
    buildAuthUrl: () => 'https://ejemplo.test',
    exchangeCode: () => Promise.reject(new Error('no se usa')),
    refresh: vi.fn(refresh),
  };
}

function dependencias(
  ahora: Date,
  refresh: Partial<Record<Proveedor, OAuthProvider['refresh']>> = {},
): DependenciasSesion {
  const sinUso: OAuthProvider['refresh'] = () => Promise.reject(new Error('refresh inesperado'));
  return {
    db,
    cifrador,
    ahora: () => ahora,
    notificar: crearNotificador(db, () => Promise.resolve({ enviados: 0, invalidos: [] })),
    proveedores: {
      meta: proveedorFalso('meta', refresh.meta ?? sinUso),
      youtube: proveedorFalso('youtube', refresh.youtube ?? sinUso),
      tiktok: proveedorFalso('tiktok', refresh.tiktok ?? sinUso),
    },
  };
}

const conexion = (red: Platform) => db.doc(`connections/${red}`);
const conectar = (red: Platform) =>
  conexion(red).set({ platform: red, authStatus: 'conectada', publishMode: 'api', scopes: [] });
const guardar = (proveedor: Proveedor, sesion: SesionProveedor) =>
  guardarSesion(db, cifrador, proveedor, sesion, new Date());
const avisosDeConexion = async () => (await db.collection('notifications').where('tipo', '==', 'conexion').get()).size;

async function limpiar() {
  for (const proveedor of PROVEEDORES) {
    await db.doc(`secrets/${proveedor}`).delete();
    for (const red of REDES_DE_PROVEEDOR[proveedor]) await conexion(red).delete();
  }
  const avisos = await db.collection('notifications').where('tipo', '==', 'conexion').get();
  for (const aviso of avisos.docs) await aviso.ref.delete();
}

beforeEach(limpiar);
afterAll(limpiar);

it('renueva TikTok y guarda el nuevo refresh_token', async () => {
  const ahora = new Date('2030-01-01T03:00:00Z');
  const refreshExpiresAt = ahora.getTime() + 365 * 24 * 60 * MINUTO;
  await conectar('tiktok');
  await guardar('tiktok', { accessToken: 'a1', refreshToken: 'r1', expiresAt: ahora.getTime(), datos: {} });
  const deps = dependencias(ahora, {
    tiktok: async (s) => ({ ...s, accessToken: 'a2', refreshToken: 'r2', refreshExpiresAt }),
  });

  expect(await renovarSesionesAhora(deps)).toEqual({ renovadas: 1, vencidas: 0 });

  expect(await leerSesion(db, cifrador, 'tiktok')).toMatchObject({ accessToken: 'a2', refreshToken: 'r2' });
  const datos = (await conexion('tiktok').get()).data();
  expect(datos?.authStatus).toBe('conectada');
  expect(datos?.tokenExpiresAt.toDate().getTime()).toBe(refreshExpiresAt);
});

it('un acceso que vence en menos de 10 minutos se renueva antes de usarse', async () => {
  const ahora = new Date('2030-01-02T12:00:00Z');
  await conectar('youtube');
  await guardar('youtube', {
    accessToken: 'viejo',
    refreshToken: 'r',
    expiresAt: ahora.getTime() + 5 * MINUTO,
    datos: {},
  });
  const deps = dependencias(ahora, {
    youtube: async (s) => ({ ...s, accessToken: 'nuevo', expiresAt: ahora.getTime() + 60 * MINUTO }),
  });

  expect((await sesionVigente('youtube', deps)).accessToken).toBe('nuevo');
  expect(deps.proveedores.youtube.refresh).toHaveBeenCalledTimes(1);
  expect((await leerSesion(db, cifrador, 'youtube'))?.accessToken).toBe('nuevo');
});

it('uno vigente no se renueva', async () => {
  const ahora = new Date('2030-01-03T12:00:00Z');
  await conectar('youtube');
  await guardar('youtube', {
    accessToken: 'vigente',
    refreshToken: 'r',
    expiresAt: ahora.getTime() + 60 * MINUTO,
    datos: {},
  });
  const deps = dependencias(ahora);

  expect((await sesionVigente('youtube', deps)).accessToken).toBe('vigente');
  expect(deps.proveedores.youtube.refresh).not.toHaveBeenCalled();
});

it('un acceso revocado marca expiradas Facebook e Instagram y avisa una sola vez por día', async () => {
  const ahora = new Date('2030-01-04T03:00:00Z');
  await conectar('facebook');
  await conectar('instagram');
  await guardar('meta', { accessToken: 'pagina', datos: { pageId: 'p1' } });
  const deps = dependencias(ahora, {
    meta: () => Promise.reject(new PlatformError('auth', 'meta_190', 'El acceso a Facebook venció.')),
  });

  expect(await renovarSesionesAhora(deps)).toEqual({ renovadas: 0, vencidas: 1 });
  await renovarSesionesAhora(deps);

  for (const red of ['facebook', 'instagram'] as const) {
    const datos = (await conexion(red).get()).data();
    expect(datos?.authStatus).toBe('expirada');
    expect(datos?.lastError).toMatchObject({ code: 'meta_190', message: 'El acceso a Facebook venció.' });
    expect((await db.doc(`notifications/conexion-${red}-2030-01-04`).get()).get('titulo')).toMatch(/^Reconecta /);
  }
  expect(await avisosDeConexion()).toBe(2);
});

it('un error de autenticación al renovar antes de usar marca la conexión y se relanza', async () => {
  const ahora = new Date('2030-01-05T12:00:00Z');
  await conectar('youtube');
  await guardar('youtube', { accessToken: 'viejo', refreshToken: 'r', expiresAt: ahora.getTime(), datos: {} });
  const deps = dependencias(ahora, {
    youtube: () =>
      Promise.reject(new PlatformError('auth', 'invalid_grant', 'El acceso a YouTube fue revocado o venció.')),
  });

  await expect(sesionVigente('youtube', deps)).rejects.toMatchObject({ kind: 'auth', code: 'invalid_grant' });
  expect((await conexion('youtube').get()).get('authStatus')).toBe('expirada');
  expect(await avisosDeConexion()).toBe(1);
});

it('sin sesión es error de autenticación con el mensaje', async () => {
  await expect(sesionVigente('tiktok', dependencias(new Date()))).rejects.toMatchObject({
    kind: 'auth',
    code: 'sin_conexion',
    message: 'TikTok no está conectada.',
  });
});

it('un error temporal no cambia la conexión', async () => {
  const ahora = new Date('2030-01-06T03:00:00Z');
  await conectar('youtube');
  await guardar('youtube', { accessToken: 'a', refreshToken: 'r', datos: {} });
  const deps = dependencias(ahora, {
    youtube: () => Promise.reject(new PlatformError('temporal', 'http_503', 'YouTube respondió con un error (503).')),
  });

  expect(await renovarSesionesAhora(deps)).toEqual({ renovadas: 0, vencidas: 0 });
  const datos = (await conexion('youtube').get()).data();
  expect(datos?.authStatus).toBe('conectada');
  expect(datos?.lastError).toBeUndefined();
  expect(await avisosDeConexion()).toBe(0);
});

it('la renovación no reconecta una red que quedó con error', async () => {
  const ahora = new Date('2030-01-07T03:00:00Z');
  await conectar('facebook');
  await conexion('instagram').set({
    platform: 'instagram',
    authStatus: 'error',
    publishMode: 'manual',
    scopes: [],
    lastError: { code: 'sin_instagram', message: 'La página no tiene una cuenta profesional de Instagram vinculada.' },
  });
  await guardar('meta', { accessToken: 'pagina', datos: { pageId: 'p1' } });
  const deps = dependencias(ahora, { meta: async (s) => s });

  expect(await renovarSesionesAhora(deps)).toEqual({ renovadas: 1, vencidas: 0 });

  expect((await conexion('facebook').get()).get('authStatus')).toBe('conectada');
  expect((await conexion('instagram').get()).data()).toMatchObject({
    authStatus: 'error',
    lastError: { code: 'sin_instagram' },
  });
});
