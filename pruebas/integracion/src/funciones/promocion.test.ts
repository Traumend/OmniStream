import { randomUUID } from 'node:crypto';
import {
  CAMPOS_YOUTUBE_POR_DEFECTO,
  crearPromocion,
  PLANTILLA_PROMOCION_POR_DEFECTO,
  type ItemPromocion,
} from '@omnistream/core';
import { guardarPublicacion } from '@omnistream/functions/src/publicacion/acciones/guardar';
import { actualizarPromocion } from '@omnistream/functions/src/publicacion/acciones/promocion';
import { avisarPromocion } from '@omnistream/functions/src/publicacion/encolarPendientes';
import { crearNotificador } from '@omnistream/functions/src/publicacion/notificaciones';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, sembrarPublicacion } from '../datos';
import { esperarHasta, pausa } from '../esperar';

const { db, bucket } = adminDemo('promocion');
const DIA = 86_400_000;
const BASE = new Date('2030-06-10T15:00:00Z');
const en = (dias: number, desde = BASE) => new Date(desde.getTime() + dias * DIA);
const notificar = crearNotificador(db, () => Promise.resolve({ enviados: 0, invalidos: [] }));
const ajustes = db.doc('settings/app');
let assetId: string;
let retencionAnterior: unknown;

beforeAll(async () => {
  assetId = await crearAssetListo(db);
  retencionAnterior = (await ajustes.get()).get('retentionDays');
});

afterAll(async () => {
  await ajustes.set({ retentionDays: retencionAnterior ?? 7 }, { merge: true });
});

const leerItems = async (postId: string): Promise<ItemPromocion[]> =>
  (((await db.doc(`posts/${postId}`).get()).get('promotion.items') ?? []) as Record<string, unknown>[]).map(
    (i) =>
      ({
        ...i,
        dueAt: (i.dueAt as { toDate(): Date } | null)?.toDate() ?? null,
        notifiedAt: (i.notifiedAt as { toDate(): Date } | undefined)?.toDate(),
      }) as ItemPromocion,
  );

async function sembrarPrincipal(items: ItemPromocion[]): Promise<string> {
  return sembrarPublicacion(db, {
    publicacion: { assetId, kind: 'principal', title: 'Largo', scheduledAt: BASE, promotion: { items } },
    destinos: [
      { platform: 'youtube', format: 'video_largo', status: 'programada', scheduleVersion: 1, scheduledAt: BASE },
    ],
  });
}

const ids = () => {
  let n = 0;
  return () => `i${++n}`;
};

it('una Hija publicada cumple el siguiente short del Principal', async () => {
  const principal = await sembrarPrincipal(crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, ids()));
  const hija = await sembrarPublicacion(db, {
    publicacion: { assetId, kind: 'hija', parentId: principal, title: 'Corto' },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'pendiente_manual', parentRef: { status: 'en_espera' } },
    ],
  });
  await db.doc(`posts/${hija}/targets/tiktok`).update({
    status: 'publicada',
    statusChangedAt: new Date(),
    remote: {
      id: '7300000000000000001',
      url: 'https://www.tiktok.com/@c/video/7300000000000000001',
      publishedAt: new Date(),
    },
  });
  const items = await esperarHasta(
    () => leerItems(principal),
    (i) => i[0]?.status === 'hecho',
  );
  expect(items[0]).toMatchObject({ status: 'hecho', hijaId: hija });
  expect(items.slice(1).every((i) => i.status === 'pendiente')).toBe(true);
});

it('mover el Principal recalcula las fechas no editadas', async () => {
  const items = crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, ids());
  items[1] = { ...items[1]!, dueAt: en(20), dueAtEdited: true };
  const principal = await sembrarPrincipal(items);
  const nuevaBase = en(2);
  await db.doc(`posts/${principal}/targets/youtube`).update({ scheduledAt: nuevaBase, scheduleVersion: 2 });
  const recalculados = await esperarHasta(
    () => leerItems(principal),
    (i) => i[0]?.dueAt?.getTime() === en(1, nuevaBase).getTime(),
  );
  expect(recalculados[1]?.dueAt).toEqual(en(20));
  expect(recalculados[4]?.dueAt).toEqual(nuevaBase);
});

it('un pendiente vencido avisa una sola vez', async () => {
  const items = crearPromocion([{ type: 'comunidad', title: `Post ${randomUUID()}`, offsetDays: 0 }], BASE, ids());
  const principal = await sembrarPrincipal(items);
  const ahora = en(1);
  expect(await avisarPromocion(db, notificar, ahora)).toBeGreaterThanOrEqual(1);
  await avisarPromocion(db, notificar, ahora);
  const avisosDelPrincipal = await db
    .collection('notifications')
    .where('enlace', '==', `/publicaciones/${principal}`)
    .get();
  expect(avisosDelPrincipal.docs[0]?.data()).toMatchObject({
    tipo: 'promocion',
    titulo: 'Promoción pendiente',
    enlace: `/publicaciones/${principal}`,
  });
  expect((await leerItems(principal))[0]?.notifiedAt).toEqual(ahora);
  const avisos = await db.collection('notifications').where('enlace', '==', `/publicaciones/${principal}`).get();
  expect(avisos.size).toBe(1);
});

it('con retención 0 el original se purga al publicarse la última red', async () => {
  await ajustes.set({ retentionDays: 0 }, { merge: true });
  const propio = await crearAssetListo(db);
  await bucket.file(`originales/${propio}`).save(Buffer.from('video'));
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId: propio },
    destinos: [
      { platform: 'tiktok', format: 'tiktok', status: 'pendiente_manual' },
      { platform: 'instagram', format: 'reel', status: 'publicada', statusChangedAt: new Date() },
    ],
  });
  await db.doc(`posts/${postId}/targets/tiktok`).update({ status: 'publicada', statusChangedAt: new Date() });
  await esperarHasta(
    async () => (await db.doc(`assets/${propio}`).get()).get('status'),
    (estado) => estado === 'purgado',
  );
  expect((await bucket.file(`originales/${propio}`).exists())[0]).toBe(false);
  await ajustes.set({ retentionDays: 7 }, { merge: true });
});

it('actualizarPromocion conserva el aviso de un item sin cambio de fecha', async () => {
  const items = crearPromocion(PLANTILLA_PROMOCION_POR_DEFECTO, BASE, ids()).map((i, n) =>
    n === 0 ? { ...i, notifiedAt: en(1) } : n === 1 ? { ...i, notifiedAt: en(3) } : i,
  );
  const principal = await sembrarPrincipal(items);
  const enviados = items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    offsetDays: i.offsetDays,
    dueAt: i.dueAt?.toISOString() ?? null,
    dueAtEdited: i.dueAtEdited,
    status: i.status,
  }));
  enviados[1] = { ...enviados[1]!, dueAt: en(8).toISOString(), dueAtEdited: true };
  enviados[2] = { ...enviados[2]!, title: 'Short con el clip del final', status: 'hecho' };
  enviados.push({
    id: 'nuevo',
    type: 'exposicion',
    title: 'Historia de Instagram',
    offsetDays: 1,
    dueAt: null,
    dueAtEdited: false,
    status: 'pendiente',
  });

  await actualizarPromocion(principal, enviados, { db, ahora: new Date(), encolar: async () => {} });

  const guardados = await leerItems(principal);
  expect(guardados).toHaveLength(6);
  expect(guardados[0]).toMatchObject({ dueAt: en(1), notifiedAt: en(1) });
  expect(guardados[1]).toMatchObject({ dueAt: en(8), dueAtEdited: true });
  expect(guardados[1]?.notifiedAt).toBeUndefined();
  expect(guardados[2]).toMatchObject({ title: 'Short con el clip del final', status: 'hecho' });
  expect(guardados[5]).toMatchObject({ id: 'nuevo', dueAt: en(1) });
});

it('actualizarPromocion solo aplica a un Principal', async () => {
  const otra = await sembrarPublicacion(db, { publicacion: { assetId }, destinos: [{ platform: 'tiktok' }] });
  await expect(actualizarPromocion(otra, [], { db, ahora: new Date(), encolar: async () => {} })).rejects.toMatchObject(
    {
      code: 'failed-precondition',
      message: 'Solo un video principal tiene lista de promoción.',
    },
  );
});

it('guardar un Principal nuevo le crea la lista de promoción', async () => {
  const { postId } = await guardarPublicacion(
    {
      title: 'Largo nuevo',
      assetId,
      base: { text: '', hashtags: [] },
      scheduledAt: BASE.toISOString(),
      parentId: null,
      destinos: [{ platform: 'youtube', format: 'video_largo', youtube: CAMPOS_YOUTUBE_POR_DEFECTO }],
    },
    { db, ahora: new Date(), encolar: async () => {} },
  );
  const items = await leerItems(postId as string);
  expect(items.map((i) => [i.title, i.dueAt])).toEqual(
    PLANTILLA_PROMOCION_POR_DEFECTO.map((p) => [p.title, en(p.offsetDays)]),
  );
});

it('un pendiente cuya fecha cambió vuelve a avisar', async () => {
  const items = crearPromocion([{ type: 'exposicion', title: `Expo ${randomUUID()}`, offsetDays: 0 }], BASE, ids());
  const principal = await sembrarPrincipal(items);
  await avisarPromocion(db, notificar, en(1));
  await db.doc(`posts/${principal}/targets/youtube`).update({ scheduledAt: en(2), scheduleVersion: 2 });
  await esperarHasta(
    () => leerItems(principal),
    (i) => i[0]?.notifiedAt === undefined && i[0]?.dueAt?.getTime() === en(2).getTime(),
  );
  await avisarPromocion(db, notificar, en(3));
  const avisos = await db.collection('notifications').where('enlace', '==', `/publicaciones/${principal}`).get();
  expect(avisos.size).toBe(2);
  expect((await leerItems(principal))[0]?.notifiedAt).toEqual(en(3));
});

it('con retención 0 cancelar no borra el original', async () => {
  await ajustes.set({ retentionDays: 0 }, { merge: true });
  const propio = await crearAssetListo(db);
  await bucket.file(`originales/${propio}`).save(Buffer.from('video'));
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId: propio },
    destinos: [{ platform: 'tiktok', format: 'tiktok', status: 'programada', scheduleVersion: 1 }],
  });
  await db.doc(`posts/${postId}/targets/tiktok`).update({ status: 'cancelada', statusChangedAt: new Date() });
  await esperarHasta(
    async () => (await db.doc(`posts/${postId}`).get()).get('targetStatus.tiktok'),
    (estado) => estado === 'cancelada',
  );
  await pausa(2_000);
  // Guardar el original dispara procesarArchivo, que cambia su estado: aquí solo importa que no se purgó.
  expect((await db.doc(`assets/${propio}`).get()).get('status')).not.toBe('purgado');
  expect((await bucket.file(`originales/${propio}`).exists())[0]).toBe(true);
  await ajustes.set({ retentionDays: 7 }, { merge: true });
});
