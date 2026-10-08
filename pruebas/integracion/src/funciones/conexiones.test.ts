import { PROVEEDORES, REDES_DE_PROVEEDOR, type Proveedor } from '@omnistream/core';
import { crearCifrador } from '@omnistream/functions/src/conexiones/cifrado';
import {
  completarConexion,
  despacharConexion,
  type DependenciasConexiones,
} from '@omnistream/functions/src/conexiones/conexiones';
import { guardarSesion, leerSesion } from '@omnistream/functions/src/conexiones/secretos';
import { crearNotificador } from '@omnistream/functions/src/publicacion/notificaciones';
import { PlatformError, type OAuthProvider, type ResultadoConexion } from '@omnistream/platforms';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { adminDemo } from '../admin';

const { db } = adminDemo('conexiones');
const cifrador = crearCifrador(Buffer.alloc(32, 9).toString('base64'));
const URL_PUBLICA = 'http://localhost:3000';
const propietario = { token: { owner: true } };
const AHORA = new Date('2030-02-01T10:00:00Z');

const resultadoMeta = (conInstagram = true): ResultadoConexion => ({
  sesion: { accessToken: 'token-de-pagina-secreto', datos: { pageId: 'p1', igUserId: 'ig1' } },
  scopes: ['pages_manage_posts', 'instagram_content_publish'],
  cuentas: {
    facebook: { id: 'p1', name: 'Mi página' },
    ...(conInstagram ? { instagram: { id: 'ig1', name: 'Mi cuenta', handle: 'micuenta' } } : {}),
  },
});

function proveedorFalso(proveedor: Proveedor, exchangeCode: OAuthProvider['exchangeCode']): OAuthProvider {
  return {
    proveedor,
    buildAuthUrl: ({ state, redirectUri }) =>
      `https://${proveedor}.test/auth?state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    exchangeCode: vi.fn(exchangeCode),
    refresh: () => Promise.reject(new Error('no se usa')),
  };
}

function dependencias(
  exchange: Partial<Record<Proveedor, OAuthProvider['exchangeCode']>> = {},
  ahora = AHORA,
): DependenciasConexiones {
  const sinUso: OAuthProvider['exchangeCode'] = () => Promise.reject(new Error('exchange inesperado'));
  return {
    db,
    cifrador,
    ahora: () => ahora,
    urlPublica: URL_PUBLICA,
    http: () => Promise.reject(new Error('sin red')),
    notificar: crearNotificador(db, () => Promise.resolve({ enviados: 0, invalidos: [] })),
    proveedores: {
      meta: proveedorFalso('meta', exchange.meta ?? sinUso),
      youtube: proveedorFalso('youtube', exchange.youtube ?? sinUso),
      tiktok: proveedorFalso('tiktok', exchange.tiktok ?? sinUso),
    },
  };
}

const conexion = async (red: string) => (await db.doc(`connections/${red}`).get()).data();
const conErrorDe = (mensaje: string) => `${URL_PUBLICA}/ajustes/conexiones?error=${encodeURIComponent(mensaje)}`;

async function iniciar(proveedor: Proveedor, deps: DependenciasConexiones): Promise<string> {
  const { url } = await despacharConexion(propietario, { accion: 'iniciar', proveedor }, deps);
  return new URL(url as string).searchParams.get('state') as string;
}

async function limpiar() {
  for (const proveedor of PROVEEDORES) {
    await db.doc(`secrets/${proveedor}`).delete();
    for (const red of REDES_DE_PROVEEDOR[proveedor]) await db.doc(`connections/${red}`).delete();
  }
}

beforeEach(limpiar);
afterAll(limpiar);

it('iniciar guarda un state de 10 minutos y devuelve la URL del proveedor', async () => {
  const deps = dependencias();
  const { url } = await despacharConexion(propietario, { accion: 'iniciar', proveedor: 'youtube' }, deps);
  const enlace = new URL(url as string);
  expect(enlace.host).toBe('youtube.test');
  expect(enlace.searchParams.get('redirect_uri')).toBe(`${URL_PUBLICA}/api/conexiones/retorno`);
  const state = enlace.searchParams.get('state') as string;
  expect(state.length).toBeGreaterThanOrEqual(43);
  const guardado = (await db.doc(`oauthStates/${state}`).get()).data();
  expect(guardado?.proveedor).toBe('youtube');
  expect(guardado?.expiresAt.toDate().getTime()).toBe(AHORA.getTime() + 10 * 60_000);
});

it('el retorno con un state válido guarda la sesión cifrada y conecta Facebook e Instagram', async () => {
  const deps = dependencias({ meta: async () => resultadoMeta() });
  await db.doc('connections/facebook').set({ publishMode: 'api', readEnabled: false });
  const state = await iniciar('meta', deps);

  expect(await completarConexion({ state, code: 'c1' }, deps)).toBe(`${URL_PUBLICA}/ajustes/conexiones?conectada=meta`);

  expect(deps.proveedores.meta.exchangeCode).toHaveBeenCalledWith({
    code: 'c1',
    redirectUri: `${URL_PUBLICA}/api/conexiones/retorno`,
  });
  expect(JSON.stringify((await db.doc('secrets/meta').get()).data())).not.toContain('secreto');
  expect((await leerSesion(db, cifrador, 'meta'))?.accessToken).toBe('token-de-pagina-secreto');
  expect(await conexion('facebook')).toMatchObject({
    platform: 'facebook',
    authStatus: 'conectada',
    account: { id: 'p1', name: 'Mi página' },
    scopes: ['pages_manage_posts', 'instagram_content_publish'],
    publishMode: 'api',
    readEnabled: false,
  });
  expect(await conexion('instagram')).toMatchObject({
    authStatus: 'conectada',
    account: { handle: 'micuenta' },
    publishMode: 'manual',
    readEnabled: true,
  });
  expect((await db.doc(`oauthStates/${state}`).get()).exists).toBe(false);
});

it('un state usado dos veces no conecta', async () => {
  const deps = dependencias({ meta: async () => resultadoMeta() });
  const state = await iniciar('meta', deps);
  await completarConexion({ state, code: 'c1' }, deps);
  expect(await completarConexion({ state, code: 'c1' }, deps)).toBe(
    conErrorDe('La conexión venció o no es válida. Vuelve a intentarlo.'),
  );
  expect(deps.proveedores.meta.exchangeCode).toHaveBeenCalledTimes(1);
});

it('un state vencido no conecta', async () => {
  const state = await iniciar('meta', dependencias());
  const despues = dependencias({ meta: async () => resultadoMeta() }, new Date(AHORA.getTime() + 11 * 60_000));
  expect(await completarConexion({ state, code: 'c1' }, despues)).toBe(
    conErrorDe('La conexión venció o no es válida. Vuelve a intentarlo.'),
  );
  expect(despues.proveedores.meta.exchangeCode).not.toHaveBeenCalled();
  expect(await conexion('facebook')).toBeUndefined();
});

it('cancelar en el proveedor vuelve con el mensaje', async () => {
  const deps = dependencias();
  const state = await iniciar('tiktok', deps);
  expect(await completarConexion({ state, error: 'access_denied' }, deps)).toBe(
    conErrorDe('Se canceló la conexión con TikTok.'),
  );
});

it('un error del proveedor vuelve con su mensaje', async () => {
  const deps = dependencias({
    youtube: () =>
      Promise.reject(new PlatformError('definitivo', 'sin_canal', 'La cuenta no tiene un canal de YouTube.')),
  });
  const state = await iniciar('youtube', deps);
  expect(await completarConexion({ state, code: 'c' }, deps)).toBe(
    conErrorDe('La cuenta no tiene un canal de YouTube.'),
  );
});

it('Meta sin Instagram deja Instagram con error', async () => {
  const deps = dependencias({ meta: async () => resultadoMeta(false) });
  const state = await iniciar('meta', deps);
  await completarConexion({ state, code: 'c1' }, deps);
  expect((await conexion('facebook'))?.authStatus).toBe('conectada');
  expect(await conexion('instagram')).toMatchObject({
    authStatus: 'error',
    lastError: { code: 'sin_instagram', message: 'La página no tiene una cuenta profesional de Instagram vinculada.' },
  });
});

it('configurar a API exige estar conectada y tener el permiso de publicar', async () => {
  const deps = dependencias();
  const configurar = () =>
    despacharConexion(propietario, { accion: 'configurar', platform: 'youtube', publishMode: 'api' }, deps);
  await expect(configurar()).rejects.toMatchObject({
    code: 'failed-precondition',
    message: 'YouTube no está conectada.',
  });
  await db.doc('connections/youtube').set({ platform: 'youtube', authStatus: 'conectada', scopes: [] });
  await expect(configurar()).rejects.toMatchObject({
    code: 'failed-precondition',
    message: 'Falta el permiso para publicar en YouTube. Vuelve a conectar YouTube y concédelo.',
  });
  await db.doc('connections/youtube').update({ scopes: ['https://www.googleapis.com/auth/youtube.upload'] });
  await configurar();
  expect((await conexion('youtube'))?.publishMode).toBe('api');
  await despacharConexion(propietario, { accion: 'configurar', platform: 'youtube', readEnabled: false }, deps);
  expect(await conexion('youtube')).toMatchObject({ publishMode: 'api', readEnabled: false });
});

it('desconectar borra la sesión y vuelve a manual', async () => {
  const deps = dependencias();
  await guardarSesion(db, cifrador, 'meta', resultadoMeta().sesion, AHORA);
  await db
    .doc('connections/facebook')
    .set({ authStatus: 'conectada', publishMode: 'api', account: { id: 'p1', name: 'x' } });
  await despacharConexion(propietario, { accion: 'desconectar', proveedor: 'meta' }, deps);
  expect(await leerSesion(db, cifrador, 'meta')).toBeNull();
  for (const red of ['facebook', 'instagram']) {
    expect(await conexion(red)).toEqual({
      platform: red,
      authStatus: 'sin_conectar',
      publishMode: 'manual',
      readEnabled: false,
      scopes: [],
    });
  }
});

it('mediaVerified solo aplica a TikTok', async () => {
  const deps = dependencias();
  await expect(
    despacharConexion(propietario, { accion: 'configurar', platform: 'instagram', mediaVerified: true }, deps),
  ).rejects.toMatchObject({ code: 'invalid-argument', message: 'Esta opción solo aplica a TikTok.' });
  await despacharConexion(propietario, { accion: 'configurar', platform: 'tiktok', mediaVerified: true }, deps);
  expect((await conexion('tiktok'))?.mediaVerified).toBe(true);
});

it('infoCreadorTiktok sin conexión pide reconectar', async () => {
  await expect(despacharConexion(propietario, { accion: 'infoCreadorTiktok' }, dependencias())).rejects.toMatchObject({
    code: 'failed-precondition',
    message: 'Vuelve a conectar TikTok.',
  });
});

it('sin el claim owner se rechaza', async () => {
  await expect(
    despacharConexion({ token: {} }, { accion: 'iniciar', proveedor: 'meta' }, dependencias()),
  ).rejects.toMatchObject({ code: 'permission-denied' });
});

it('retornoConexion sin state redirige a Conexiones con el error', async () => {
  const respuesta = await fetch('http://127.0.0.1:5001/demo-omnistream/us-central1/retornoConexion', {
    redirect: 'manual',
  });
  expect(respuesta.status).toBe(302);
  expect(respuesta.headers.get('location')).toMatch(/^http:\/\/localhost:3000\/ajustes\/conexiones\?error=/);
});
