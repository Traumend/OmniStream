import type { FormatoDestino, Platform } from '@omnistream/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe } from '../datos';
import { rechazoDe } from '../errores';
import { esperarHasta } from '../esperar';
import { clientePropietario, type Cliente } from '../sesion';

const { db } = adminDemo('cierre');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);
const URL_TIKTOK = 'https://www.tiktok.com/@cuenta/video/7300000000000000001';

let propietario: Cliente;
let assetVertical: string;
let assetHorizontal: string;
const entrada = (redes: [Platform, FormatoDestino][], assetId = assetVertical) => entradaDePrueba(assetId, redes);
const enMinutos = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();
const precondicion = (message: string) => ({ code: 'functions/failed-precondition', message });

async function publicarAhora(redes: [Platform, FormatoDestino][], assetId = assetVertical): Promise<string> {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada(redes, assetId) });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  for (const [red] of redes) {
    await esperarHasta(
      () => leer(postId, red),
      (d) => d.status === 'pendiente_manual',
    );
  }
  return postId;
}

beforeAll(async () => {
  propietario = await clientePropietario();
  assetVertical = await crearAssetListo(db);
  assetHorizontal = await crearAssetListo(db, { width: 1920, height: 1080, aspect: 1.7778, durationSec: 600 });
});

afterAll(async () => {
  await propietario.cerrar();
});

it('cancelar deja los destinos cancelados', async () => {
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: {
      ...entrada([
        ['facebook', 'reel'],
        ['tiktok', 'tiktok'],
      ]),
      scheduledAt: enMinutos(60),
    },
  });
  await propietario.llamar({ accion: 'programar', postId, inmediata: false });
  await propietario.llamar({ accion: 'cancelar', postId });
  expect((await leer(postId, 'facebook')).status).toBe('cancelada');
  expect((await leer(postId, 'tiktok')).status).toBe('cancelada');
});

it('cancelar sin destinos cancelables se rechaza', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([]) });
  expect(await rechazoDe(propietario.llamar({ accion: 'cancelar', postId }))).toEqual(
    precondicion('No hay destinos que cancelar.'),
  );
});

it('reintentar vuelve a programar un destino fallido', async () => {
  await db.doc('connections/facebook').set({ authStatus: 'conectada', publishMode: 'api' });
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['facebook', 'reel']]) });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  await esperarHasta(
    () => leer(postId, 'facebook'),
    (d) => d.status === 'fallida',
  );
  await db.doc('connections/facebook').delete();
  await propietario.llamar({ accion: 'reintentar', postId, platform: 'facebook' });
  const destino = await esperarHasta(
    () => leer(postId, 'facebook'),
    (d) => d.status === 'pendiente_manual',
  );
  expect(destino).toMatchObject({ scheduleVersion: 2, publishMode: 'manual' });
  expect(destino.lastError).toBeUndefined();
});

it('reintentar un destino que no falló se rechaza', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['tiktok', 'tiktok']]) });
  expect(await rechazoDe(propietario.llamar({ accion: 'reintentar', postId, platform: 'tiktok' }))).toEqual(
    precondicion('Solo se puede reintentar un destino fallido.'),
  );
});

it('marcar publicada con una URL válida guarda remote', async () => {
  const postId = await publicarAhora([['tiktok', 'tiktok']]);
  await propietario.llamar({ accion: 'marcarPublicada', postId, platform: 'tiktok', url: URL_TIKTOK });
  const destino = await leer(postId, 'tiktok');
  expect(destino.status).toBe('publicada');
  expect(destino.remote).toMatchObject({ id: '7300000000000000001', url: URL_TIKTOK });
  expect(destino.remote?.publishedAt).toBeInstanceOf(Date);
});

it('marcar publicada rechaza una URL de otra red', async () => {
  const postId = await publicarAhora([['instagram', 'reel']]);
  expect(
    await rechazoDe(
      propietario.llamar({
        accion: 'marcarPublicada',
        postId,
        platform: 'instagram',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    ),
  ).toEqual({ code: 'functions/invalid-argument', message: 'La URL no corresponde a una publicación de Instagram.' });
});

it('marcar publicada exige pendiente_manual', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['tiktok', 'tiktok']]) });
  expect(
    await rechazoDe(propietario.llamar({ accion: 'marcarPublicada', postId, platform: 'tiktok', url: URL_TIKTOK })),
  ).toEqual(precondicion('Este destino no está pendiente de publicación manual.'));
});

it('eliminar un principal con Hijas está prohibido hasta desvincularlas', async () => {
  const { postId: principal } = await propietario.llamar({
    accion: 'guardar',
    publicacion: entrada([['youtube', 'video_largo']], assetHorizontal),
  });
  const { postId: hija } = await propietario.llamar({
    accion: 'guardar',
    publicacion: { ...entrada([['tiktok', 'tiktok']]), parentId: principal },
  });
  expect((await leer(hija, 'tiktok')).parentRef.status).toBe('en_espera');
  expect(await rechazoDe(propietario.llamar({ accion: 'eliminar', postId: principal }))).toEqual(
    precondicion('Esta publicación tiene Hijas. Desvincúlalas antes de eliminarla.'),
  );

  await propietario.llamar({ accion: 'desvincular', postId: hija });
  const desvinculada = (await db.doc(`posts/${hija}`).get()).data();
  expect(desvinculada?.kind).toBe('independiente');
  expect(desvinculada?.parentId).toBeUndefined();
  expect((await leer(hija, 'tiktok')).parentRef.status).toBe('no_aplica');

  await propietario.llamar({ accion: 'eliminar', postId: principal });
  expect((await db.doc(`posts/${principal}`).get()).exists).toBe(false);
  expect((await db.collection(`posts/${principal}/targets`).get()).size).toBe(0);
});

it('eliminar una publicación publicada está prohibido', async () => {
  const postId = await publicarAhora([['tiktok', 'tiktok']]);
  await propietario.llamar({ accion: 'marcarPublicada', postId, platform: 'tiktok', url: URL_TIKTOK });
  expect(await rechazoDe(propietario.llamar({ accion: 'eliminar', postId }))).toEqual(
    precondicion('No se puede eliminar una publicación publicada o en curso.'),
  );
});
