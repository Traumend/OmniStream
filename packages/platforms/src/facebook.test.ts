import type { DestinoEfectivo } from '@omnistream/core';
import { describe, expect, it } from 'vitest';
import { adaptadorFacebook } from './facebook';
import { GRAPH } from './meta';
import { fetchGrabado, type Intercambio } from './prueba/fetchGrabado';
import type { ArchivoFuente, PublishContext, SesionProveedor } from './tipos';

const sesion: SesionProveedor = { accessToken: 'EAAP', datos: { pageId: '111' } };
const archivo: ArchivoFuente = {
  size: 1000,
  mimeType: 'video/mp4',
  urlFirmada: async () => 'https://storage.test/firmada',
  leerRango: async () => new Uint8Array(0),
};
const reel: DestinoEfectivo = {
  platform: 'facebook',
  format: 'reel',
  titulo: 'Mi reel',
  texto: 'Hola #uno',
  etiquetas: [],
};
const ctx = (intercambios: Intercambio[]) => {
  const http = fetchGrabado(intercambios);
  return { http, sesion, archivo, reanudando: false, ahora: () => new Date('2026-10-08T12:00:00Z') } as PublishContext;
};
const ok = (json: unknown) => ({ status: 200, json });
const form = (cuerpo: unknown) => new URLSearchParams(String(cuerpo));

describe('reel', () => {
  it('publica un reel: inicio, subida por URL, finalización y estado', async () => {
    const c = ctx([
      {
        metodo: 'POST',
        url: `${GRAPH}/111/video_reels`,
        revisar: ({ cuerpo }) => expect(form(cuerpo).get('upload_phase')).toBe('start'),
        respuesta: ok({ video_id: 'v1', upload_url: 'https://rupload.facebook.com/video-upload/v26.0/v1' }),
      },
      {
        metodo: 'POST',
        url: 'https://rupload.facebook.com/video-upload/v26.0/v1',
        revisar: ({ headers }) => {
          expect(headers.get('Authorization')).toBe('OAuth EAAP');
          expect(headers.get('file_url')).toBe('https://storage.test/firmada');
        },
        respuesta: ok({ success: true }),
      },
      {
        metodo: 'POST',
        url: `${GRAPH}/111/video_reels`,
        revisar: ({ cuerpo }) => {
          const f = form(cuerpo);
          expect(f.get('upload_phase')).toBe('finish');
          expect(f.get('video_id')).toBe('v1');
          expect(f.get('video_state')).toBe('PUBLISHED');
          expect(f.get('description')).toBe('Hola #uno');
        },
        respuesta: ok({ success: true }),
      },
      {
        metodo: 'GET',
        url: `${GRAPH}/v1?fields=status`,
        respuesta: ok({ status: { video_status: 'ready', publishing_phase: { status: 'published' } } }),
      },
    ]);
    const p1 = await adaptadorFacebook.publishStep(reel, null, c);
    expect(p1).toMatchObject({ kind: 'continue', checkpoint: { stage: 'subir' } });
    const p2 = await adaptadorFacebook.publishStep(reel, p1.kind === 'continue' ? p1.checkpoint : null, c);
    expect(p2).toMatchObject({ kind: 'continue', checkpoint: { stage: 'finalizar' } });
    const p3 = await adaptadorFacebook.publishStep(reel, p2.kind === 'continue' ? p2.checkpoint : null, c);
    expect(p3).toMatchObject({ kind: 'continue', checkpoint: { stage: 'estado' }, delaySec: 30 });
    const p4 = await adaptadorFacebook.publishStep(reel, p3.kind === 'continue' ? p3.checkpoint : null, c);
    expect(p4).toEqual({ kind: 'done', remote: { id: 'v1', url: 'https://www.facebook.com/reel/v1' } });
  });

  it('el estado en proceso espera 30 segundos y a las 60 consultas falla', async () => {
    const enProceso = ok({ status: { video_status: 'processing', publishing_phase: { status: 'not_started' } } });
    const c = ctx([
      { metodo: 'GET', url: `${GRAPH}/v1?fields=status`, respuesta: enProceso },
      { metodo: 'GET', url: `${GRAPH}/v1?fields=status`, respuesta: enProceso },
    ]);
    expect(
      await adaptadorFacebook.publishStep(
        reel,
        { stage: 'estado', data: { videoId: 'v1', tipo: 'reel', consultas: 0 } },
        c,
      ),
    ).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'estado', data: { videoId: 'v1', tipo: 'reel', consultas: 1 } },
      delaySec: 30,
    });
    expect(
      await adaptadorFacebook.publishStep(
        reel,
        { stage: 'estado', data: { videoId: 'v1', tipo: 'reel', consultas: 59 } },
        c,
      ),
    ).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Facebook no terminó de procesar el video.' },
    });
  });

  it('un error de procesamiento es definitivo', async () => {
    const c = ctx([
      { metodo: 'GET', url: `${GRAPH}/v1?fields=status`, respuesta: ok({ status: { video_status: 'error' } }) },
    ]);
    expect(
      await adaptadorFacebook.publishStep(
        reel,
        { stage: 'estado', data: { videoId: 'v1', tipo: 'reel', consultas: 0 } },
        c,
      ),
    ).toMatchObject({ kind: 'error', error: { kind: 'definitivo', message: 'Facebook no pudo procesar el video.' } });
  });

  it('la finalización sin respuesta es ambigua', async () => {
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/111/video_reels`, respuesta: 'sin_respuesta' }]);
    expect(await adaptadorFacebook.publishStep(reel, { stage: 'finalizar', data: { videoId: 'v1' } }, c)).toMatchObject(
      {
        kind: 'error',
        error: { kind: 'ambiguo' },
      },
    );
  });
});

describe('video y foto', () => {
  it('publica un video por file_url en graph-video', async () => {
    const video = { ...reel, format: 'video_largo' as const };
    const c = ctx([
      {
        metodo: 'POST',
        url: 'https://graph-video.facebook.com/v26.0/111/videos',
        revisar: ({ cuerpo }) => {
          const f = form(cuerpo);
          expect(f.get('file_url')).toBe('https://storage.test/firmada');
          expect(f.get('title')).toBe('Mi reel');
          expect(f.get('description')).toBe('Hola #uno');
        },
        respuesta: ok({ id: 'v2' }),
      },
      { metodo: 'GET', url: `${GRAPH}/v2?fields=status`, respuesta: ok({ status: { video_status: 'ready' } }) },
    ]);
    const p1 = await adaptadorFacebook.publishStep(video, null, c);
    expect(p1).toMatchObject({
      kind: 'continue',
      checkpoint: { stage: 'estado', data: { videoId: 'v2', tipo: 'video' } },
    });
    expect(await adaptadorFacebook.publishStep(video, p1.kind === 'continue' ? p1.checkpoint : null, c)).toEqual({
      kind: 'done',
      remote: { id: 'v2', url: 'https://www.facebook.com/111/videos/v2' },
    });
  });

  it('publica una foto con caption y lee su permalink', async () => {
    const foto = { ...reel, format: 'imagen' as const };
    const c = ctx([
      {
        metodo: 'POST',
        url: `${GRAPH}/111/photos`,
        revisar: ({ cuerpo }) => {
          expect(form(cuerpo).get('url')).toBe('https://storage.test/firmada');
          expect(form(cuerpo).get('caption')).toBe('Hola #uno');
        },
        respuesta: ok({ id: 'f1', post_id: '111_9' }),
      },
      {
        metodo: 'GET',
        url: `${GRAPH}/111_9?fields=permalink_url`,
        respuesta: ok({ permalink_url: 'https://www.facebook.com/111/posts/9' }),
      },
    ]);
    const p1 = await adaptadorFacebook.publishStep(foto, null, c);
    expect(p1).toMatchObject({ kind: 'continue', checkpoint: { stage: 'enlace', data: { postId: '111_9' } } });
    expect(await adaptadorFacebook.publishStep(foto, p1.kind === 'continue' ? p1.checkpoint : null, c)).toEqual({
      kind: 'done',
      remote: { id: '111_9', url: 'https://www.facebook.com/111/posts/9' },
    });
  });

  it('la foto sin respuesta es ambigua', async () => {
    const foto = { ...reel, format: 'imagen' as const };
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/111/photos`, respuesta: 'sin_respuesta' }]);
    expect(await adaptadorFacebook.publishStep(foto, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'ambiguo' },
    });
  });
});

describe('lectura', () => {
  it('findExisting compara texto y hora', async () => {
    const lista = ok({ data: [{ id: 'v9', description: ' Hola #uno ', created_time: '2026-10-08T12:05:00+0000' }] });
    const http = fetchGrabado([
      { metodo: 'GET', url: /\/111\/videos\?fields=id%2Cdescription%2Ccreated_time&limit=10$/, respuesta: lista },
      { metodo: 'GET', url: /\/111\/videos/, respuesta: lista },
    ]);
    const ventana = { desde: new Date('2026-10-08T11:30:00Z'), hasta: new Date('2026-10-08T12:30:00Z') };
    expect(await adaptadorFacebook.findExisting(reel, ventana, { http, sesion })).toEqual({
      id: 'v9',
      url: 'https://www.facebook.com/reel/v9',
    });
    expect(await adaptadorFacebook.findExisting({ ...reel, texto: 'Otro' }, ventana, { http, sesion })).toBeNull();
  });

  it('postComment comenta como la página', async () => {
    const http = fetchGrabado([
      {
        metodo: 'POST',
        url: `${GRAPH}/v1/comments`,
        revisar: ({ cuerpo, headers }) => {
          expect(form(cuerpo).get('message')).toBe('Video completo');
          expect(headers.get('Authorization')).toBe('Bearer EAAP');
        },
        respuesta: ok({ id: 'c1' }),
      },
    ]);
    expect(await adaptadorFacebook.postComment('v1', 'Video completo', { http, sesion })).toEqual({ id: 'c1' });
  });
});
