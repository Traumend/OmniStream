import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  hashRecorte,
  recorteCentrado,
  type Asset,
  type Crop,
  type EntradaPublicacion,
  type FormatoDestino,
  type Platform,
} from '@omnistream/core';
import { probar } from '@omnistream/functions/src/archivos/medios';
import { guardarPublicacion } from '@omnistream/functions/src/publicacion/acciones/guardar';
import { ejecutarRecorte, type TareaRecorte } from '@omnistream/functions/src/publicacion/generarRecorte';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe } from '../datos';
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

describe('generarRecorte', () => {
  let fixtures: Fixtures;
  const subir = async (ruta: string, contentType: string, cambios: Partial<Asset>) => {
    const assetId = await crearAssetListo(db, cambios);
    await bucket.upload(ruta, { destination: `originales/${assetId}`, contentType });
    await db.doc(`assets/${assetId}`).update({ storagePath: `originales/${assetId}` });
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
