import {
  CAMPOS_TIKTOK_POR_DEFECTO,
  proveedorDe,
  type CamposTiktok,
  type Destino,
  type DestinoEfectivo,
  type Publicacion,
} from '@omnistream/core';
import { crearCifrador } from '@omnistream/functions/src/conexiones/cifrado';
import { marcarExpirada, type DependenciasSesion } from '@omnistream/functions/src/conexiones/sesiones';
import type { TareaPublicacion } from '@omnistream/functions/src/publicacion/cola';
import { crearNotificador } from '@omnistream/functions/src/publicacion/notificaciones';
import type { DependenciasApi } from '@omnistream/functions/src/publicacion/porApi';
import { ejecutarTarea } from '@omnistream/functions/src/publicacion/publicarDestino';
import { PlatformError, type Checkpoint, type PlatformAdapter, type StepResult } from '@omnistream/platforms';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe, sembrarConexion, sembrarPublicacion } from '../datos';
import { rechazoDe } from '../errores';
import { clientePropietario, type Cliente } from '../sesion';

const { db } = adminDemo('publicarPorApi');
const AHORA = new Date('2030-03-01T10:00:00Z');
const PRIVADA: CamposTiktok = { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' };
const URL_TIKTOK = 'https://www.tiktok.com/@cuenta/video/r1';

let assetId: string;
let propietario: Cliente;

beforeAll(async () => {
  assetId = await crearAssetListo(db);
  propietario = await clientePropietario();
});

afterEach(async () => {
  await db.doc('connections/tiktok').delete();
});

afterAll(async () => {
  await propietario.cerrar();
});

type Paso = (target: DestinoEfectivo, checkpoint: Checkpoint | null) => StepResult | Promise<StepResult>;

function adaptadorGuionado(pasos: Record<string, Paso>) {
  const checkpointsRecibidos: (Checkpoint | null)[] = [];
  const targets: DestinoEfectivo[] = [];
  const adaptador = {
    platform: 'tiktok',
    checkpointsRecibidos,
    targets,
    publishStep: vi.fn(async (target: DestinoEfectivo, checkpoint: Checkpoint | null) => {
      checkpointsRecibidos.push(checkpoint);
      targets.push(target);
      const paso = pasos[checkpoint?.stage ?? 'inicio'];
      if (!paso) throw new Error(`Paso inesperado ${checkpoint?.stage}`);
      return paso(target, checkpoint);
    }),
    findExisting: vi.fn(async () => null),
    postComment: vi.fn(async () => ({ id: 'c' })),
  } satisfies PlatformAdapter & Record<string, unknown>;
  return adaptador;
}

const continuar = (stage: string, delaySec?: number): StepResult => ({
  kind: 'continue',
  checkpoint: { stage, data: { stage } },
  ...(delaySec === undefined ? {} : { delaySec }),
});
const hecho = (id = 'r1'): StepResult => ({
  kind: 'done',
  remote: { id, url: `https://www.tiktok.com/@cuenta/video/${id}` },
});
const fallo = (kind: PlatformError['kind'], message = 'Falló.'): StepResult => ({
  kind: 'error',
  error: new PlatformError(kind, `prueba_${kind}`, message),
});

const depsSesion: DependenciasSesion = {
  db,
  cifrador: crearCifrador(Buffer.alloc(32, 1).toString('base64')),
  proveedores: {} as DependenciasSesion['proveedores'],
  ahora: () => AHORA,
  notificar: crearNotificador(db, () => Promise.resolve({ enviados: 0, invalidos: [] })),
};

function apiFalsa(adaptador: PlatformAdapter, cambios: Partial<DependenciasApi> = {}) {
  const encoladas: { tarea: TareaPublicacion; opciones: { id: string; scheduleTime?: Date } }[] = [];
  const api: DependenciasApi = {
    adaptador: () => adaptador,
    sesion: async () => ({ accessToken: 'token', datos: {} }),
    fuentes: async () => ({
      archivo: {
        size: 10,
        mimeType: 'video/mp4',
        urlFirmada: async () => 'https://storage.test/archivo',
        leerRango: async () => new Uint8Array(10),
      },
    }),
    marcarExpirada: (red, error) => marcarExpirada(proveedorDe(red), error, depsSesion),
    encolar: async (tarea, opciones) => void encoladas.push({ tarea, opciones }),
    http: () => Promise.reject(new Error('sin red')),
    presupuestoMs: 60_000,
    ...cambios,
  };
  return { api, encoladas };
}

async function sembrarTiktok(
  destino: Partial<Destino> = {},
  publicacion: Partial<Publicacion> = {},
): Promise<{ postId: string; tarea: TareaPublicacion }> {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId, ...publicacion },
    destinos: [
      {
        platform: 'tiktok',
        format: 'tiktok',
        status: 'programada',
        scheduleVersion: 1,
        scheduledAt: AHORA,
        publishMode: 'api',
        tiktok: PRIVADA,
        ...destino,
      },
    ],
  });
  return { postId, tarea: { postId, platform: 'tiktok', scheduleVersion: 1 } };
}

const contextoCon = (api: DependenciasApi, ultimoIntento = false) => ({ ahora: () => AHORA, ultimoIntento, api });
const leer = (postId: string) => leerDestinoDe(db, postId, 'tiktok');

it('publica por API en varios pasos y guarda el checkpoint entre pasos', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => continuar('a'), a: () => continuar('b'), b: () => hecho() });
  const { postId, tarea } = await sembrarTiktok();

  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('publicada');

  const destino = await leer(postId);
  expect(destino).toMatchObject({ status: 'publicada', remote: { id: 'r1', url: URL_TIKTOK } });
  expect(destino.checkpoint).toBeUndefined();
  expect(destino.lease).toBeUndefined();
  expect(adaptador.checkpointsRecibidos.map((c) => c?.stage ?? null)).toEqual([null, 'a', 'b']);
  const intentos = await db.collection(`posts/${postId}/targets/tiktok/attempts`).get();
  expect(intentos.docs.map((d) => d.data())).toEqual([expect.objectContaining({ stage: 'api', result: 'ok' })]);
});

it('un paso que pide esperar libera el lease y encola la continuación', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => continuar('a', 30), a: () => hecho() });
  const { postId, tarea } = await sembrarTiktok();
  const { api, encoladas } = apiFalsa(adaptador);

  expect(await ejecutarTarea(db, tarea, contextoCon(api))).toBe('esperando');

  expect(encoladas).toEqual([
    {
      tarea: { ...tarea, continuacion: 1 },
      opciones: { id: `${postId}-tiktok-v1-c1`, scheduleTime: new Date(AHORA.getTime() + 30_000) },
    },
  ]);
  const enEspera = await leer(postId);
  expect(enEspera.status).toBe('publicando');
  expect(enEspera.lease).toBeUndefined();
  expect(enEspera.checkpoint).toMatchObject({ stage: 'a', seq: 1 });

  expect(await ejecutarTarea(db, { ...tarea, continuacion: 1 }, contextoCon(api))).toBe('publicada');
  expect(adaptador.checkpointsRecibidos.map((c) => c?.stage ?? null)).toEqual([null, 'a']);
  expect((await leer(postId)).status).toBe('publicada');
});

it('una continuación que llega después de publicar no hace nada', async () => {
  const adaptador = adaptadorGuionado({});
  const { tarea } = await sembrarTiktok({ status: 'publicada' });
  expect(await ejecutarTarea(db, { ...tarea, continuacion: 3 }, contextoCon(apiFalsa(adaptador).api))).toBe('estado');
  expect(adaptador.publishStep).not.toHaveBeenCalled();
});

it('si otro intento tomó el destino, el ciclo se detiene sin escribir', async () => {
  let ruta = '';
  const adaptador = adaptadorGuionado({
    inicio: async () => {
      await db.doc(ruta).update({ 'lease.attemptId': 'otro' });
      return continuar('a');
    },
  });
  const { postId, tarea } = await sembrarTiktok();
  ruta = `posts/${postId}/targets/tiktok`;

  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('ocupada');
  const destino = await leer(postId);
  expect(destino.checkpoint).toBeUndefined();
  expect(destino.lease?.attemptId).toBe('otro');
});

it('error definitivo deja fallida con el mensaje', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => fallo('definitivo', 'TikTok rechazó el video.') });
  const { postId, tarea } = await sembrarTiktok();
  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('fallida');
  expect((await leer(postId)).lastError).toMatchObject({
    code: 'prueba_definitivo',
    kind: 'definitivo',
    message: 'TikTok rechazó el video.',
  });
});

it('error de autenticación deja fallida y marca la conexión expirada', async () => {
  await sembrarConexion(db, 'tiktok');
  const adaptador = adaptadorGuionado({ inicio: () => fallo('auth', 'El acceso a TikTok venció.') });
  const { postId, tarea } = await sembrarTiktok();
  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('fallida');
  expect((await leer(postId)).lastError).toMatchObject({ kind: 'auth', message: 'El acceso a TikTok venció.' });
  expect((await db.doc('connections/tiktok').get()).get('authStatus')).toBe('expirada');
});

it('una sesión sin conexión deja fallida por autenticación', async () => {
  const adaptador = adaptadorGuionado({});
  const { postId, tarea } = await sembrarTiktok();
  const { api } = apiFalsa(adaptador, {
    sesion: () => Promise.reject(new PlatformError('auth', 'sin_conexion', 'TikTok no está conectada.')),
  });
  expect(await ejecutarTarea(db, tarea, contextoCon(api))).toBe('fallida');
  expect((await leer(postId)).lastError).toMatchObject({ kind: 'auth', message: 'TikTok no está conectada.' });
  expect(adaptador.publishStep).not.toHaveBeenCalled();
});

it('error temporal libera el lease y lanza para que Cloud Tasks reintente', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => fallo('temporal', 'TikTok respondió con un error (503).') });
  const { postId, tarea } = await sembrarTiktok();
  await expect(ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).rejects.toThrow(
    'TikTok respondió con un error (503).',
  );
  const destino = await leer(postId);
  expect(destino.status).toBe('publicando');
  expect(destino.lease).toBeUndefined();
});

it('ambiguo con la publicación encontrada la da por publicada', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => fallo('ambiguo') });
  adaptador.findExisting.mockResolvedValue({ id: 'r9', url: 'https://www.tiktok.com/@cuenta/video/r9' } as never);
  const { postId, tarea } = await sembrarTiktok();
  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('publicada');
  expect((await leer(postId)).remote).toMatchObject({ id: 'r9' });
  const [, ventana] = adaptador.findExisting.mock.calls[0] as unknown as [unknown, { desde: Date; hasta: Date }];
  expect(ventana).toEqual({
    desde: new Date(AHORA.getTime() - 30 * 60_000),
    hasta: new Date(AHORA.getTime() + 30 * 60_000),
  });
});

it('ambiguo sin encontrarla lanza', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => fallo('ambiguo', 'No se pudo confirmar.') });
  const { postId, tarea } = await sembrarTiktok();
  await expect(ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).rejects.toThrow('No se pudo confirmar.');
  expect((await leer(postId)).status).toBe('publicando');
});

it('una Hija en TikTok por API lleva la referencia en la descripción y la marca publicada', async () => {
  const principal = await sembrarPublicacion(db, {
    publicacion: { assetId, kind: 'principal', title: 'Largo' },
    destinos: [
      {
        platform: 'youtube',
        format: 'video_largo',
        status: 'publicada',
        remote: { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ', publishedAt: AHORA },
      },
    ],
  });
  const adaptador = adaptadorGuionado({ inicio: () => hecho() });
  const { postId, tarea } = await sembrarTiktok(
    { parentRef: { status: 'en_espera' } },
    { kind: 'hija', parentId: principal },
  );

  expect(await ejecutarTarea(db, tarea, contextoCon(apiFalsa(adaptador).api))).toBe('publicada');
  expect(adaptador.targets[0]?.texto).toContain('https://youtu.be/dQw4w9WgXcQ');
  expect((await leer(postId)).parentRef.status).toBe('publicada');
});

it('el presupuesto agotado continúa en otra ejecución sin hora programada', async () => {
  const adaptador = adaptadorGuionado({ inicio: () => continuar('a'), a: () => hecho() });
  const { postId, tarea } = await sembrarTiktok();
  const { api, encoladas } = apiFalsa(adaptador, { presupuestoMs: 0 });
  expect(await ejecutarTarea(db, tarea, contextoCon(api))).toBe('esperando');
  expect(encoladas).toEqual([{ tarea: { ...tarea, continuacion: 1 }, opciones: { id: `${postId}-tiktok-v1-c1` } }]);
});

it('programar por API exige la privacidad de TikTok', async () => {
  await sembrarConexion(db, 'tiktok');
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: entradaDePrueba(assetId, [['tiktok', 'tiktok']]),
  });
  const rechazo = await rechazoDe(propietario.llamar({ accion: 'programar', postId, inmediata: true }));
  expect(rechazo?.code).toBe('functions/failed-precondition');
  expect(rechazo?.message).toContain('Elige quién puede ver la publicación en TikTok.');
});

it('programar copia el modo efectivo por formato', async () => {
  await sembrarConexion(db, 'tiktok');
  const imagen = await crearAssetListo(db, {
    kind: 'image',
    originalName: 'foto.jpg',
    mimeType: 'image/jpeg',
    width: 1080,
    height: 1920,
    aspect: 0.5625,
    durationSec: undefined,
  });
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: entradaDePrueba(imagen, [['tiktok', 'imagen']]),
  });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  expect((await leer(postId)).publishMode).toBe('manual');
});

it('guardar conserva los campos de TikTok', async () => {
  const entrada = entradaDePrueba(assetId, [['tiktok', 'tiktok']]);
  const conCampos = {
    ...entrada,
    destinos: [{ platform: 'tiktok' as const, format: 'tiktok' as const, tiktok: PRIVADA }],
  };
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: conCampos });
  expect((await leer(postId)).tiktok).toEqual(PRIVADA);
  await propietario.llamar({ accion: 'guardar', publicacion: { ...entrada, postId } });
  expect((await leer(postId)).tiktok).toBeUndefined();
});
