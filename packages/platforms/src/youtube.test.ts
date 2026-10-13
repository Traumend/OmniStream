import { CAMPOS_YOUTUBE_POR_DEFECTO, type DestinoEfectivo } from '@omnistream/core';
import { describe, expect, it } from 'vitest';
import { fetchGrabado, type Intercambio } from './prueba/fetchGrabado';
import type { ArchivoFuente, PublishContext, SesionProveedor } from './tipos';
import { adaptadorYoutube, crearOAuthYoutube, obtenerVideo } from './youtube';

const ahora = new Date('2026-10-08T12:00:00Z');
const TAMANO = 209_715_200; // 200 MiB
const archivo: ArchivoFuente = {
  size: TAMANO,
  mimeType: 'video/mp4',
  urlFirmada: async () => 'https://storage.test/v.mp4',
  leerRango: async (inicio, fin) => new Uint8Array(fin - inicio + 1),
};
const sesion: SesionProveedor = { accessToken: 'ya29', datos: { channelId: 'UC123', uploadsPlaylistId: 'UU123' } };
const destino: DestinoEfectivo = {
  platform: 'youtube',
  format: 'video_largo',
  titulo: 'Mi video',
  texto: 'Descripción',
  etiquetas: ['a'],
  youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, privacy: 'unlisted' },
};
const ctx = (intercambios: Intercambio[], extra: Partial<PublishContext> = {}) => {
  const http = fetchGrabado(intercambios);
  return { http, ctx: { http, sesion, archivo, reanudando: false, ahora: () => ahora, ...extra } as PublishContext };
};
const SUBIDA = 'https://upload.test/sesion';

describe('OAuth', () => {
  const oauth = (intercambios: Intercambio[]) =>
    crearOAuthYoutube({ clientId: 'cid', clientSecret: 'sec', http: fetchGrabado(intercambios), ahora: () => ahora });

  it('construye la URL de autorización con acceso sin conexión y los 4 permisos', () => {
    const url = new URL(
      oauth([]).buildAuthUrl({ state: 's1', redirectUri: 'https://app.test/api/conexiones/retorno' }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('scope')?.split(' ')).toHaveLength(4);
  });

  it('canjea el código y lee el canal', async () => {
    const r = await oauth([
      {
        metodo: 'POST',
        url: 'https://oauth2.googleapis.com/token',
        revisar: ({ cuerpo }) => expect(String(cuerpo)).toContain('grant_type=authorization_code'),
        respuesta: {
          status: 200,
          json: {
            access_token: 'ya29',
            expires_in: 3599,
            refresh_token: '1//r',
            scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly',
          },
        },
      },
      {
        metodo: 'GET',
        url: /\/youtube\/v3\/channels\?part=snippet%2CcontentDetails&mine=true$/,
        respuesta: {
          status: 200,
          json: {
            items: [
              {
                id: 'UC123',
                snippet: {
                  title: 'Canal',
                  customUrl: '@canal',
                  thumbnails: { default: { url: 'https://img.test/a' } },
                },
                contentDetails: { relatedPlaylists: { uploads: 'UU123' } },
              },
            ],
          },
        },
      },
    ]).exchangeCode({ code: 'c', redirectUri: 'https://app.test/r' });
    expect(r.cuentas.youtube).toEqual({
      id: 'UC123',
      name: 'Canal',
      handle: '@canal',
      avatarUrl: 'https://img.test/a',
    });
    expect(r.sesion).toMatchObject({
      accessToken: 'ya29',
      refreshToken: '1//r',
      expiresAt: ahora.getTime() + 3_599_000,
      datos: { channelId: 'UC123', uploadsPlaylistId: 'UU123' },
    });
    expect(r.scopes).toContain('https://www.googleapis.com/auth/youtube.upload');
  });

  const token = { status: 200, json: { access_token: 'ya29', expires_in: 3599, refresh_token: 'r', scope: '' } };
  it('sin canal es error definitivo', async () => {
    await expect(
      oauth([
        { metodo: 'POST', url: 'https://oauth2.googleapis.com/token', respuesta: token },
        { metodo: 'GET', url: /channels/, respuesta: { status: 200, json: { items: [] } } },
      ]).exchangeCode({ code: 'c', redirectUri: 'r' }),
    ).rejects.toMatchObject({ kind: 'definitivo', message: 'Esta cuenta de Google no tiene un canal de YouTube.' });
  });

  it('sin refresh_token es error definitivo', async () => {
    await expect(
      oauth([
        {
          metodo: 'POST',
          url: 'https://oauth2.googleapis.com/token',
          respuesta: { status: 200, json: { access_token: 'ya29', expires_in: 3599, scope: '' } },
        },
      ]).exchangeCode({ code: 'c', redirectUri: 'r' }),
    ).rejects.toMatchObject({
      kind: 'definitivo',
      message: 'Google no entregó un acceso sin conexión. Vuelve a intentarlo.',
    });
  });

  it('renovar con invalid_grant es error de autenticación', async () => {
    await expect(
      oauth([
        {
          metodo: 'POST',
          url: 'https://oauth2.googleapis.com/token',
          respuesta: { status: 400, json: { error: 'invalid_grant' } },
        },
      ]).refresh({ ...sesion, refreshToken: 'r' }),
    ).rejects.toMatchObject({ kind: 'auth', message: 'El acceso a YouTube fue revocado o venció.' });
  });

  it('renovar entrega un nuevo acceso', async () => {
    const s = await oauth([
      {
        metodo: 'POST',
        url: 'https://oauth2.googleapis.com/token',
        respuesta: { status: 200, json: { access_token: 'nuevo', expires_in: 3599 } },
      },
    ]).refresh({ ...sesion, refreshToken: 'r' });
    expect(s).toMatchObject({ accessToken: 'nuevo', refreshToken: 'r', expiresAt: ahora.getTime() + 3_599_000 });
  });
});

describe('publishStep', () => {
  it('inicia la subida reanudable con los metadatos', async () => {
    const { ctx: c } = ctx([
      {
        metodo: 'POST',
        url: 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        revisar: ({ cuerpo, headers }) => {
          expect(JSON.parse(String(cuerpo))).toEqual({
            snippet: { title: 'Mi video', description: 'Descripción', tags: ['a'], categoryId: '22' },
            status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
          });
          expect(headers.get('X-Upload-Content-Length')).toBe(String(TAMANO));
          expect(headers.get('X-Upload-Content-Type')).toBe('video/mp4');
          expect(headers.get('Authorization')).toBe('Bearer ya29');
        },
        respuesta: { status: 200, headers: { location: SUBIDA } },
      },
    ]);
    expect(await adaptadorYoutube.publishStep(destino, null, c)).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 0 } },
    });
  });

  it('sube una parte y continúa con el offset del 308', async () => {
    const { ctx: c } = ctx([
      {
        metodo: 'PUT',
        url: SUBIDA,
        revisar: ({ headers }) => expect(headers.get('Content-Range')).toBe(`bytes 0-67108863/${TAMANO}`),
        respuesta: { status: 308, headers: { range: 'bytes=0-67108863' } },
      },
    ]);
    expect(
      await adaptadorYoutube.publishStep(destino, { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 0 } }, c),
    ).toEqual({ kind: 'continue', checkpoint: { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 67_108_864 } } });
  });

  it('al reanudar consulta cuánto recibió YouTube', async () => {
    const { ctx: c } = ctx(
      [
        {
          metodo: 'PUT',
          url: SUBIDA,
          revisar: ({ headers }) => expect(headers.get('Content-Range')).toBe(`bytes */${TAMANO}`),
          respuesta: { status: 308, headers: { range: 'bytes=0-134217727' } },
        },
        {
          metodo: 'PUT',
          url: SUBIDA,
          revisar: ({ headers }) => expect(headers.get('Content-Range')).toBe(`bytes 134217728-201326591/${TAMANO}`),
          respuesta: { status: 308, headers: { range: 'bytes=0-201326591' } },
        },
      ],
      { reanudando: true },
    );
    const r = await adaptadorYoutube.publishStep(
      destino,
      { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 0 } },
      c,
    );
    expect(r).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 201_326_592 } },
    });
  });

  it('la sesión vencida (404) reinicia la subida', async () => {
    const { ctx: c } = ctx([{ metodo: 'PUT', url: SUBIDA, respuesta: { status: 404 } }], { reanudando: true });
    expect(
      await adaptadorYoutube.publishStep(destino, { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 0 } }, c),
    ).toEqual({ kind: 'continue', checkpoint: { stage: 'inicio', data: {} } });
  });

  it('la última parte sin respuesta es ambigua', async () => {
    const { ctx: c } = ctx([{ metodo: 'PUT', url: SUBIDA, respuesta: 'sin_respuesta' }]);
    const r = await adaptadorYoutube.publishStep(
      destino,
      { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 201_326_592 } },
      c,
    );
    expect(r).toMatchObject({ kind: 'error', error: { kind: 'ambiguo' } });
  });

  it('una parte intermedia sin respuesta es temporal', async () => {
    const { ctx: c } = ctx([{ metodo: 'PUT', url: SUBIDA, respuesta: 'sin_respuesta' }]);
    const r = await adaptadorYoutube.publishStep(
      destino,
      { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 0 } },
      c,
    );
    expect(r).toMatchObject({ kind: 'error', error: { kind: 'temporal' } });
  });

  it('la miniatura que falla no impide terminar', async () => {
    const miniatura: ArchivoFuente = { ...archivo, size: 10, mimeType: 'image/jpeg' };
    const conMiniatura = { ...destino, youtube: { ...destino.youtube!, thumbnail: { frame: 'middle' as const } } };
    const { ctx: c } = ctx(
      [
        { metodo: 'PUT', url: SUBIDA, respuesta: { status: 200, json: { id: 'vid12345678' } } },
        {
          metodo: 'POST',
          url: 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=vid12345678',
          respuesta: { status: 403, json: { error: { errors: [{ reason: 'forbidden' }], message: 'No' } } },
        },
      ],
      { miniatura },
    );
    const paso1 = await adaptadorYoutube.publishStep(
      conMiniatura,
      { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 201_326_592 } },
      c,
    );
    expect(paso1).toEqual({ kind: 'continue', checkpoint: { stage: 'miniatura', data: { videoId: 'vid12345678' } } });
    if (paso1.kind !== 'continue') return;
    expect(await adaptadorYoutube.publishStep(conMiniatura, paso1.checkpoint, c)).toEqual({
      kind: 'done',
      remote: { id: 'vid12345678', url: 'https://youtu.be/vid12345678' },
    });
  });

  it('sin miniatura termina al completar la subida', async () => {
    const { ctx: c } = ctx([{ metodo: 'PUT', url: SUBIDA, respuesta: { status: 201, json: { id: 'vid12345678' } } }]);
    expect(
      await adaptadorYoutube.publishStep(
        destino,
        { stage: 'subiendo', data: { uploadUrl: SUBIDA, offset: 201_326_592 } },
        c,
      ),
    ).toEqual({ kind: 'done', remote: { id: 'vid12345678', url: 'https://youtu.be/vid12345678' } });
  });

  const errorGoogle = (reason: string) => ({
    status: 403,
    json: { error: { errors: [{ reason }], message: `Motivo ${reason}` } },
  });
  it('cuota agotada es temporal', async () => {
    const { ctx: c } = ctx([{ metodo: 'POST', url: /uploadType=resumable/, respuesta: errorGoogle('quotaExceeded') }]);
    expect(await adaptadorYoutube.publishStep(destino, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'temporal' },
    });
  });

  it('límite de subidas es definitivo con el mensaje', async () => {
    const { ctx: c } = ctx([
      { metodo: 'POST', url: /uploadType=resumable/, respuesta: errorGoogle('uploadLimitExceeded') },
    ]);
    expect(await adaptadorYoutube.publishStep(destino, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Tu canal de YouTube alcanzó el límite de subidas del día.' },
    });
  });

  it('otro rechazo es definitivo con el motivo de YouTube', async () => {
    const { ctx: c } = ctx([
      {
        metodo: 'POST',
        url: /uploadType=resumable/,
        respuesta: { status: 400, json: { error: { message: 'Bad title' } } },
      },
    ]);
    expect(await adaptadorYoutube.publishStep(destino, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'YouTube rechazó el video: Bad title' },
    });
  });
});

describe('lectura', () => {
  const lista = {
    status: 200,
    json: {
      items: [
        { snippet: { title: 'Mi video', publishedAt: '2026-10-08T12:00:00Z', resourceId: { videoId: 'abcdefghijk' } } },
      ],
    },
  };
  it('findExisting encuentra por título dentro de la ventana y no fuera de ella', async () => {
    const http = fetchGrabado([
      { metodo: 'GET', url: /playlistItems\?part=snippet&playlistId=UU123&maxResults=10$/, respuesta: lista },
      { metodo: 'GET', url: /playlistItems/, respuesta: lista },
    ]);
    const dentro = { desde: new Date('2026-10-08T11:30:00Z'), hasta: new Date('2026-10-08T12:30:00Z') };
    expect(await adaptadorYoutube.findExisting(destino, dentro, { http, sesion })).toEqual({
      id: 'abcdefghijk',
      url: 'https://youtu.be/abcdefghijk',
    });
    const fuera = { desde: new Date('2026-10-08T13:00:00Z'), hasta: new Date('2026-10-08T14:00:00Z') };
    expect(await adaptadorYoutube.findExisting(destino, fuera, { http, sesion })).toBeNull();
  });

  it('comenta con commentThreads', async () => {
    const http = fetchGrabado([
      {
        metodo: 'POST',
        url: 'https://www.googleapis.com/youtube/v3/commentThreads?part=snippet',
        revisar: ({ cuerpo }) =>
          expect(JSON.parse(String(cuerpo))).toEqual({
            snippet: { videoId: 'abcdefghijk', topLevelComment: { snippet: { textOriginal: 'Hola' } } },
          }),
        respuesta: { status: 200, json: { id: 'cmt1' } },
      },
    ]);
    expect(await adaptadorYoutube.postComment('abcdefghijk', 'Hola', { http, sesion })).toEqual({ id: 'cmt1' });
  });
});

describe('obtenerVideo', () => {
  it('obtenerVideo lee snippet y status', async () => {
    const http = fetchGrabado([
      {
        metodo: 'GET',
        url: 'https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatus&id=abcdefghijk',
        revisar: ({ headers }) => expect(headers.get('authorization')).toBe('Bearer ya29'),
        respuesta: {
          status: 200,
          json: {
            items: [
              {
                id: 'abcdefghijk',
                snippet: {
                  channelId: 'UC123',
                  title: 'La independencia',
                  description: 'Un video largo',
                  publishedAt: '2026-10-01T10:00:00Z',
                },
                status: { privacyStatus: 'private', publishAt: '2026-10-15T17:00:00Z' },
              },
            ],
          },
        },
      },
    ]);
    expect(await obtenerVideo('abcdefghijk', { http, sesion })).toEqual({
      id: 'abcdefghijk',
      channelId: 'UC123',
      title: 'La independencia',
      description: 'Un video largo',
      privacy: 'private',
      publishAt: new Date('2026-10-15T17:00:00Z'),
      publishedAt: new Date('2026-10-01T10:00:00Z'),
    });
  });

  it('un id inexistente devuelve null', async () => {
    const http = fetchGrabado([
      {
        metodo: 'GET',
        url: /videos\?part=snippet%2Cstatus&id=zzzzzzzzzzz$/,
        respuesta: { status: 200, json: { items: [] } },
      },
    ]);
    expect(await obtenerVideo('zzzzzzzzzzz', { http, sesion })).toBeNull();
  });
});
