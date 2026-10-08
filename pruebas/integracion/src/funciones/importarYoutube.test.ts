import { randomBytes } from 'node:crypto';
import { leerConexion } from '@omnistream/core';
import { importarYoutube } from '@omnistream/functions/src/publicacion/acciones/importar';
import type { DependenciasCambio } from '@omnistream/functions/src/publicacion/alCambiarDestino';
import { encolarPendientesAhora } from '@omnistream/functions/src/publicacion/encolarPendientes';
import { PlatformError, type SesionProveedor } from '@omnistream/platforms';
import { fetchGrabado } from '@omnistream/platforms/prueba';
import { expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { leerDestinoDe, sembrarPublicacion } from '../datos';
import { rechazoDe } from '../errores';

const { db } = adminDemo('importarYoutube');
const SESION: SesionProveedor = { accessToken: 'ya29', datos: { channelId: 'UC-propio' } };
const DIA = 86_400_000;

const idVideo = () => randomBytes(8).toString('base64url').slice(0, 11);

function respuestaVideo(id: string, cambios: { channelId?: string; publishAt?: string; publishedAt?: string } = {}) {
  return {
    metodo: 'GET',
    url: `https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatus&id=${id}`,
    respuesta: {
      status: 200,
      json: {
        items: [
          {
            id,
            snippet: {
              channelId: cambios.channelId ?? 'UC-propio',
              title: 'La independencia de México',
              description: 'Un recorrido por 1810.',
              publishedAt: cambios.publishedAt ?? '2026-10-01T10:00:00Z',
            },
            status: { privacyStatus: cambios.publishAt ? 'private' : 'public', publishAt: cambios.publishAt },
          },
        ],
      },
    },
  } as const;
}

function dependencias(intercambios: Parameters<typeof fetchGrabado>[0], ahora = new Date()) {
  return {
    db,
    ahora,
    encolar: async () => {},
    sesion: async () => SESION,
    http: fetchGrabado(intercambios),
  };
}

it('importar un video publicado crea el Principal con su lista de promoción', async () => {
  const id = idVideo();
  const { postId } = await importarYoutube(`https://youtu.be/${id}`, dependencias([respuestaVideo(id)]));

  expect(postId).toBe(`yt-${id}`);
  const post = (await db.doc(`posts/${postId}`).get()).data();
  expect(post).toMatchObject({
    kind: 'principal',
    origin: 'youtube_importado',
    title: 'La independencia de México',
    base: { text: 'Un recorrido por 1810.', hashtags: [] },
  });
  expect(post?.scheduledAt.toDate()).toEqual(new Date('2026-10-01T10:00:00Z'));
  expect(post?.awaitingPublicationUntil).toBeUndefined();
  const items = post?.promotion.items as { title: string; dueAt: { toDate(): Date }; status: string }[];
  expect(items.map((i) => [i.title, i.dueAt.toDate().toISOString(), i.status])).toEqual([
    ['Short 1', '2026-10-02T10:00:00.000Z', 'pendiente'],
    ['Short 2', '2026-10-04T10:00:00.000Z', 'pendiente'],
    ['Short 3', '2026-10-06T10:00:00.000Z', 'pendiente'],
    ['Post en Comunidad', '2026-10-03T10:00:00.000Z', 'pendiente'],
    ['Exposición en medios propios', '2026-10-01T10:00:00.000Z', 'pendiente'],
  ]);
  expect(await leerDestinoDe(db, postId as string, 'youtube')).toMatchObject({
    format: 'video_largo',
    status: 'publicada',
    publishMode: 'manual',
    parentRef: { status: 'no_aplica' },
    remote: { id, url: `https://youtu.be/${id}`, publishedAt: new Date('2026-10-01T10:00:00Z') },
  });
});

it('importar un video programado deja sus Hijas en espera hasta publishAt', async () => {
  const id = idVideo();
  const publishAt = new Date(Date.now() + DIA);
  const { postId } = await importarYoutube(
    `https://www.youtube.com/watch?v=${id}`,
    dependencias([respuestaVideo(id, { publishAt: publishAt.toISOString() })]),
  );
  const principal = postId as string;
  expect((await db.doc(`posts/${principal}`).get()).get('awaitingPublicationUntil').toDate()).toEqual(publishAt);

  const hija = await sembrarPublicacion(db, {
    publicacion: { kind: 'hija', parentId: principal, title: 'Corto' },
    destinos: [
      {
        platform: 'facebook',
        format: 'reel',
        status: 'publicada',
        remote: { id: 'fb1', url: 'https://www.facebook.com/reel/1', publishedAt: new Date() },
        parentRef: { status: 'en_espera' },
      },
    ],
  });

  const avisos: string[] = [];
  const cambio: DependenciasCambio = {
    notificar: async (idAviso) => void avisos.push(idAviso),
    encolarReferencia: async () => {},
    conexion: async (red) => leerConexion(red, undefined),
  };
  const encolar = async () => {};

  await encolarPendientesAhora({ db, encolar, ahora: new Date(publishAt.getTime() - 60_000), cambio });
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('en_espera');

  await encolarPendientesAhora({ db, encolar, ahora: new Date(publishAt.getTime() + 60_000), cambio });
  expect((await leerDestinoDe(db, hija, 'facebook')).parentRef.status).toBe('pendiente');
  // encolarPendientes también avisa la promoción vencida de los Principales: aquí solo cuenta la referencia.
  expect(avisos.filter((id) => id.startsWith('espera-'))).toEqual([`espera-${principal}-${hija}-facebook`]);
  expect((await db.doc(`posts/${principal}`).get()).get('awaitingPublicationUntil')).toBeUndefined();
});

it('importar dos veces el mismo video falla sin duplicar', async () => {
  const id = idVideo();
  await importarYoutube(`https://youtu.be/${id}`, dependencias([respuestaVideo(id)]));
  expect(await rechazoDe(importarYoutube(`https://youtu.be/${id}`, dependencias([respuestaVideo(id)])))).toEqual({
    code: 'already-exists',
    message: 'Ese video ya está en OmniStream.',
  });
  expect((await db.collection(`posts/yt-${id}/targets`).get()).size).toBe(1);
});

it('un video de otro canal se rechaza', async () => {
  const id = idVideo();
  expect(
    await rechazoDe(
      importarYoutube(`https://youtu.be/${id}`, dependencias([respuestaVideo(id, { channelId: 'UC-ajeno' })])),
    ),
  ).toEqual({ code: 'failed-precondition', message: 'El video no pertenece a tu canal conectado.' });
  expect((await db.doc(`posts/yt-${id}`).get()).exists).toBe(false);
});

it('un video inexistente se informa', async () => {
  const id = idVideo();
  const sinVideo = {
    metodo: 'GET',
    url: `https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatus&id=${id}`,
    respuesta: { status: 200, json: { items: [] } },
  };
  expect(await rechazoDe(importarYoutube(`https://youtu.be/${id}`, dependencias([sinVideo])))).toEqual({
    code: 'not-found',
    message: 'No se encontró ese video en YouTube.',
  });
});

it('sin conexión de YouTube pide conectarla', async () => {
  const deps = {
    ...dependencias([]),
    sesion: () => Promise.reject(new PlatformError('auth', 'sin_conexion', 'YouTube no está conectada.')),
  };
  expect(await rechazoDe(importarYoutube(`https://youtu.be/${idVideo()}`, deps))).toEqual({
    code: 'failed-precondition',
    message: 'Conecta YouTube en Ajustes > Conexiones para importar videos.',
  });
});

it('una URL que no es de un video de YouTube se rechaza', async () => {
  expect(await rechazoDe(importarYoutube('https://vimeo.com/123', dependencias([])))).toEqual({
    code: 'invalid-argument',
    message: 'La URL no corresponde a un video de YouTube.',
  });
});
