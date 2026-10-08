import {
  formatearDuracion,
  PRIVACIDADES_TIKTOK,
  type DestinoEfectivo,
  type InfoCreadorTiktok,
  type PrivacidadTiktok,
} from '@omnistream/core';
import { esPlatformError, PlatformError } from './errores';
import { solicitar, type Http, type RespuestaHttp } from './http';
import { particionTiktok, rangoDeParte } from './particion';
import type {
  Checkpoint,
  ContextoLectura,
  OAuthProvider,
  PlatformAdapter,
  PublishContext,
  SesionProveedor,
  StepResult,
} from './tipos';

const API = 'https://open.tiktokapis.com/v2';
const RED = 'TikTok';
const ESPERA_SEG = 10;
const MAX_CONSULTAS = 180;

export const ALCANCES_TIKTOK = ['user.info.basic', 'user.info.profile', 'video.publish', 'video.list'] as const;

const AUTENTICACION = new Set(['access_token_invalid', 'scope_not_authorized', 'scope_permission_missed']);
const TEMPORALES = new Set(['rate_limit_exceeded', 'internal_error']);
const MENSAJES: Record<string, string> = {
  spam_risk_too_many_posts: 'TikTok alcanzó el límite de publicaciones del día para esta cuenta.',
  spam_risk_too_many_pending_share:
    'TikTok tiene demasiadas publicaciones pendientes en esta cuenta. Espera a que terminen.',
  unaudited_client_can_only_post_to_private_accounts:
    'Mientras TikTok no apruebe la app, solo se puede publicar en cuentas privadas.',
  url_ownership_unverified: 'TikTok no verificó el dominio de las fotos.',
  privacy_level_option_mismatch: 'La privacidad elegida no está disponible en tu cuenta de TikTok.',
};

export function clasificarTiktok(r: RespuestaHttp): PlatformError | null {
  const error = (r.json as { error?: { code?: string; message?: string } } | null)?.error;
  if (!error || typeof error !== 'object' || !error.code || error.code === 'ok') return null;
  const code = error.code;
  if (AUTENTICACION.has(code))
    return new PlatformError('auth', code, 'El acceso a TikTok venció o le faltan permisos. Vuelve a conectarla.');
  if (TEMPORALES.has(code))
    return new PlatformError('temporal', code, 'TikTok está limitando las solicitudes. Se reintentará.');
  const mensaje = MENSAJES[code];
  return new PlatformError('definitivo', code, mensaje ?? `TikTok rechazó la publicación: ${error.message ?? code}`);
}

// El endpoint de tokens responde { error, error_description } (formato OAuth), no el de la API.
function clasificarToken(r: RespuestaHttp): PlatformError | null {
  const error = (r.json as { error?: unknown } | null)?.error;
  if (typeof error === 'string' && error) {
    return new PlatformError('auth', error, 'El acceso a TikTok venció. Vuelve a conectarla.');
  }
  return r.status >= 400
    ? new PlatformError('auth', `http_${r.status}`, 'El acceso a TikTok venció. Vuelve a conectarla.')
    : null;
}

const portador = (sesion: SesionProveedor) => ({ Authorization: `Bearer ${sesion.accessToken}` });
const datos = <T>(r: RespuestaHttp) => ((r.json as { data?: T } | null)?.data ?? {}) as T;

async function api<T>(
  http: Http,
  sesion: SesionProveedor,
  ruta: string,
  cuerpo: unknown,
  opciones: { final?: boolean } = {},
): Promise<T> {
  const r = await solicitar(
    http,
    `${API}/${ruta}`,
    {
      method: 'POST',
      headers: { ...portador(sesion), 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(cuerpo),
    },
    { red: RED, clasificar: clasificarTiktok, ...opciones },
  );
  return datos<T>(r);
}

interface RespuestaToken {
  open_id?: string;
  scope?: string;
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_expires_in?: number;
}

export function crearOAuthTiktok(cfg: {
  clientKey: string;
  clientSecret: string;
  http: Http;
  ahora?: () => Date;
}): OAuthProvider {
  const ahora = cfg.ahora ?? (() => new Date());
  const pedirToken = async (parametros: Record<string, string>): Promise<RespuestaToken> => {
    const r = await solicitar(
      cfg.http,
      `${API}/oauth/token/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: cfg.clientKey,
          client_secret: cfg.clientSecret,
          ...parametros,
        }).toString(),
      },
      { red: RED, clasificar: clasificarToken },
    );
    return r.json as RespuestaToken;
  };
  const sesionDe = (t: RespuestaToken, anterior?: SesionProveedor): SesionProveedor => {
    if (!t.access_token)
      throw new PlatformError('auth', 'sin_token', 'El acceso a TikTok venció. Vuelve a conectarla.');
    const sesion: SesionProveedor = {
      ...anterior,
      accessToken: t.access_token,
      datos: { ...anterior?.datos },
    };
    const base = ahora().getTime();
    if (t.refresh_token) sesion.refreshToken = t.refresh_token;
    if (t.expires_in) sesion.expiresAt = base + t.expires_in * 1000;
    if (t.refresh_expires_in) sesion.refreshExpiresAt = base + t.refresh_expires_in * 1000;
    return sesion;
  };

  return {
    proveedor: 'tiktok',
    buildAuthUrl({ state, redirectUri }) {
      const parametros = new URLSearchParams({
        client_key: cfg.clientKey,
        scope: ALCANCES_TIKTOK.join(','),
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
      });
      return `https://www.tiktok.com/v2/auth/authorize/?${parametros.toString()}`;
    },
    async exchangeCode({ code, redirectUri }) {
      const token = await pedirToken({ code, grant_type: 'authorization_code', redirect_uri: redirectUri });
      const sesion = sesionDe(token);
      const r = await solicitar(
        cfg.http,
        `${API}/user/info/?${new URLSearchParams({ fields: 'open_id,display_name,username,avatar_url' }).toString()}`,
        { method: 'GET', headers: portador(sesion) },
        { red: RED, clasificar: clasificarTiktok },
      );
      const usuario =
        datos<{ user?: { open_id?: string; display_name?: string; username?: string; avatar_url?: string } }>(r).user ??
        {};
      const openId = usuario.open_id ?? token.open_id ?? '';
      sesion.datos = { openId, username: usuario.username ?? '' };
      const cuenta: { id: string; name: string; handle?: string; avatarUrl?: string } = {
        id: openId,
        name: usuario.display_name ?? usuario.username ?? openId,
      };
      if (usuario.username) cuenta.handle = usuario.username;
      if (usuario.avatar_url) cuenta.avatarUrl = usuario.avatar_url;
      return { sesion, scopes: (token.scope ?? '').split(',').filter(Boolean), cuentas: { tiktok: cuenta } };
    },
    // TikTok puede rotar el token de actualización: la sesión nueva lo reemplaza.
    async refresh(sesion) {
      if (!sesion.refreshToken)
        throw new PlatformError('auth', 'sin_refresh', 'El acceso a TikTok venció. Vuelve a conectarla.');
      return sesionDe(await pedirToken({ grant_type: 'refresh_token', refresh_token: sesion.refreshToken }), sesion);
    },
  };
}

interface RespuestaCreador {
  creator_nickname?: string;
  creator_username?: string;
  creator_avatar_url?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
}

export async function consultarCreador(ctx: ContextoLectura): Promise<InfoCreadorTiktok> {
  const c = await api<RespuestaCreador>(ctx.http, ctx.sesion, 'post/publish/creator_info/query/', {});
  const info: InfoCreadorTiktok = {
    nickname: c.creator_nickname ?? '',
    username: c.creator_username ?? '',
    privacidades: (c.privacy_level_options ?? []).filter((p): p is PrivacidadTiktok =>
      (PRIVACIDADES_TIKTOK as readonly string[]).includes(p),
    ),
    comentariosDesactivados: c.comment_disabled === true,
    duetDesactivado: c.duet_disabled === true,
    stitchDesactivado: c.stitch_disabled === true,
    duracionMaximaSeg: c.max_video_post_duration_sec ?? 0,
  };
  if (c.creator_avatar_url) info.avatarUrl = c.creator_avatar_url;
  return info;
}

const continuar = (stage: string, data: Record<string, unknown>, delaySec?: number): StepResult => ({
  kind: 'continue',
  checkpoint: { stage, data },
  ...(delaySec ? { delaySec } : {}),
});

async function revisarCreador(target: DestinoEfectivo, ctx: PublishContext): Promise<StepResult> {
  const info = await consultarCreador(ctx);
  const privacidad = target.tiktok?.privacy;
  if (!privacidad || !info.privacidades.includes(privacidad))
    throw new PlatformError(
      'definitivo',
      'privacidad',
      'La privacidad elegida ya no está disponible en tu cuenta de TikTok.',
    );
  if (
    target.format !== 'imagen' &&
    target.duracionSeg !== undefined &&
    info.duracionMaximaSeg > 0 &&
    target.duracionSeg > info.duracionMaximaSeg
  )
    throw new PlatformError(
      'definitivo',
      'duracion',
      `Tu cuenta de TikTok admite videos de hasta ${formatearDuracion(info.duracionMaximaSeg)}.`,
    );
  return continuar('inicio', {});
}

function infoPublicacion(target: DestinoEfectivo) {
  const t = target.tiktok;
  const comercial = t?.commercial;
  return {
    privacy_level: t?.privacy ?? 'SELF_ONLY',
    disable_comment: !(t?.allowComments ?? false),
    brand_content_toggle: Boolean(comercial?.enabled && comercial.brandedContent),
    brand_organic_toggle: Boolean(comercial?.enabled && comercial.yourBrand),
  };
}

async function iniciar(target: DestinoEfectivo, ctx: PublishContext): Promise<StepResult> {
  const base = infoPublicacion(target);
  if (target.format === 'imagen') {
    const url = ctx.urlMedia ? await ctx.urlMedia() : await ctx.archivo.urlFirmada();
    const r = await api<{ publish_id?: string }>(ctx.http, ctx.sesion, 'post/publish/content/init/', {
      post_info: {
        title: target.titulo.slice(0, 90),
        description: target.texto,
        privacy_level: base.privacy_level,
        disable_comment: base.disable_comment,
        brand_content_toggle: base.brand_content_toggle,
        brand_organic_toggle: base.brand_organic_toggle,
      },
      source_info: { source: 'PULL_FROM_URL', photo_images: [url], photo_cover_index: 0 },
      post_mode: 'DIRECT_POST',
      media_type: 'PHOTO',
    });
    return continuar('estado', { publishId: r.publish_id ?? '', consultas: 0 }, ESPERA_SEG);
  }
  const particion = particionTiktok(ctx.archivo.size);
  const t = target.tiktok;
  const r = await api<{ publish_id?: string; upload_url?: string }>(ctx.http, ctx.sesion, 'post/publish/video/init/', {
    post_info: {
      title: target.texto,
      privacy_level: base.privacy_level,
      disable_comment: base.disable_comment,
      disable_duet: !(t?.allowDuet ?? false),
      disable_stitch: !(t?.allowStitch ?? false),
      brand_content_toggle: base.brand_content_toggle,
      brand_organic_toggle: base.brand_organic_toggle,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: ctx.archivo.size,
      chunk_size: particion.chunkSize,
      total_chunk_count: particion.total,
    },
  });
  if (!r.publish_id || !r.upload_url) throw new PlatformError('temporal', 'sin_subida', 'TikTok no inició la subida.');
  return continuar('subiendo', { publishId: r.publish_id, uploadUrl: r.upload_url, parte: 0 });
}

async function subir(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const { size, mimeType } = ctx.archivo;
  const particion = particionTiktok(size);
  const parte = Number(data.parte ?? 0);
  const { inicio, fin } = rangoDeParte(parte, size, particion);
  const r = await solicitar(
    ctx.http,
    String(data.uploadUrl),
    {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Range': `bytes ${inicio}-${fin}/${size}` },
      body: await ctx.archivo.leerRango(inicio, fin),
    },
    { red: RED, clasificar: () => null, aceptar: [403, 416], timeoutMs: 10 * 60_000 },
  );
  // URL vencida (1 hora) o rango fuera de orden: se empieza otra publicación.
  if (r.status === 403 || r.status === 416) return continuar('inicio', {});
  if (parte + 1 < particion.total) return continuar('subiendo', { ...data, parte: parte + 1 });
  return continuar('estado', { publishId: data.publishId, consultas: 0 }, ESPERA_SEG);
}

// publicaly_available_post_id son enteros de 64 bits: JSON.parse los redondea, se leen del texto crudo.
function idPublico(texto: string): string | undefined {
  return /"publicaly_available_post_id"\s*:\s*\[\s*"?(\d+)/.exec(texto)?.[1];
}

async function estado(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const publishId = String(data.publishId);
  const respuesta = await solicitar(
    ctx.http,
    `${API}/post/publish/status/fetch/`,
    {
      method: 'POST',
      headers: { ...portador(ctx.sesion), 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ publish_id: publishId }),
    },
    { red: RED, clasificar: clasificarTiktok },
  );
  const r = datos<{ status?: string; fail_reason?: string }>(respuesta);
  const usuario = ctx.sesion.datos.username ?? '';
  if (r.status === 'PUBLISH_COMPLETE' || r.status === 'SEND_TO_USER_INBOX') {
    const publico = idPublico(respuesta.texto);
    return publico
      ? { kind: 'done', remote: { id: publico, url: `https://www.tiktok.com/@${usuario}/video/${publico}` } }
      : { kind: 'done', remote: { id: publishId, url: `https://www.tiktok.com/@${usuario}` } };
  }
  if (r.status === 'FAILED')
    throw new PlatformError(
      'definitivo',
      'tiktok_failed',
      `TikTok no publicó el contenido: ${r.fail_reason ?? 'sin motivo'}`,
    );
  const consultas = Number(data.consultas ?? 0) + 1;
  if (consultas >= MAX_CONSULTAS)
    throw new PlatformError('definitivo', 'sin_procesar', 'TikTok no terminó de procesar la publicación.');
  return continuar('estado', { publishId, consultas }, ESPERA_SEG);
}

export const adaptadorTiktok: PlatformAdapter = {
  platform: 'tiktok',
  async publishStep(target, checkpoint: Checkpoint | null, ctx) {
    try {
      switch (checkpoint?.stage ?? 'creador') {
        case 'inicio':
          return await iniciar(target, ctx);
        case 'subiendo':
          return await subir(checkpoint!.data, ctx);
        case 'estado':
          return await estado(checkpoint!.data, ctx);
        default:
          return await revisarCreador(target, ctx);
      }
    } catch (error) {
      if (esPlatformError(error)) return { kind: 'error', error };
      throw error;
    }
  },
  async findExisting(target, ventana, ctx) {
    const r = await solicitar(
      ctx.http,
      `${API}/video/list/?${new URLSearchParams({ fields: 'id,title,video_description,create_time,share_url' }).toString()}`,
      {
        method: 'POST',
        headers: { ...portador(ctx.sesion), 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ max_count: 20 }),
      },
      { red: RED, clasificar: clasificarTiktok },
    );
    const inicio = target.texto.slice(0, 150);
    const video = (
      datos<{ videos?: { id: string; video_description?: string; create_time?: number; share_url?: string }[] }>(r)
        .videos ?? []
    ).find((v) => {
      const fecha = (v.create_time ?? 0) * 1000;
      return (
        (v.video_description ?? '').slice(0, 150) === inicio &&
        fecha >= ventana.desde.getTime() &&
        fecha <= ventana.hasta.getTime()
      );
    });
    return video
      ? { id: video.id, url: video.share_url ?? `https://www.tiktok.com/@${ctx.sesion.datos.username ?? ''}` }
      : null;
  },
  postComment() {
    return Promise.reject(
      new PlatformError('definitivo', 'sin_comentarios', 'TikTok no permite publicar comentarios por API.'),
    );
  },
};
