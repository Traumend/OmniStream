import { CAMPOS_TIKTOK_POR_DEFECTO, type DestinoEfectivo } from '@omnistream/core';
import { describe, expect, it } from 'vitest';
import { fetchGrabado, type Intercambio } from './prueba/fetchGrabado';
import { adaptadorTiktok, clasificarTiktok, consultarCreador, crearOAuthTiktok } from './tiktok';
import type { ArchivoFuente, PublishContext, SesionProveedor } from './tipos';

const ahora = new Date('2026-10-08T12:00:00Z');
const API = 'https://open.tiktokapis.com/v2';
const sesion: SesionProveedor = { accessToken: 'act.1', datos: { openId: 'o1', username: 'cuenta' } };
const TAMANO = 100_000_000;
const archivo: ArchivoFuente = {
  size: TAMANO,
  mimeType: 'video/mp4',
  urlFirmada: async () => 'https://storage.test/firmada',
  leerRango: async (inicio, fin) => new Uint8Array(fin - inicio + 1),
};
const video: DestinoEfectivo = {
  platform: 'tiktok',
  format: 'tiktok',
  titulo: 'Mi corto',
  texto: 'Hola #uno',
  etiquetas: [],
  duracionSeg: 30,
  tiktok: {
    ...CAMPOS_TIKTOK_POR_DEFECTO,
    privacy: 'SELF_ONLY',
    allowComments: true,
    commercial: { enabled: true, yourBrand: true, brandedContent: false },
  },
};
const ok = (data: unknown) => ({ status: 200, json: { data, error: { code: 'ok', message: '' } } });
const errorTt = (code: string, status = 400) => ({ status, json: { error: { code, message: `m ${code}` } } });
const ctx = (intercambios: Intercambio[], extra: Partial<PublishContext> = {}) =>
  ({
    http: fetchGrabado(intercambios),
    sesion,
    archivo,
    reanudando: false,
    ahora: () => ahora,
    ...extra,
  }) as PublishContext;
const creador = {
  creator_nickname: 'Mi nombre',
  creator_username: 'cuenta',
  creator_avatar_url: 'https://img.test/a',
  privacy_level_options: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY', 'OTRA'],
  comment_disabled: false,
  duet_disabled: true,
  stitch_disabled: false,
  max_video_post_duration_sec: 600,
};
const consultaCreador: Intercambio = {
  metodo: 'POST',
  url: `${API}/post/publish/creator_info/query/`,
  respuesta: ok(creador),
};

describe('OAuth de TikTok', () => {
  const oauth = (intercambios: Intercambio[]) =>
    crearOAuthTiktok({ clientKey: 'ck', clientSecret: 'cs', http: fetchGrabado(intercambios), ahora: () => ahora });
  const token = {
    status: 200,
    json: {
      open_id: 'o1',
      scope: 'user.info.basic,video.publish',
      access_token: 'act.1',
      expires_in: 86400,
      refresh_token: 'rft.1',
      refresh_expires_in: 31536000,
      token_type: 'Bearer',
    },
  };

  it('la URL de autorización lleva los 4 permisos separados por coma y el state', () => {
    const url = new URL(
      oauth([]).buildAuthUrl({ state: 's1', redirectUri: 'https://app.test/api/conexiones/retorno' }),
    );
    expect(url.origin + url.pathname).toBe('https://www.tiktok.com/v2/auth/authorize/');
    expect(url.searchParams.get('client_key')).toBe('ck');
    expect(url.searchParams.get('scope')).toBe('user.info.basic,user.info.profile,video.publish,video.list');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('canjea el código y lee el usuario', async () => {
    const r = await oauth([
      {
        metodo: 'POST',
        url: `${API}/oauth/token/`,
        revisar: ({ cuerpo }) => {
          const f = new URLSearchParams(String(cuerpo));
          expect(f.get('grant_type')).toBe('authorization_code');
          expect(f.get('client_key')).toBe('ck');
        },
        respuesta: token,
      },
      {
        metodo: 'GET',
        url: `${API}/user/info/?fields=open_id%2Cdisplay_name%2Cusername%2Cavatar_url`,
        respuesta: ok({
          user: { open_id: 'o1', display_name: 'Mi nombre', username: 'cuenta', avatar_url: 'https://img.test/a' },
        }),
      },
    ]).exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(r.sesion).toEqual({
      accessToken: 'act.1',
      refreshToken: 'rft.1',
      expiresAt: ahora.getTime() + 86_400_000,
      refreshExpiresAt: ahora.getTime() + 31_536_000_000,
      datos: { openId: 'o1', username: 'cuenta' },
    });
    expect(r.scopes).toEqual(['user.info.basic', 'video.publish']);
    expect(r.cuentas.tiktok).toEqual({
      id: 'o1',
      name: 'Mi nombre',
      handle: 'cuenta',
      avatarUrl: 'https://img.test/a',
    });
  });

  it('renovar guarda el nuevo refresh_token', async () => {
    const s = await oauth([
      {
        metodo: 'POST',
        url: `${API}/oauth/token/`,
        revisar: ({ cuerpo }) => expect(new URLSearchParams(String(cuerpo)).get('refresh_token')).toBe('rft.viejo'),
        respuesta: { ...token, json: { ...token.json, access_token: 'act.2', refresh_token: 'rft.2' } },
      },
    ]).refresh({ ...sesion, refreshToken: 'rft.viejo' });
    expect(s).toMatchObject({ accessToken: 'act.2', refreshToken: 'rft.2', datos: sesion.datos });
  });

  it('renovar con error es de autenticación', async () => {
    await expect(
      oauth([
        {
          metodo: 'POST',
          url: `${API}/oauth/token/`,
          respuesta: { status: 400, json: { error: 'invalid_grant', error_description: 'x' } },
        },
      ]).refresh({ ...sesion, refreshToken: 'r' }),
    ).rejects.toMatchObject({ kind: 'auth', message: 'El acceso a TikTok venció. Vuelve a conectarla.' });
  });
});

describe('creador', () => {
  it('consultarCreador mapea los campos', async () => {
    expect(await consultarCreador({ http: fetchGrabado([consultaCreador]), sesion })).toEqual({
      nickname: 'Mi nombre',
      username: 'cuenta',
      avatarUrl: 'https://img.test/a',
      privacidades: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      comentariosDesactivados: false,
      duetDesactivado: true,
      stitchDesactivado: false,
      duracionMaximaSeg: 600,
    });
  });

  it('la privacidad que ya no existe es definitiva', async () => {
    const c = ctx([consultaCreador]);
    const sinOpcion = { ...video, tiktok: { ...video.tiktok!, privacy: 'MUTUAL_FOLLOW_FRIENDS' as const } };
    expect(await adaptadorTiktok.publishStep(sinOpcion, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'La privacidad elegida ya no está disponible en tu cuenta de TikTok.' },
    });
  });

  it('el video más largo que el máximo de la cuenta es definitivo', async () => {
    const c = ctx([consultaCreador]);
    expect(await adaptadorTiktok.publishStep({ ...video, duracionSeg: 601 }, null, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'Tu cuenta de TikTok admite videos de hasta 10:00.' },
    });
  });

  it('con la cuenta en orden pasa a inicio', async () => {
    expect(await adaptadorTiktok.publishStep(video, null, ctx([consultaCreador]))).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'inicio', data: {} },
    });
  });
});

describe('video', () => {
  it('inicia el video con post_info y la partición', async () => {
    const c = ctx([
      {
        metodo: 'POST',
        url: `${API}/post/publish/video/init/`,
        revisar: ({ cuerpo, headers }) => {
          expect(headers.get('Authorization')).toBe('Bearer act.1');
          expect(JSON.parse(String(cuerpo))).toEqual({
            post_info: {
              title: 'Hola #uno',
              privacy_level: 'SELF_ONLY',
              disable_comment: false,
              disable_duet: true,
              disable_stitch: true,
              brand_content_toggle: false,
              brand_organic_toggle: true,
            },
            source_info: { source: 'FILE_UPLOAD', video_size: TAMANO, chunk_size: 33_554_432, total_chunk_count: 2 },
          });
        },
        respuesta: ok({ publish_id: 'pub1', upload_url: 'https://upload.tiktok.test/u' }),
      },
    ]);
    expect(await adaptadorTiktok.publishStep(video, { stage: 'inicio', data: {} }, c)).toEqual({
      kind: 'continue',
      checkpoint: {
        stage: 'subiendo',
        data: { publishId: 'pub1', uploadUrl: 'https://upload.tiktok.test/u', parte: 0 },
      },
    });
  });

  it('sube las partes en orden con Content-Range', async () => {
    const c = ctx([
      {
        metodo: 'PUT',
        url: 'https://upload.tiktok.test/u',
        revisar: ({ headers }) => {
          expect(headers.get('Content-Range')).toBe(`bytes 0-33554431/${TAMANO}`);
          expect(headers.get('Content-Type')).toBe('video/mp4');
        },
        respuesta: { status: 206 },
      },
      {
        metodo: 'PUT',
        url: 'https://upload.tiktok.test/u',
        revisar: ({ headers }) => expect(headers.get('Content-Range')).toBe(`bytes 33554432-99999999/${TAMANO}`),
        respuesta: { status: 201 },
      },
    ]);
    const datos = { publishId: 'pub1', uploadUrl: 'https://upload.tiktok.test/u' };
    expect(await adaptadorTiktok.publishStep(video, { stage: 'subiendo', data: { ...datos, parte: 0 } }, c)).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'subiendo', data: { ...datos, parte: 1 } },
    });
    expect(await adaptadorTiktok.publishStep(video, { stage: 'subiendo', data: { ...datos, parte: 1 } }, c)).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'estado', data: { publishId: 'pub1', consultas: 0 } },
      delaySec: 10,
    });
  });

  it('la URL de subida vencida reinicia desde inicio', async () => {
    const c = ctx([{ metodo: 'PUT', url: 'https://upload.tiktok.test/u', respuesta: { status: 403 } }]);
    expect(
      await adaptadorTiktok.publishStep(
        video,
        { stage: 'subiendo', data: { publishId: 'pub1', uploadUrl: 'https://upload.tiktok.test/u', parte: 1 } },
        c,
      ),
    ).toEqual({ kind: 'continue', checkpoint: { stage: 'inicio', data: {} } });
  });

  const estado = (data: object) => ({ metodo: 'POST', url: `${API}/post/publish/status/fetch/`, respuesta: ok(data) });
  const enEstado = { stage: 'estado', data: { publishId: 'pub1', consultas: 0 } };
  it('PUBLISH_COMPLETE con id público arma la URL del video', async () => {
    // Respuesta real: el id es un entero de 64 bits sin comillas.
    const crudo =
      '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7300000000000000001]},"error":{"code":"ok"}}';
    const c = ctx([
      { metodo: 'POST', url: `${API}/post/publish/status/fetch/`, respuesta: { status: 200, texto: crudo } },
    ]);
    expect(await adaptadorTiktok.publishStep(video, enEstado, c)).toEqual({
      kind: 'done',
      remote: { id: '7300000000000000001', url: 'https://www.tiktok.com/@cuenta/video/7300000000000000001' },
    });
  });

  it('sin id público usa el perfil', async () => {
    const c = ctx([estado({ status: 'PUBLISH_COMPLETE' })]);
    expect(await adaptadorTiktok.publishStep(video, enEstado, c)).toEqual({
      kind: 'done',
      remote: { id: 'pub1', url: 'https://www.tiktok.com/@cuenta' },
    });
  });

  it('en proceso espera 10 segundos', async () => {
    const c = ctx([estado({ status: 'PROCESSING_UPLOAD' })]);
    expect(await adaptadorTiktok.publishStep(video, enEstado, c)).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'estado', data: { publishId: 'pub1', consultas: 1 } },
      delaySec: 10,
    });
  });

  it('FAILED es definitivo con fail_reason', async () => {
    const c = ctx([estado({ status: 'FAILED', fail_reason: 'video_pull_failed' })]);
    expect(await adaptadorTiktok.publishStep(video, enEstado, c)).toMatchObject({
      kind: 'error',
      error: { kind: 'definitivo', message: 'TikTok no publicó el contenido: video_pull_failed' },
    });
  });
});

describe('foto', () => {
  it('publica una foto por PULL_FROM_URL con urlMedia', async () => {
    const foto: DestinoEfectivo = { ...video, format: 'imagen', titulo: 'x'.repeat(100) };
    const c = ctx(
      [
        {
          metodo: 'POST',
          url: `${API}/post/publish/content/init/`,
          revisar: ({ cuerpo }) => {
            const j = JSON.parse(String(cuerpo));
            expect(j.post_info.title).toHaveLength(90);
            expect(j.post_info.description).toBe('Hola #uno');
            expect(j.source_info).toEqual({
              source: 'PULL_FROM_URL',
              photo_images: ['https://app.test/api/media/tok'],
              photo_cover_index: 0,
            });
            expect(j.post_mode).toBe('DIRECT_POST');
            expect(j.media_type).toBe('PHOTO');
          },
          respuesta: ok({ publish_id: 'pub2' }),
        },
      ],
      { urlMedia: async () => 'https://app.test/api/media/tok' },
    );
    expect(await adaptadorTiktok.publishStep(foto, { stage: 'inicio', data: {} }, c)).toEqual({
      kind: 'continue',
      checkpoint: { stage: 'estado', data: { publishId: 'pub2', consultas: 0 } },
      delaySec: 10,
    });
  });
});

describe('errores y lectura', () => {
  it.each([
    ['access_token_invalid', 'auth', undefined],
    ['scope_not_authorized', 'auth', undefined],
    ['rate_limit_exceeded', 'temporal', undefined],
    ['spam_risk_too_many_posts', 'definitivo', 'TikTok alcanzó el límite de publicaciones del día para esta cuenta.'],
    [
      'unaudited_client_can_only_post_to_private_accounts',
      'definitivo',
      'Mientras TikTok no apruebe la app, solo se puede publicar en cuentas privadas.',
    ],
    ['url_ownership_unverified', 'definitivo', 'TikTok no verificó el dominio de las fotos.'],
    ['privacy_level_option_mismatch', 'definitivo', 'La privacidad elegida no está disponible en tu cuenta de TikTok.'],
    ['otra_cosa', 'definitivo', 'TikTok rechazó la publicación: m otra_cosa'],
  ] as const)('clasificarTiktok traduce %s', (code, kind, mensaje) => {
    const r = errorTt(code);
    const e = clasificarTiktok({ status: r.status, headers: new Headers(), json: r.json, texto: '' });
    expect(e?.kind).toBe(kind);
    if (mensaje) expect(e?.message).toBe(mensaje);
  });

  it('ok no es error', () => {
    expect(clasificarTiktok({ status: 200, headers: new Headers(), json: ok({}).json, texto: '' })).toBeNull();
  });

  it('findExisting compara la descripción y la hora', async () => {
    const lista = ok({
      videos: [
        {
          id: '7300000000000000009',
          video_description: 'Hola #uno',
          create_time: Date.parse('2026-10-08T12:05:00Z') / 1000,
          share_url: 'https://www.tiktok.com/@cuenta/video/7300000000000000009',
        },
      ],
    });
    const http = fetchGrabado([
      {
        metodo: 'POST',
        url: `${API}/video/list/?fields=id%2Ctitle%2Cvideo_description%2Ccreate_time%2Cshare_url`,
        respuesta: lista,
      },
      { metodo: 'POST', url: /video\/list/, respuesta: lista },
    ]);
    const dentro = { desde: new Date('2026-10-08T11:30:00Z'), hasta: new Date('2026-10-08T12:30:00Z') };
    expect(await adaptadorTiktok.findExisting(video, dentro, { http, sesion })).toEqual({
      id: '7300000000000000009',
      url: 'https://www.tiktok.com/@cuenta/video/7300000000000000009',
    });
    expect(await adaptadorTiktok.findExisting({ ...video, texto: 'Otro' }, dentro, { http, sesion })).toBeNull();
  });

  it('postComment no está disponible', async () => {
    await expect(adaptadorTiktok.postComment('1', 'x', { http: fetchGrabado([]), sesion })).rejects.toMatchObject({
      kind: 'definitivo',
      message: 'TikTok no permite publicar comentarios por API.',
    });
  });
});
