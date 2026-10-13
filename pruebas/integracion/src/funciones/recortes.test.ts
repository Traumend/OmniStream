import { hashRecorte, type Crop, type EntradaPublicacion, type Platform } from '@omnistream/core';
import { guardarPublicacion } from '@omnistream/functions/src/publicacion/acciones/guardar';
import type { TareaRecorte } from '@omnistream/functions/src/publicacion/generarRecorte';
import { beforeAll, beforeEach, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe } from '../datos';
import { rechazoDe } from '../errores';

const { db } = adminDemo('recortes');
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
