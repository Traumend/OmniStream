import { limpiarRetencionAhora } from '@omnistream/functions/src/publicacion/limpiarRetencion';
import { beforeAll, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, sembrarPublicacion } from '../datos';

const { db, bucket } = adminDemo('limpiarRetencion');
const ahora = new Date();
const hace = (dias: number) => new Date(ahora.getTime() - dias * 86_400_000);
const bytes = Buffer.from([1, 2, 3, 4]);

const existe = async (ruta: string) => (await bucket.file(ruta).exists())[0];
const asset = async (id: string) => (await db.doc(`assets/${id}`).get()).data() ?? {};

async function archivoConObjetos(cambios: Parameters<typeof crearAssetListo>[1] = {}): Promise<string> {
  const id = await crearAssetListo(db, cambios);
  await bucket.file(`originales/${id}`).save(bytes, { contentType: 'video/mp4' });
  await bucket.file(`fotogramas/${id}/start.jpg`).save(bytes, { contentType: 'image/jpeg' });
  return id;
}

async function publicacionCon(assetId: string, status: string, statusChangedAt: Date): Promise<string> {
  const postId = await sembrarPublicacion(db, {
    publicacion: { assetId },
    destinos: [{ platform: 'tiktok', format: 'tiktok', status: status as 'publicada', statusChangedAt }],
  });
  await bucket.file(`derivados/${postId}/tiktok/x.mp4`).save(bytes, { contentType: 'video/mp4' });
  return postId;
}

beforeAll(async () => {
  await db.doc('settings/app').set({ retentionDays: 7 }, { merge: true });
});

it('purga el original y los derivados de un archivo ya publicado y conserva los fotogramas', async () => {
  const id = await archivoConObjetos();
  const postId = await publicacionCon(id, 'publicada', hace(10));
  const { purgados } = await limpiarRetencionAhora({ db, bucket, ahora });
  expect(purgados).toContain(id);
  expect(await existe(`originales/${id}`)).toBe(false);
  expect(await existe(`derivados/${postId}/tiktok/x.mp4`)).toBe(false);
  expect(await existe(`fotogramas/${id}/start.jpg`)).toBe(true);
  const datos = await asset(id);
  expect(datos.status).toBe('purgado');
  expect(datos.purgeAt.toDate()).toEqual(hace(3));
});

it('no purga un archivo con una publicación programada y quita purgeAt', async () => {
  const id = await archivoConObjetos({ purgeAt: hace(1) });
  await publicacionCon(id, 'programada', hace(10));
  const { purgados } = await limpiarRetencionAhora({ db, bucket, ahora });
  expect(purgados).not.toContain(id);
  expect(await existe(`originales/${id}`)).toBe(true);
  const datos = await asset(id);
  expect(datos.status).toBe('listo');
  expect(datos.purgeAt).toBeUndefined();
});

it('purga un archivo sin publicaciones creado hace 31 días', async () => {
  const id = await archivoConObjetos({ createdAt: hace(31) });
  const { purgados } = await limpiarRetencionAhora({ db, bucket, ahora });
  expect(purgados).toContain(id);
  expect(await existe(`originales/${id}`)).toBe(false);
  expect((await asset(id)).status).toBe('purgado');
});

it('respeta retainUntil y lo refleja en purgeAt', async () => {
  const id = await archivoConObjetos({ createdAt: hace(31), retainUntil: hace(-5) });
  const { purgados } = await limpiarRetencionAhora({ db, bucket, ahora });
  expect(purgados).not.toContain(id);
  expect(await existe(`originales/${id}`)).toBe(true);
  const datos = await asset(id);
  expect(datos.status).toBe('listo');
  expect(datos.purgeAt.toDate()).toEqual(hace(-5));
});
