import { leerConexion, type Conexion, type Destino, type Platform } from '@omnistream/core';
import { desvincularHija } from '@omnistream/functions/src/publicacion/acciones/cierre';
import { reaccionarACambio, type DependenciasCambio } from '@omnistream/functions/src/publicacion/alCambiarDestino';
import { ejecutarReferencia } from '@omnistream/functions/src/publicacion/comentarReferencia';
import type { Notificador } from '@omnistream/functions/src/publicacion/notificaciones';
import type { DependenciasApi } from '@omnistream/functions/src/publicacion/porApi';
import { PlatformError, type PlatformAdapter } from '@omnistream/platforms';
import { beforeAll, expect, it, vi } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, leerDestinoDe, sembrarPublicacion } from '../datos';

const { db } = adminDemo('comentarReferencia');
const AHORA = new Date('2030-04-01T10:00:00Z');
const REMOTO_YOUTUBE = { id: 'abcdefghijk', url: 'https://youtu.be/abcdefghijk', publishedAt: AHORA };
const REMOTO_FACEBOOK = { id: 'fb1', url: 'https://www.facebook.com/reel/1', publishedAt: AHORA };
const PERMISOS = ['pages_manage_posts', 'pages_manage_engagement'];

let assetId: string;
beforeAll(async () => {
  assetId = await crearAssetListo(db);
});

const conexionApi = (red: Platform, cambios: Partial<Conexion> = {}): Conexion => ({
  ...leerConexion(red, { authStatus: 'conectada', publishMode: 'api', scopes: PERMISOS }),
  ...cambios,
});

async function sembrarPrincipal(youtube: Partial<Destino> = {}): Promise<string> {
  return sembrarPublicacion(db, {
    publicacion: { assetId, kind: 'principal', title: 'Video largo' },
    destinos: [{ platform: 'youtube', format: 'video_largo', status: 'publicada', remote: REMOTO_YOUTUBE, ...youtube }],
  });
}

async function sembrarHija(principal: string, destino: Partial<Destino>): Promise<string> {
  return sembrarPublicacion(db, {
    publicacion: { assetId, kind: 'hija', parentId: principal, title: 'Corto' },
    destinos: [{ platform: 'facebook', format: 'reel', status: 'publicada', scheduleVersion: 1, ...destino }],
  });
}

function dependenciasCambio(conexion: Conexion) {
  const avisos: string[] = [];
  const encoladas: { tarea: unknown; id: string }[] = [];
  const deps: DependenciasCambio = {
    notificar: async (id) => void avisos.push(id),
    encolarReferencia: async (tarea, id) => void encoladas.push({ tarea, id }),
    conexion: async () => conexion,
    // El Principal de prueba se publica en AHORA (2030): con la hora real aún no sería visible.
    ahora: () => AHORA,
  };
  return { deps, avisos, encoladas };
}

// El Principal se publica en YouTube: sus Hijas publicadas que esperaban la URL activan su referencia.
async function publicarPrincipal(principal: string, deps: DependenciasCambio) {
  await reaccionarACambio(
    db,
    {
      postId: principal,
      platform: 'youtube',
      antes: { status: 'publicando' } as Destino,
      despues: { status: 'publicada', remote: REMOTO_YOUTUBE } as Destino,
      idEvento: `evento-${principal}`,
    },
    deps,
  );
}

it('con la conexión por API, la referencia se encola en vez de avisar', async () => {
  const principal = await sembrarPrincipal({ status: 'publicando', remote: undefined });
  const hija = await sembrarHija(principal, { remote: REMOTO_FACEBOOK, parentRef: { status: 'en_espera' } });
  const { deps, avisos, encoladas } = dependenciasCambio(conexionApi('facebook'));

  await publicarPrincipal(principal, deps);

  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('publicando');
  expect(encoladas).toEqual([{ tarea: { postId: hija, platform: 'facebook' }, id: `${hija}-facebook-ref-v1` }]);
  expect(avisos).toEqual([]);
});

it('sin acceso para comentar, avisa como en la 2A', async () => {
  const principal = await sembrarPrincipal({ status: 'publicando', remote: undefined });
  const hija = await sembrarHija(principal, { remote: REMOTO_FACEBOOK, parentRef: { status: 'en_espera' } });
  const { deps, avisos, encoladas } = dependenciasCambio(conexionApi('facebook', { scopes: ['pages_manage_posts'] }));

  await publicarPrincipal(principal, deps);

  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('pendiente');
  expect(encoladas).toEqual([]);
  expect(avisos).toEqual([`evento-${principal}-${hija}-facebook`]);
});

function apiFalsa(postComment: PlatformAdapter['postComment']) {
  const adaptador = { postComment: vi.fn(postComment) } as unknown as PlatformAdapter & {
    postComment: ReturnType<typeof vi.fn>;
  };
  const marcarExpirada = vi.fn(async () => {});
  const api: Pick<DependenciasApi, 'adaptador' | 'sesion' | 'marcarExpirada' | 'http'> = {
    adaptador: () => adaptador,
    sesion: async () => ({ accessToken: 'token', datos: {} }),
    marcarExpirada,
    http: () => Promise.reject(new Error('sin red')),
  };
  return { api, adaptador, marcarExpirada };
}

function contexto(api: ReturnType<typeof apiFalsa>['api'], ultimoIntento = false) {
  const avisos: string[] = [];
  const notificar: Notificador = async (id) => void avisos.push(id);
  return { deps: { api, notificar, ultimoIntento, ahora: () => AHORA }, avisos };
}

async function hijaEnComentario(red: Platform = 'facebook'): Promise<string> {
  const principal = await sembrarPrincipal();
  return sembrarHija(principal, {
    platform: red,
    format: red === 'tiktok' ? 'tiktok' : 'reel',
    remote: REMOTO_FACEBOOK,
    parentRef: { status: 'publicando' },
  });
}

it('comentarReferencia publica el comentario y guarda su id', async () => {
  const hija = await hijaEnComentario();
  const { api, adaptador } = apiFalsa(async () => ({ id: 'comentario-1' }));
  const { deps, avisos } = contexto(api);

  expect(await ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, deps)).toBe('publicada');

  expect(adaptador.postComment).toHaveBeenCalledWith(
    'fb1',
    'Video completo en YouTube: «Video largo» https://youtu.be/abcdefghijk',
    expect.objectContaining({ sesion: expect.objectContaining({ accessToken: 'token' }) }),
  );
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef).toEqual({
    status: 'publicada',
    remoteCommentId: 'comentario-1',
  });
  expect(avisos).toEqual([]);
});

it('si el comentario falla, la referencia vuelve a pendiente y avisa', async () => {
  const hija = await hijaEnComentario();
  const { api, marcarExpirada } = apiFalsa(() =>
    Promise.reject(new PlatformError('definitivo', 'meta_100', 'Facebook rechazó el comentario.')),
  );
  const { deps, avisos } = contexto(api);

  expect(await ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, deps)).toBe('manual');

  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef).toEqual({
    status: 'pendiente',
    error: 'Facebook rechazó el comentario.',
  });
  expect(avisos).toEqual([`ref-manual-${hija}-facebook`]);
  expect(marcarExpirada).not.toHaveBeenCalled();
});

it('un error de autenticación vuelve a pendiente y marca la conexión', async () => {
  const hija = await hijaEnComentario();
  const error = new PlatformError('auth', 'meta_190', 'El acceso a Facebook venció.');
  const { api, marcarExpirada } = apiFalsa(() => Promise.reject(error));
  expect(await ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, contexto(api).deps)).toBe('manual');
  expect(marcarExpirada).toHaveBeenCalledWith('facebook', error);
});

it('un error temporal relanza hasta el último intento', async () => {
  const hija = await hijaEnComentario();
  const { api } = apiFalsa(() =>
    Promise.reject(new PlatformError('temporal', 'http_503', 'Facebook respondió con un error (503).')),
  );
  await expect(ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, contexto(api).deps)).rejects.toThrow(
    'Facebook respondió con un error (503).',
  );
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('publicando');

  const ultimo = contexto(api, true);
  expect(await ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, ultimo.deps)).toBe('manual');
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('pendiente');
  expect(ultimo.avisos).toEqual([`ref-manual-${hija}-facebook`]);
});

it('desvincular durante el comentario lo omite', async () => {
  const hija = await hijaEnComentario();
  const { api } = apiFalsa(async () => {
    await desvincularHija(hija, { db, ahora: AHORA, encolar: async () => {} });
    return { id: 'comentario-2' };
  });
  expect(await ejecutarReferencia(db, { postId: hija, platform: 'facebook' }, contexto(api).deps)).toBe('omitida');
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef).toEqual({ status: 'no_aplica' });
});

it('TikTok nunca se comenta', async () => {
  const hija = await hijaEnComentario('tiktok');
  const { api, adaptador } = apiFalsa(async () => ({ id: 'x' }));
  expect(await ejecutarReferencia(db, { postId: hija, platform: 'tiktok' }, contexto(api).deps)).toBe('omitida');
  expect(adaptador.postComment).not.toHaveBeenCalled();
});
