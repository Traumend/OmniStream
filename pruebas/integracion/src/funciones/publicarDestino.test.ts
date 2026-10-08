import { idTarea, type Platform } from '@omnistream/core';
import { encolarDestino, encoladorCloudTasks } from '@omnistream/functions/src/publicacion/cola';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminDemo, PROYECTO } from '../admin';
import { crearAssetListo, leerDestinoDe, sembrarPublicacion } from '../datos';
import { esperarHasta, pausa } from '../esperar';

process.env.CLOUD_TASKS_EMULATOR_HOST ??= '127.0.0.1:9499';

const { app, db } = adminDemo('publicarDestino');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);
let assetId: string;

beforeAll(async () => {
  // getFunctions() usa la app por defecto para encolar en el emulador de Cloud Tasks.
  if (!getApps().some((a) => a.name === '[DEFAULT]')) initializeApp({ projectId: PROYECTO });
  assetId = await crearAssetListo(db);
});

afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
  void app;
});

it('una tarea vencida deja el destino manual en pendiente_manual y registra el intento', async () => {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: new Date() },
    ],
  });
  await encolarDestino(
    db,
    postId,
    { platform: 'tiktok', scheduleVersion: 1, scheduledAt: new Date(), attempts: 0 },
    encoladorCloudTasks(),
    new Date(),
  );
  const destino = await esperarHasta(
    () => leer(postId, 'tiktok'),
    (d) => d.status === 'pendiente_manual',
  );
  expect(destino).toMatchObject({ attempts: 1, enqueuedVersion: 1 });
  expect(destino.lease).toBeUndefined();
  const intentos = await db.collection(`posts/${postId}/targets/tiktok/attempts`).get();
  expect(intentos.docs.map((d) => d.data())).toEqual([expect.objectContaining({ stage: 'manual', result: 'ok' })]);
});

it('una tarea de otra versión no hace nada', async () => {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 2, scheduledAt: new Date() },
    ],
  });
  await encoladorCloudTasks()({ postId, platform: 'tiktok', scheduleVersion: 1 }, { id: idTarea(postId, 'tiktok', 1) });
  await pausa(5_000);
  expect(await leer(postId, 'tiktok')).toMatchObject({ status: 'programada', attempts: 0 });
});

it('una tarea anticipada no hace nada', async () => {
  const enUnaHora = new Date(Date.now() + 3_600_000);
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: enUnaHora },
    ],
  });
  await encolarDestino(
    db,
    postId,
    { platform: 'tiktok', scheduleVersion: 1, scheduledAt: enUnaHora, attempts: 0 },
    encoladorCloudTasks(),
    new Date(),
  );
  await pausa(5_000);
  expect(await leer(postId, 'tiktok')).toMatchObject({ status: 'programada', attempts: 0, enqueuedVersion: 1 });
});

it('un archivo inexistente deja el destino fallida con error definitivo', async () => {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId: 'no-existe' },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1, scheduledAt: new Date() },
    ],
  });
  await encolarDestino(
    db,
    postId,
    { platform: 'tiktok', scheduleVersion: 1, scheduledAt: new Date(), attempts: 0 },
    encoladorCloudTasks(),
    new Date(),
  );
  const destino = await esperarHasta(
    () => leer(postId, 'tiktok'),
    (d) => d.status === 'fallida',
  );
  expect(destino.lastError).toMatchObject({
    code: 'validacion',
    kind: 'definitivo',
    message: 'El archivo ya no está disponible.',
  });
});

it('el modo api sin conector deja el destino fallida', async () => {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId },
    destinos: [
      {
        platform: 'tiktok',
        format: 'tiktok',
        status: 'programada',
        scheduleVersion: 1,
        scheduledAt: new Date(),
        publishMode: 'api',
      },
    ],
  });
  await encolarDestino(
    db,
    postId,
    { platform: 'tiktok', scheduleVersion: 1, scheduledAt: new Date(), attempts: 0 },
    encoladorCloudTasks(),
    new Date(),
  );
  const destino = await esperarHasta(
    () => leer(postId, 'tiktok'),
    (d) => d.status === 'fallida',
  );
  expect(destino.lastError).toMatchObject({
    code: 'sin_conector',
    message: 'La publicación por API de TikTok aún no está disponible.',
  });
});
