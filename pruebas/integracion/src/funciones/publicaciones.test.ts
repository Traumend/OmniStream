import type { FormatoDestino, Platform } from '@omnistream/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe } from '../datos';
import { rechazoDe } from '../errores';
import { esperarHasta, pausa } from '../esperar';
import { clienteAnonimo, clientePropietario, type Cliente } from '../sesion';

const { db } = adminDemo('publicaciones');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);
const CUATRO: [Platform, FormatoDestino][] = [
  ['facebook', 'reel'],
  ['instagram', 'reel'],
  ['youtube', 'short'],
  ['tiktok', 'tiktok'],
];

let propietario: Cliente;
let anonimo: Cliente;
let assetVertical: string;
const entrada = (redes: [Platform, FormatoDestino][], assetId = assetVertical) => entradaDePrueba(assetId, redes);
const enMinutos = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

beforeAll(async () => {
  propietario = await clientePropietario();
  anonimo = await clienteAnonimo();
  assetVertical = await crearAssetListo(db);
});

afterAll(async () => {
  await propietario.cerrar();
  await anonimo.cerrar();
});

it('rechaza llamadas sin sesión', async () => {
  expect(await rechazoDe(anonimo.llamar({ accion: 'cancelar', postId: 'x' }))).toEqual({
    code: 'functions/unauthenticated',
    message: 'Inicia sesión para continuar.',
  });
});

it('guardar crea la publicación y sus destinos en borrador', async () => {
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: entrada([
      ['facebook', 'reel'],
      ['tiktok', 'tiktok'],
    ]),
  });
  const post = (await db.doc(`posts/${postId}`).get()).data();
  expect(post).toMatchObject({ kind: 'independiente', status: 'borrador', title: 'Prueba', scheduledAt: null });
  const destinos = (await db.collection(`posts/${postId}/targets`).get()).docs.map((d) => d.data());
  expect(destinos).toHaveLength(2);
  expect(destinos[0]).toMatchObject({
    status: 'borrador',
    scheduleVersion: 0,
    publishMode: 'manual',
    attempts: 0,
    parentRef: { status: 'no_aplica' },
  });
});

it('guardar rechaza una Hija cuyo principal no existe', async () => {
  expect(
    await rechazoDe(
      propietario.llamar({
        accion: 'guardar',
        publicacion: { ...entrada([['tiktok', 'tiktok']]), parentId: 'no-existe' },
      }),
    ),
  ).toEqual({ code: 'functions/failed-precondition', message: 'El video principal elegido ya no existe.' });
});

it('programar sin fecha falla con el error de validación', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['tiktok', 'tiktok']]) });
  expect(await rechazoDe(propietario.llamar({ accion: 'programar', postId, inmediata: false }))).toEqual({
    code: 'functions/failed-precondition',
    message: 'Elige la fecha y la hora.',
  });
});

it('publicar ahora a 4 redes deja los 4 destinos en pendiente_manual', async () => {
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada(CUATRO) });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  for (const red of ['facebook', 'instagram', 'youtube', 'tiktok'] as const) {
    await esperarHasta(
      () => leer(postId, red),
      (d) => d.status === 'pendiente_manual',
    );
  }
});

it('mover una publicación programada no la duplica', async () => {
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: { ...entrada([['tiktok', 'tiktok']]), scheduledAt: enMinutos(60) },
  });
  await propietario.llamar({ accion: 'programar', postId, inmediata: false });
  await pausa(3_000); // la tarea v1 llega de inmediato en el emulador y termina como anticipada
  await propietario.llamar({ accion: 'mover', postId, scheduledAt: new Date(Date.now() + 5_000).toISOString() });
  const destino = await esperarHasta(
    () => leer(postId, 'tiktok'),
    (d) => d.status === 'pendiente_manual',
  );
  expect(destino).toMatchObject({ scheduleVersion: 2, attempts: 1 });
  expect((await db.collection(`posts/${postId}/targets`).get()).size).toBe(1);
  expect((await db.collection(`posts/${postId}/targets/tiktok/attempts`).get()).size).toBe(1);
});

it('mover al pasado se rechaza', async () => {
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: { ...entrada([['tiktok', 'tiktok']]), scheduledAt: enMinutos(60) },
  });
  await propietario.llamar({ accion: 'programar', postId, inmediata: false });
  expect(await rechazoDe(propietario.llamar({ accion: 'mover', postId, scheduledAt: enMinutos(-1) }))).toEqual({
    code: 'functions/failed-precondition',
    message: 'No se puede mover al pasado.',
  });
});

it('guardar una publicación programada la vuelve a programar', async () => {
  const fecha = enMinutos(60);
  const base = { ...entrada([['tiktok', 'tiktok']]), scheduledAt: fecha };
  const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: base });
  await propietario.llamar({ accion: 'programar', postId, inmediata: false });
  expect(await leer(postId, 'tiktok')).toMatchObject({ status: 'programada', scheduleVersion: 1 });
  await propietario.llamar({
    accion: 'guardar',
    publicacion: { ...base, postId, base: { text: 'Otro texto', hashtags: [] } },
  });
  const destino = await esperarHasta(
    () => leer(postId, 'tiktok'),
    (d) => d.enqueuedVersion === 2,
  );
  expect(destino).toMatchObject({ status: 'programada', scheduleVersion: 2 });
  expect((await db.doc(`posts/${postId}`).get()).get('base.text')).toBe('Otro texto');
});
