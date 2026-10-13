import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CAMPOS_TIKTOK_POR_DEFECTO,
  CAMPOS_YOUTUBE_POR_DEFECTO,
  hashRecorte,
  idTarea,
  recorteCentrado,
  type Asset,
  type CamposTiktok,
  type Crop,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type Platform,
} from '@omnistream/core';
import { probar } from '@omnistream/functions/src/archivos/medios';
import { guardarPublicacion } from '@omnistream/functions/src/publicacion/acciones/guardar';
import type { TareaPublicacion } from '@omnistream/functions/src/publicacion/cola';
import { fuentesDePublicacion } from '@omnistream/functions/src/publicacion/fuentes';
import { eliminarPublicacion } from '@omnistream/functions/src/publicacion/acciones/cierre';
import {
  ejecutarRecorte,
  opcionesEncolarRecorte,
  type TareaRecorte,
} from '@omnistream/functions/src/publicacion/generarRecorte';
import type { DependenciasApi } from '@omnistream/functions/src/publicacion/porApi';
import {
  ejecutarTarea,
  ESPERA_DERIVADO_SEG,
  MAX_ESPERAS_DERIVADO,
} from '@omnistream/functions/src/publicacion/publicarDestino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe, sembrarPublicacion } from '../datos';
import { rechazoDe } from '../errores';
import { prepararFixtures, type Fixtures } from '../fixtures';

const { db, bucket } = adminDemo('recortes');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);
const recorte916: Crop = { aspect: '9:16', x: 0.3418, y: 0, w: 0.3164, h: 1 };
const recorte11: Crop = { aspect: '1:1', x: 0.2188, y: 0, w: 0.5625, h: 1 };

let encolados: TareaRecorte[] = [];
let assetHorizontal: string;
const deps = () => ({
  db,
  ahora: new Date(),
  encolar: async () => {},
  encolarRecorte: async (tarea: TareaRecorte) => {
    encolados.push(tarea);
  },
});
const conRecorte = (assetId: string, crop?: Crop, overrides: Record<string, unknown> = {}): EntradaPublicacion => {
  const entrada = entradaDePrueba(assetId, [['tiktok', 'tiktok']]);
  return {
    ...entrada,
    destinos: [{ platform: 'tiktok', format: 'tiktok', overrides: { ...overrides, ...(crop ? { crop } : {}) } }],
  };
};

beforeAll(async () => {
  assetHorizontal = await crearAssetListo(db, { width: 1280, height: 720, aspect: 16 / 9 });
});
beforeEach(() => {
  encolados = [];
});

it('guardar con recorte deja el derivado pendiente y lo encola una vez', async () => {
  const { postId } = await guardarPublicacion(conRecorte(assetHorizontal, recorte916), deps());
  await guardarPublicacion({ ...conRecorte(assetHorizontal, recorte916), postId }, deps());
  const cropHash = hashRecorte(assetHorizontal, recorte916);
  const destino = await leer(postId, 'tiktok');
  expect(destino.overrides.crop).toEqual(recorte916);
  expect(destino.derivative).toEqual({ cropHash, status: 'pendiente' });
  expect(encolados).toEqual([{ postId, platform: 'tiktok', cropHash }]);
});

it('cambiar el recorte cambia la huella y vuelve a encolar', async () => {
  const { postId } = await guardarPublicacion(conRecorte(assetHorizontal, recorte916), deps());
  await db.doc(`posts/${postId}/targets/tiktok`).update({ 'derivative.status': 'listo' });
  await guardarPublicacion({ ...conRecorte(assetHorizontal, recorte11), postId }, deps());
  const cropHash = hashRecorte(assetHorizontal, recorte11);
  expect((await leer(postId, 'tiktok')).derivative).toEqual({ cropHash, status: 'pendiente' });
  expect(encolados.map((t) => t.cropHash)).toEqual([hashRecorte(assetHorizontal, recorte916), cropHash]);
});

it('quitar el recorte borra el derivado', async () => {
  const { postId } = await guardarPublicacion(conRecorte(assetHorizontal, recorte916), deps());
  await guardarPublicacion({ ...conRecorte(assetHorizontal), postId }, deps());
  const destino = await leer(postId, 'tiktok');
  expect(destino.overrides).toEqual({});
  expect(destino.derivative).toBeUndefined();
  expect(encolados).toHaveLength(1);
});

it('cambiar de archivo con el mismo recorte obliga a regenerar', async () => {
  const otro = await crearAssetListo(db, { width: 1280, height: 720, aspect: 16 / 9 });
  const { postId } = await guardarPublicacion(conRecorte(assetHorizontal, recorte916), deps());
  await guardarPublicacion({ ...conRecorte(otro, recorte916), postId }, deps());
  expect((await leer(postId, 'tiktok')).derivative).toEqual({
    cropHash: hashRecorte(otro, recorte916),
    status: 'pendiente',
  });
  expect(encolados).toHaveLength(2);
});

it('guardar conserva los overrides de texto, hashtags, título y hora', async () => {
  const hora = '2030-01-01T10:00:00.000Z';
  const overrides = { text: 'Propio', hashtags: [], title: 'Título propio', scheduledAt: hora };
  const { postId } = await guardarPublicacion(conRecorte(assetHorizontal, undefined, overrides), deps());
  expect((await leer(postId, 'tiktok')).overrides).toEqual({ ...overrides, scheduledAt: new Date(hora) });
  await guardarPublicacion({ ...conRecorte(assetHorizontal, undefined, { text: 'Otro' }), postId }, deps());
  expect((await leer(postId, 'tiktok')).overrides).toEqual({ text: 'Otro' });
  expect(encolados).toEqual([]);
});

it('recortar un video de más de 15 minutos se rechaza', async () => {
  const largo = await crearAssetListo(db, { width: 1280, height: 720, aspect: 16 / 9, durationSec: 901 });
  expect(await rechazoDe(guardarPublicacion(conRecorte(largo, recorte916), deps()))).toEqual({
    code: 'failed-precondition',
    message: 'El recorte de video se permite para videos de hasta 15 minutos y 2 GB.',
  });
});

let fixtures: Fixtures;
const subir = async (ruta: string, contentType: string, cambios: Partial<Asset>) => {
  const assetId = await crearAssetListo(db, cambios);
  const [archivo] = await bucket.upload(ruta, { destination: `originales/${assetId}`, contentType });
  const sizeBytes = Number((await archivo.getMetadata())[0].size);
  await db.doc(`assets/${assetId}`).update({ storagePath: `originales/${assetId}`, sizeBytes });
  return assetId;
};
const conDestinos = async (assetId: string, destinos: [Platform, FormatoDestino, Crop][]) => {
  const entrada = entradaDePrueba(assetId, []);
  const { postId } = await guardarPublicacion(
    { ...entrada, destinos: destinos.map(([platform, format, crop]) => ({ platform, format, overrides: { crop } })) },
    deps(),
  );
  return postId;
};
const tarea = (postId: string, platform: Platform, assetId: string, crop: Crop) => ({
  postId,
  platform,
  cropHash: hashRecorte(assetId, crop),
});
const archivosDe = async (postId: string, red: Platform) =>
  (await bucket.getFiles({ prefix: `derivados/${postId}/${red}/` }))[0].map((f) => f.name);
const dimensiones = async (ruta: string) => {
  const local = join(directorio, ruta.replaceAll('/', '_'));
  await bucket.file(ruta).download({ destination: local });
  const pista = (await probar(local)).streams?.find((p) => p.codec_type === 'video');
  const rotacion = pista?.side_data_list?.find((d) => typeof d.rotation === 'number')?.rotation ?? 0;
  return { width: pista?.width, height: pista?.height, rotacion };
};
let directorio: string;
let horizontal: string;

beforeAll(async () => {
  // urlDeLectura apunta al emulador de Storage, como dentro del emulador de funciones.
  process.env.FUNCTIONS_EMULATOR = 'true';
  fixtures = await prepararFixtures();
  directorio = await mkdtemp(join(tmpdir(), 'recortes-'));
  horizontal = await subir(fixtures.videoHorizontal, 'video/mp4', {
    width: 1280,
    height: 720,
    aspect: 16 / 9,
    durationSec: 4,
  });
});
afterAll(async () => {
  await rm(directorio, { recursive: true, force: true });
});

describe('generarRecorte', () => {
  it('un 16:9 recortado a 9:16 para TikTok y 1:1 para Facebook genera dos archivos distintos', async () => {
    const tiktok = recorteCentrado('9:16', 1280, 720);
    const facebook = recorteCentrado('1:1', 1280, 720);
    const postId = await conDestinos(horizontal, [
      ['tiktok', 'tiktok', tiktok],
      ['facebook', 'video_largo', facebook],
    ]);
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, tiktok))).toBe('listo');
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'facebook', horizontal, facebook))).toBe('listo');
    const [dTiktok, dFacebook] = await Promise.all([leer(postId, 'tiktok'), leer(postId, 'facebook')]);
    expect(dTiktok.derivative).toMatchObject({ status: 'listo', cropHash: hashRecorte(horizontal, tiktok) });
    expect(dFacebook.derivative).toMatchObject({ status: 'listo', cropHash: hashRecorte(horizontal, facebook) });
    const rutaTiktok = dTiktok.derivative?.storagePath as string;
    const rutaFacebook = dFacebook.derivative?.storagePath as string;
    expect(rutaTiktok).toBe(`derivados/${postId}/tiktok/${hashRecorte(horizontal, tiktok)}.mp4`);
    expect(rutaFacebook).not.toBe(rutaTiktok);
    expect(await dimensiones(rutaTiktok)).toEqual({ width: 1080, height: 1920, rotacion: 0 });
    expect(await dimensiones(rutaFacebook)).toEqual({ width: 1080, height: 1080, rotacion: 0 });
    const [meta] = await bucket.file(rutaTiktok).getMetadata();
    expect(meta.contentType).toBe('video/mp4');
    expect(meta.metadata?.firebaseStorageDownloadTokens).toBeTruthy();
  });

  it('una tarea con huella vieja no hace nada y no deja archivos', async () => {
    const actual = recorteCentrado('9:16', 1280, 720);
    const postId = await conDestinos(horizontal, [['tiktok', 'tiktok', actual]]);
    const vieja = { ...actual, x: 0 };
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, vieja))).toBe('omitido');
    expect((await leer(postId, 'tiktok')).derivative).toMatchObject({ status: 'pendiente' });
    expect(await archivosDe(postId, 'tiktok')).toEqual([]);
  });

  it('al terminar un recorte nuevo se borra el anterior', async () => {
    const primero = recorteCentrado('9:16', 1280, 720);
    const postId = await conDestinos(horizontal, [['tiktok', 'tiktok', primero]]);
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, primero))).toBe('listo');
    const segundo = { ...primero, x: 0 };
    await guardarPublicacion(
      {
        ...entradaDePrueba(horizontal, []),
        postId,
        destinos: [{ platform: 'tiktok', format: 'tiktok', overrides: { crop: segundo } }],
      },
      deps(),
    );
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, segundo))).toBe('listo');
    expect(await archivosDe(postId, 'tiktok')).toEqual([
      `derivados/${postId}/tiktok/${hashRecorte(horizontal, segundo)}.mp4`,
    ]);
  });

  it('un video rotado se recorta sobre el cuadro ya rotado', async () => {
    // El original mide 1280×720 con rotación de 90°: se ve vertical, 720×1280.
    const rotado = await subir(fixtures.videoRotado, 'video/mp4', {
      width: 720,
      height: 1280,
      aspect: 720 / 1280,
      rotation: 90,
      durationSec: 4,
    });
    const crop = recorteCentrado('9:16', 720, 1280);
    expect(crop).toMatchObject({ x: 0, w: 1 });
    const postId = await conDestinos(rotado, [['tiktok', 'tiktok', crop]]);
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', rotado, crop))).toBe('listo');
    const ruta = (await leer(postId, 'tiktok')).derivative?.storagePath as string;
    expect(await dimensiones(ruta)).toEqual({ width: 1080, height: 1920, rotacion: 0 });
  });

  it('una imagen se recorta con sharp a 1080×1350', async () => {
    const imagen = await subir(fixtures.imagen, 'image/jpeg', {
      kind: 'image',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      aspect: 1.5,
      durationSec: undefined,
    });
    const crop = recorteCentrado('4:5', 1200, 800);
    const postId = await conDestinos(imagen, [['instagram', 'imagen', crop]]);
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'instagram', imagen, crop))).toBe('listo');
    const ruta = (await leer(postId, 'instagram')).derivative?.storagePath as string;
    expect(ruta.endsWith('.jpg')).toBe(true);
    expect(await dimensiones(ruta)).toMatchObject({ width: 1080, height: 1350 });
  });

  it('si el original fue purgado queda fallido con el mensaje', async () => {
    const purgado = await crearAssetListo(db, { width: 1280, height: 720, aspect: 16 / 9 });
    const crop = recorteCentrado('9:16', 1280, 720);
    const postId = await conDestinos(purgado, [['tiktok', 'tiktok', crop]]);
    await db.doc(`assets/${purgado}`).update({ status: 'purgado' });
    expect(await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', purgado, crop))).toBe('fallido');
    expect((await leer(postId, 'tiktok')).derivative).toEqual({
      cropHash: hashRecorte(purgado, crop),
      status: 'fallido',
      error: 'El archivo original ya no está disponible.',
    });
  });
});

describe('publicación con derivado', () => {
  const PRIVADA: CamposTiktok = { ...CAMPOS_TIKTOK_POR_DEFECTO, privacy: 'SELF_ONLY' };
  const tiktok916 = recorteCentrado('9:16', 1280, 720);
  const facebook11 = recorteCentrado('1:1', 1280, 720);
  type Recibido = { red: Platform; size: number; mimeType: string; miniatura?: number };

  function apiQueAnota() {
    const recibidos: Recibido[] = [];
    const encoladas: { tarea: TareaPublicacion; opciones: { id: string; scheduleTime?: Date } }[] = [];
    const api: DependenciasApi = {
      adaptador: (red) => ({
        platform: red,
        publishStep: async (_target, _checkpoint, ctx) => {
          recibidos.push({
            red,
            size: ctx.archivo.size,
            mimeType: ctx.archivo.mimeType,
            ...(ctx.miniatura ? { miniatura: ctx.miniatura.size } : {}),
          });
          return { kind: 'done', remote: { id: `r-${red}`, url: `https://ejemplo.test/${red}` } };
        },
        findExisting: async () => null,
        postComment: async () => ({ id: 'c' }),
      }),
      sesion: async () => ({ accessToken: 'token', datos: {} }),
      fuentes: (asset, destino) => fuentesDePublicacion(bucket, asset, destino),
      marcarExpirada: async () => {},
      encolar: async (tarea, opciones) => void encoladas.push({ tarea, opciones }),
      http: () => Promise.reject(new Error('sin red')),
      presupuestoMs: 60_000,
    };
    return { api, recibidos, encoladas };
  }

  const programado = (platform: Platform, format: FormatoDestino, cambios: Partial<Destino> = {}) => ({
    platform,
    format,
    status: 'programada' as const,
    scheduleVersion: 1,
    scheduledAt: new Date(),
    publishMode: 'api' as const,
    ...(platform === 'tiktok' ? { tiktok: PRIVADA } : {}),
    ...cambios,
  });
  const contexto = (api: DependenciasApi) => ({
    ahora: () => new Date(),
    ultimoIntento: false,
    api,
    encolarRecorte: async (t: TareaRecorte) => void encolados.push(t),
  });
  const tamano = async (ruta: string) => Number((await bucket.file(ruta).getMetadata())[0].size);

  it('cada red publica su derivado', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', { overrides: { crop: tiktok916 } }),
        programado('facebook', 'video_largo', { overrides: { crop: facebook11 } }),
      ],
    });
    await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, tiktok916));
    await ejecutarRecorte(db, bucket, tarea(postId, 'facebook', horizontal, facebook11));
    const { api, recibidos } = apiQueAnota();
    expect(await ejecutarTarea(db, { postId, platform: 'tiktok', scheduleVersion: 1 }, contexto(api))).toBe(
      'publicada',
    );
    expect(await ejecutarTarea(db, { postId, platform: 'facebook', scheduleVersion: 1 }, contexto(api))).toBe(
      'publicada',
    );
    const rutaTiktok = (await leer(postId, 'tiktok')).derivative?.storagePath as string;
    const rutaFacebook = (await leer(postId, 'facebook')).derivative?.storagePath as string;
    expect(recibidos).toEqual([
      { red: 'tiktok', size: await tamano(rutaTiktok), mimeType: 'video/mp4' },
      { red: 'facebook', size: await tamano(rutaFacebook), mimeType: 'video/mp4' },
    ]);
    expect(recibidos[0]?.size).not.toBe(recibidos[1]?.size);
  });

  it('sin derivado listo la tarea espera y vuelve en 120 s sin publicar el original', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', {
          overrides: { crop: tiktok916 },
          derivative: { cropHash: hashRecorte(horizontal, tiktok916), status: 'pendiente' },
        }),
      ],
    });
    const { api, recibidos, encoladas } = apiQueAnota();
    const antes = Date.now();
    expect(await ejecutarTarea(db, { postId, platform: 'tiktok', scheduleVersion: 1 }, contexto(api))).toBe(
      'esperando',
    );
    expect(recibidos).toEqual([]);
    // La primera espera vuelve a pedir el recorte: un pedido de guardar pudo perderse.
    expect(encolados).toEqual([{ postId, platform: 'tiktok', cropHash: hashRecorte(horizontal, tiktok916) }]);
    expect(encoladas).toHaveLength(1);
    expect(encoladas[0]?.tarea).toEqual({ postId, platform: 'tiktok', scheduleVersion: 1, esperaDerivado: 1 });
    expect(encoladas[0]?.opciones.id).toBe(`${idTarea(postId, 'tiktok', 1)}-d1`);
    const retraso = (encoladas[0]?.opciones.scheduleTime?.getTime() ?? 0) - antes;
    expect(retraso).toBeGreaterThanOrEqual(ESPERA_DERIVADO_SEG * 1000 - 1000);
    expect(retraso).toBeLessThanOrEqual(ESPERA_DERIVADO_SEG * 1000 + 5000);
    const destino = await leer(postId, 'tiktok');
    expect(destino.status).toBe('publicando');
    expect(destino.lease).toBeUndefined();
  });

  it('en las esperas siguientes un derivado pendiente no se vuelve a pedir', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', {
          status: 'publicando',
          overrides: { crop: tiktok916 },
          derivative: { cropHash: hashRecorte(horizontal, tiktok916), status: 'pendiente' },
        }),
      ],
    });
    const { api } = apiQueAnota();
    const tareaEspera = { postId, platform: 'tiktok' as const, scheduleVersion: 1, esperaDerivado: 3 };
    expect(await ejecutarTarea(db, tareaEspera, contexto(api))).toBe('esperando');
    expect(encolados).toEqual([]);
  });

  it('sin derivado o con uno fallido pide generarlo antes de esperar', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', {
          overrides: { crop: tiktok916 },
          derivative: { cropHash: hashRecorte(horizontal, tiktok916), status: 'fallido', error: 'x' },
        }),
      ],
    });
    const { api } = apiQueAnota();
    expect(await ejecutarTarea(db, { postId, platform: 'tiktok', scheduleVersion: 1 }, contexto(api))).toBe(
      'esperando',
    );
    expect(encolados).toEqual([{ postId, platform: 'tiktok', cropHash: hashRecorte(horizontal, tiktok916) }]);
  });

  it('a la espera 15 falla con el mensaje', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', {
          status: 'publicando',
          overrides: { crop: tiktok916 },
          derivative: { cropHash: hashRecorte(horizontal, tiktok916), status: 'generando' },
        }),
      ],
    });
    const { api, recibidos, encoladas } = apiQueAnota();
    const resultado = await ejecutarTarea(
      db,
      { postId, platform: 'tiktok', scheduleVersion: 1, esperaDerivado: MAX_ESPERAS_DERIVADO },
      contexto(api),
    );
    expect(resultado).toBe('fallida');
    expect(recibidos).toEqual([]);
    expect(encoladas).toEqual([]);
    expect((await leer(postId, 'tiktok')).lastError).toMatchObject({
      code: 'recorte',
      kind: 'definitivo',
      message: 'No se pudo generar el recorte para TikTok.',
    });
  });

  it('una red sin recorte sigue publicando el original', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [programado('facebook', 'video_largo')],
    });
    const { api, recibidos } = apiQueAnota();
    expect(await ejecutarTarea(db, { postId, platform: 'facebook', scheduleVersion: 1 }, contexto(api))).toBe(
      'publicada',
    );
    expect(recibidos).toEqual([
      { red: 'facebook', size: await tamano(`originales/${horizontal}`), mimeType: 'video/mp4' },
    ]);
  });

  it('en modo manual el destino pasa a pendiente_manual solo con el derivado listo', async () => {
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('tiktok', 'tiktok', {
          publishMode: 'manual',
          overrides: { crop: tiktok916 },
          derivative: { cropHash: hashRecorte(horizontal, tiktok916), status: 'pendiente' },
        }),
      ],
    });
    const { api } = apiQueAnota();
    const tareaTiktok = { postId, platform: 'tiktok' as const, scheduleVersion: 1 };
    expect(await ejecutarTarea(db, tareaTiktok, contexto(api))).toBe('esperando');
    expect((await leer(postId, 'tiktok')).status).toBe('publicando');
    await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, tiktok916));
    expect(await ejecutarTarea(db, { ...tareaTiktok, esperaDerivado: 1 }, contexto(api))).toBe('pendiente_manual');
  });

  it('la miniatura propia usa la imagen elegida', async () => {
    const imagen = await subir(fixtures.imagen, 'image/jpeg', {
      kind: 'image',
      mimeType: 'image/jpeg',
      width: 1200,
      height: 800,
      aspect: 1.5,
    });
    const postId = await sembrarPublicacion(db, {
      publicacion: { assetId: horizontal },
      destinos: [
        programado('youtube', 'video_largo', {
          youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, thumbnail: { assetId: imagen } },
        }),
      ],
    });
    const { api, recibidos } = apiQueAnota();
    expect(await ejecutarTarea(db, { postId, platform: 'youtube', scheduleVersion: 1 }, contexto(api))).toBe(
      'publicada',
    );
    expect(recibidos[0]?.miniatura).toBe(await tamano(`originales/${imagen}`));
  });
});

describe('cola y limpieza de derivados', () => {
  const tiktok916 = recorteCentrado('9:16', 1280, 720);
  const borrarDerivados = async (postId: string, red?: Platform) => {
    await bucket.deleteFiles({ prefix: red ? `derivados/${postId}/${red}/` : `derivados/${postId}/` });
  };
  const depsConLimpieza = () => ({ ...deps(), borrarDerivados });

  it('cada pedido de recorte va a la cola sin id fijo, con 60 s de retraso y 30 min de plazo', () => {
    const ahora = new Date('2030-01-01T10:00:00Z');
    const opciones = opcionesEncolarRecorte(ahora);
    expect(opciones).not.toHaveProperty('id');
    expect(opciones.scheduleTime).toEqual(new Date('2030-01-01T10:01:00Z'));
    expect(opciones.dispatchDeadlineSeconds).toBe(1800);
  });

  it('un recorte que ya está listo no se vuelve a generar', async () => {
    const postId = await conDestinos(horizontal, [['tiktok', 'tiktok', tiktok916]]);
    const t = tarea(postId, 'tiktok', horizontal, tiktok916);
    expect(await ejecutarRecorte(db, bucket, t)).toBe('listo');
    const ruta = (await leer(postId, 'tiktok')).derivative?.storagePath as string;
    const [antes] = await bucket.file(ruta).getMetadata();
    expect(await ejecutarRecorte(db, bucket, t)).toBe('listo');
    const [despues] = await bucket.file(ruta).getMetadata();
    expect(despues.generation).toBe(antes.generation);
    expect((await leer(postId, 'tiktok')).derivative?.status).toBe('listo');
  });

  it('quitar el recorte o la red borra sus derivados de Storage', async () => {
    const postId = await conDestinos(horizontal, [
      ['tiktok', 'tiktok', tiktok916],
      ['facebook', 'video_largo', tiktok916],
    ]);
    await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, tiktok916));
    await ejecutarRecorte(db, bucket, tarea(postId, 'facebook', horizontal, tiktok916));
    await guardarPublicacion(
      {
        ...entradaDePrueba(horizontal, []),
        postId,
        destinos: [{ platform: 'tiktok', format: 'tiktok', overrides: {} }],
      },
      depsConLimpieza(),
    );
    expect(await archivosDe(postId, 'tiktok')).toEqual([]);
    expect(await archivosDe(postId, 'facebook')).toEqual([]);
  });

  it('eliminar la publicación borra sus derivados', async () => {
    const postId = await conDestinos(horizontal, [['tiktok', 'tiktok', tiktok916]]);
    await ejecutarRecorte(db, bucket, tarea(postId, 'tiktok', horizontal, tiktok916));
    expect(await archivosDe(postId, 'tiktok')).toHaveLength(1);
    await eliminarPublicacion(postId, depsConLimpieza());
    expect(await archivosDe(postId, 'tiktok')).toEqual([]);
  });
});
