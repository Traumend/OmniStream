import { randomUUID } from 'node:crypto';
import type { FormatoDestino, Platform } from '@omnistream/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { crearAssetListo, entradaDePrueba, leerDestinoDe } from '../datos';
import { esperarHasta, pausa } from '../esperar';
import { clientePropietario, type Cliente } from '../sesion';

const { db } = adminDemo('alCambiarDestino');
const leer = (postId: string, red: Platform) => leerDestinoDe(db, postId, red);
const leerPost = async (postId: string) => (await db.doc(`posts/${postId}`).get()).data() ?? {};
const URLS: Record<Platform, string> = {
  facebook: 'https://www.facebook.com/reel/123456789',
  instagram: 'https://www.instagram.com/reel/C1a2B3c4D5e/',
  youtube: 'https://youtu.be/dQw4w9WgXcQ',
  tiktok: 'https://www.tiktok.com/@cuenta/video/7300000000000000001',
};

let propietario: Cliente;
let assetVertical: string;
let assetHorizontal: string;
const entrada = (redes: [Platform, FormatoDestino][], assetId = assetVertical) => entradaDePrueba(assetId, redes);
const avisosCon = (filtros: Record<string, string>) =>
  Object.entries(filtros)
    .reduce<FirebaseFirestore.Query>((q, [campo, valor]) => q.where(campo, '==', valor), db.collection('notifications'))
    .get();

async function publicarAhora(
  redes: [Platform, FormatoDestino][],
  cambios: Partial<ReturnType<typeof entrada>> = {},
  assetId = assetVertical,
): Promise<string> {
  const { postId } = await propietario.llamar({
    accion: 'guardar',
    publicacion: { ...entrada(redes, assetId), ...cambios },
  });
  await propietario.llamar({ accion: 'programar', postId, inmediata: true });
  for (const [red] of redes) {
    await esperarHasta(
      () => leer(postId, red),
      (d) => d.status === 'pendiente_manual',
    );
  }
  return postId;
}

const marcar = (postId: string, red: Platform) =>
  propietario.llamar({ accion: 'marcarPublicada', postId, platform: red, url: URLS[red] });

beforeAll(async () => {
  propietario = await clientePropietario();
  assetVertical = await crearAssetListo(db);
  assetHorizontal = await crearAssetListo(db, { width: 1920, height: 1080, aspect: 1.7778, durationSec: 600 });
});

afterAll(async () => {
  await propietario.cerrar();
});

it('un destino que llega a pendiente_manual genera su aviso y actualiza la publicación', async () => {
  const postId = await publicarAhora([['tiktok', 'tiktok']]);
  const avisos = await esperarHasta(
    () => avisosCon({ enlace: `/pendientes/${postId}/tiktok` }),
    (r) => r.size > 0,
  );
  expect(avisos.size).toBe(1);
  expect(avisos.docs[0]?.get('tipo')).toBe('pendiente_manual');
  const post = await esperarHasta(
    () => leerPost(postId),
    (p) => p.targetStatus?.tiktok === 'pendiente_manual',
  );
  expect(post.status).toBe('programada');
});

it('un destino fallido genera aviso de fallo', async () => {
  await db.doc('connections/facebook').set({ authStatus: 'conectada', publishMode: 'api', scopes: ['pages_manage_posts'] });
  try {
    const { postId } = await propietario.llamar({ accion: 'guardar', publicacion: entrada([['facebook', 'reel']]) });
    await propietario.llamar({ accion: 'programar', postId, inmediata: true });
    const avisos = await esperarHasta(
      () => avisosCon({ enlace: `/publicaciones/${postId}` }),
      (r) => r.size > 0,
    );
    expect(avisos.docs[0]?.get('tipo')).toBe('fallo');
    expect((await leerPost(postId)).status).toBe('fallida');
  } finally {
    await db.doc('connections/facebook').delete();
  }
});

it('publicada en las 4 redes deja la publicación publicada', async () => {
  const redes: [Platform, FormatoDestino][] = [
    ['facebook', 'reel'],
    ['instagram', 'reel'],
    ['youtube', 'short'],
    ['tiktok', 'tiktok'],
  ];
  const postId = await publicarAhora(redes);
  for (const [red] of redes) await marcar(postId, red);
  await esperarHasta(
    () => leerPost(postId),
    (p) => p.status === 'publicada',
  );
});

it('una Hija publicada antes que su Principal recibe su referencia al publicarse este', async () => {
  const principal = await publicarAhora([['youtube', 'video_largo']], { title: 'Largo' }, assetHorizontal);
  const tituloHija = `Hija ${randomUUID()}`;
  const hija = await publicarAhora(
    [
      ['instagram', 'reel'],
      ['tiktok', 'tiktok'],
    ],
    { parentId: principal, title: tituloHija },
  );
  await marcar(hija, 'instagram');
  await marcar(hija, 'tiktok');
  await pausa(2_000);
  expect((await leer(hija, 'instagram')).parentRef.status).toBe('en_espera');
  expect((await leer(hija, 'tiktok')).parentRef.status).toBe('publicada');

  await marcar(principal, 'youtube');
  await esperarHasta(
    () => leer(hija, 'instagram'),
    (d) => d.parentRef.status === 'pendiente',
  );
  const avisos = await esperarHasta(
    () => avisosCon({ tipo: 'referencia', cuerpo: `${tituloHija} · Instagram` }),
    (r) => r.size > 0,
  );
  expect(avisos.size).toBe(1);
  expect(avisos.docs[0]?.get('tipo')).toBe('referencia');
  expect((await leer(hija, 'tiktok')).parentRef.status).toBe('publicada');

  await propietario.llamar({ accion: 'marcarReferencia', postId: hija, platform: 'instagram' });
  expect((await leer(hija, 'instagram')).parentRef.status).toBe('publicada');
});

it('una Hija publicada después de su Principal queda con la referencia pendiente', async () => {
  const principal = await publicarAhora([['youtube', 'video_largo']], { title: 'Largo' }, assetHorizontal);
  await marcar(principal, 'youtube');
  const tituloHija = `Hija ${randomUUID()}`;
  const hija = await publicarAhora([['instagram', 'reel']], { parentId: principal, title: tituloHija });
  await marcar(hija, 'instagram');
  await esperarHasta(
    () => leer(hija, 'instagram'),
    (d) => d.parentRef.status === 'pendiente',
  );
  const avisos = await esperarHasta(
    () => avisosCon({ tipo: 'referencia', cuerpo: `${tituloHija} · Instagram` }),
    (r) => r.size > 0,
  );
  expect(avisos.size).toBe(1);
});
