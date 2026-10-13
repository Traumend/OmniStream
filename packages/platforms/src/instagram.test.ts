import type { DestinoEfectivo } from '@omnistream/core';
import { describe, expect, it } from 'vitest';
import { adaptadorInstagram } from './instagram';
import { GRAPH } from './meta';
import { fetchGrabado, type Intercambio } from './prueba/fetchGrabado';
import type { ArchivoFuente, PublishContext, SesionProveedor } from './tipos';

const sesion: SesionProveedor = { accessToken: 'EAAP', datos: { pageId: '111', igUserId: '222' } };
const archivo: ArchivoFuente = {
  size: 1000,
  mimeType: 'video/mp4',
  urlFirmada: async () => 'https://storage.test/firmada',
  leerRango: async () => new Uint8Array(0),
};
const reel: DestinoEfectivo = {
  platform: 'instagram',
  format: 'reel',
  titulo: 'Mi reel',
  texto: 'Hola',
  etiquetas: [],
};
const ctx = (intercambios: Intercambio[]) =>
  ({ http: fetchGrabado(intercambios), sesion, archivo, reanudando: false, ahora: () => new Date() }) as PublishContext;
const ok = (json: unknown) => ({ status: 200, json });
const form = (cuerpo: unknown) => new URLSearchParams(String(cuerpo));
const errorIg = (subcodigo: number, codigo = 9) => ({
  status: 400,
  json: { error: { code: codigo, error_subcode: subcodigo, message: 'x' } },
});
const procesando = (consultas: number) => ({ stage: 'procesando', data: { contenedor: 'c1', consultas } });

describe('publicación', () => {
  it('publica un reel: contenedor, espera de 60 s, publicación y enlace', async () => {
    const c = ctx([
      {
        metodo: 'POST',
        url: `${GRAPH}/222/media`,
        revisar: ({ cuerpo }) => {
          const f = form(cuerpo);
          expect(f.get('media_type')).toBe('REELS');
          expect(f.get('video_url')).toBe('https://storage.test/firmada');
          expect(f.get('caption')).toBe('Hola');
          expect(f.get('share_to_feed')).toBe('true');
        },
        respuesta: ok({ id: 'c1' }),
      },
      { metodo: 'GET', url: `${GRAPH}/c1?fields=status_code`, respuesta: ok({ status_code: 'FINISHED' }) },
      {
        metodo: 'POST',
        url: `${GRAPH}/222/media_publish`,
        revisar: ({ cuerpo }) => expect(form(cuerpo).get('creation_id')).toBe('c1'),
        respuesta: ok({ id: 'm1' }),
      },
      {
        metodo: 'GET',
        url: `${GRAPH}/m1?fields=permalink`,
        respuesta: ok({ permalink: 'https://www.instagram.com/reel/ABC/' }),
      },
    ]);
    const p1 = await adaptadorInstagram.publishStep(reel, null, c);
    expect(p1).toEqual({ kind: 'continue', checkpoint: procesando(0), delaySec: 60 });
    const p2 = await adaptadorInstagram.publishStep(reel, procesando(0), c);
    expect(p2).toEqual({ kind: 'continue', checkpoint: { stage: 'publicar', data: { contenedor: 'c1' } } });
    const p3 = await adaptadorInstagram.publishStep(reel, p2.kind === 'continue' ? p2.checkpoint : null, c);
    expect(p3).toEqual({ kind: 'continue', checkpoint: { stage: 'enlace', data: { mediaId: 'm1' } } });
    expect(await adaptadorInstagram.publishStep(reel, p3.kind === 'continue' ? p3.checkpoint : null, c)).toEqual({
      kind: 'done',
      remote: { id: 'm1', url: 'https://www.instagram.com/reel/ABC/' },
    });
  });

  it('publica una imagen con image_url', async () => {
    const c = ctx([
      {
        metodo: 'POST',
        url: `${GRAPH}/222/media`,
        revisar: ({ cuerpo }) => {
          expect(form(cuerpo).get('image_url')).toBe('https://storage.test/firmada');
          expect(form(cuerpo).get('media_type')).toBeNull();
        },
        respuesta: ok({ id: 'c1' }),
      },
    ]);
    expect(await adaptadorInstagram.publishStep({ ...reel, format: 'imagen' }, null, c)).toMatchObject({
      kind: 'continue',
      checkpoint: procesando(0),
    });
  });

  it('en proceso vuelve a esperar y a las 30 consultas falla con el mensaje', async () => {
    const c = ctx([
      { metodo: 'GET', url: `${GRAPH}/c1?fields=status_code`, respuesta: ok({ status_code: 'IN_PROGRESS' }) },
      { metodo: 'GET', url: `${GRAPH}/c1?fields=status_code`, respuesta: ok({ status_code: 'IN_PROGRESS' }) },
    ]);
    expect(await adaptadorInstagram.publishStep(reel, procesando(0), c)).toEqual({
      kind: 'continue',
      checkpoint: procesando(1),
      delaySec: 60,
    });
    expect(await adaptadorInstagram.publishStep(reel, procesando(29), c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Instagram no terminó de procesar el archivo.' },
    });
  });

  it('ERROR en el contenedor es definitivo', async () => {
    const c = ctx([{ metodo: 'GET', url: `${GRAPH}/c1?fields=status_code`, respuesta: ok({ status_code: 'ERROR' }) }]);
    expect(await adaptadorInstagram.publishStep(reel, procesando(0), c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Instagram no pudo procesar el archivo.' },
    });
  });

  it('media_publish sin respuesta es ambiguo', async () => {
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/222/media_publish`, respuesta: 'sin_respuesta' }]);
    expect(
      await adaptadorInstagram.publishStep(reel, { stage: 'publicar', data: { contenedor: 'c1' } }, c),
    ).toMatchObject({ kind: 'error', error: { kind: 'ambiguo' } });
  });

  it('el límite de 24 horas es definitivo con el mensaje', async () => {
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/222/media_publish`, respuesta: errorIg(2207042) }]);
    expect(
      await adaptadorInstagram.publishStep(reel, { stage: 'publicar', data: { contenedor: 'c1' } }, c),
    ).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Instagram alcanzó el límite de publicaciones de las últimas 24 horas.' },
    });
  });

  it('2207027 vuelve a esperar', async () => {
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/222/media_publish`, respuesta: errorIg(2207027, 9007) }]);
    expect(await adaptadorInstagram.publishStep(reel, { stage: 'publicar', data: { contenedor: 'c1' } }, c)).toEqual({
      kind: 'continue',
      checkpoint: procesando(0),
      delaySec: 60,
    });
  });

  it.each([
    [2207052, 'temporal', undefined],
    [2207020, 'definitivo', 'El contenedor de Instagram venció. Vuelve a intentarlo.'],
    [2207051, 'definitivo', 'Instagram marcó la publicación como spam.'],
    [2207026, 'definitivo', 'Instagram no admite el formato de este video.'],
    [2207009, 'definitivo', 'Instagram no admite la proporción de esta imagen.'],
  ] as const)('subcódigo %i → %s', async (subcodigo, kind, mensaje) => {
    const c = ctx([{ metodo: 'POST', url: `${GRAPH}/222/media`, respuesta: errorIg(subcodigo) }]);
    const r = await adaptadorInstagram.publishStep(reel, null, c);
    expect(r).toMatchObject({ kind: 'error', error: { kind } });
    if (mensaje) expect(r).toMatchObject({ error: { message: mensaje } });
  });
});

describe('lectura', () => {
  it('findExisting compara caption y hora', async () => {
    const lista = ok({
      data: [
        {
          id: 'm9',
          caption: 'Hola',
          timestamp: '2026-10-08T12:05:00+0000',
          permalink: 'https://www.instagram.com/p/X/',
        },
      ],
    });
    const http = fetchGrabado([
      { metodo: 'GET', url: /\/222\/media\?fields=id%2Ccaption%2Ctimestamp%2Cpermalink&limit=10$/, respuesta: lista },
      { metodo: 'GET', url: /\/222\/media/, respuesta: lista },
    ]);
    const dentro = { desde: new Date('2026-10-08T11:30:00Z'), hasta: new Date('2026-10-08T12:30:00Z') };
    expect(await adaptadorInstagram.findExisting(reel, dentro, { http, sesion })).toEqual({
      id: 'm9',
      url: 'https://www.instagram.com/p/X/',
    });
    const fuera = { desde: new Date('2026-10-08T14:00:00Z'), hasta: new Date('2026-10-08T15:00:00Z') };
    expect(await adaptadorInstagram.findExisting(reel, fuera, { http, sesion })).toBeNull();
  });

  it('comenta en el medio', async () => {
    const http = fetchGrabado([
      {
        metodo: 'POST',
        url: `${GRAPH}/m1/comments`,
        revisar: ({ cuerpo }) => expect(form(cuerpo).get('message')).toBe('Video completo'),
        respuesta: ok({ id: 'k1' }),
      },
    ]);
    expect(await adaptadorInstagram.postComment('m1', 'Video completo', { http, sesion })).toEqual({ id: 'k1' });
  });
});
