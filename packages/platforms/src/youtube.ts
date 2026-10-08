import { urlVideoYoutube, type DestinoEfectivo } from '@omnistream/core';
import { esPlatformError, PlatformError } from './errores';
import { solicitar, type Http, type RespuestaHttp } from './http';
import { TAMANO_PARTE_YOUTUBE } from './particion';
import type {
  Checkpoint,
  ContextoLectura,
  OAuthProvider,
  PlatformAdapter,
  PublishContext,
  SesionProveedor,
  StepResult,
} from './tipos';

const AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/youtube/v3';
const SUBIDAS = 'https://www.googleapis.com/upload/youtube/v3';
const PREFIJO = 'https://www.googleapis.com/auth/';
const RED = 'YouTube';

export const ALCANCES_YOUTUBE: readonly string[] = [
  'youtube.upload',
  'youtube.force-ssl',
  'youtube.readonly',
  'yt-analytics.readonly',
].map((a) => `${PREFIJO}${a}`);

const CUOTA = new Set(['quotaExceeded', 'rateLimitExceeded', 'userRateLimitExceeded']);

interface ErrorGoogle {
  error?: { errors?: { reason?: string }[]; message?: string } | string;
}

function clasificarGoogle(r: RespuestaHttp): PlatformError | null {
  if (r.status < 400) return null;
  const error = (r.json as ErrorGoogle | null)?.error;
  const detalle = typeof error === 'object' ? error : undefined;
  const motivo = detalle?.errors?.[0]?.reason;
  if (r.status === 401)
    return new PlatformError('auth', 'http_401', 'El acceso a YouTube venció. Vuelve a conectarla.');
  if (motivo && CUOTA.has(motivo))
    return new PlatformError('temporal', motivo, 'YouTube no tiene cuota disponible por ahora.');
  if (motivo === 'uploadLimitExceeded')
    return new PlatformError('definitivo', motivo, 'Tu canal de YouTube alcanzó el límite de subidas del día.');
  if (r.status === 429 || r.status >= 500)
    return new PlatformError('temporal', `http_${r.status}`, `YouTube respondió con un error (${r.status}).`);
  return new PlatformError(
    'definitivo',
    motivo ?? `http_${r.status}`,
    `YouTube rechazó el video: ${detalle?.message ?? `error ${r.status}`}`,
  );
}

function clasificarToken(r: RespuestaHttp): PlatformError | null {
  if (r.status < 400) return null;
  const error = (r.json as ErrorGoogle | null)?.error;
  if (error === 'invalid_grant' || r.status === 401)
    return new PlatformError('auth', 'invalid_grant', 'El acceso a YouTube fue revocado o venció.');
  return clasificarGoogle(r);
}

const autorizacion = (sesion: SesionProveedor) => ({ Authorization: `Bearer ${sesion.accessToken}` });

export interface VideoYoutube {
  id: string;
  channelId: string;
  title: string;
  description: string;
  privacy: 'public' | 'unlisted' | 'private';
  publishAt?: Date; // publicación programada de un video privado
  publishedAt?: Date;
}

interface RecursoVideo {
  id?: string;
  snippet?: { channelId?: string; title?: string; description?: string; publishedAt?: string };
  status?: { privacyStatus?: string; publishAt?: string };
}

const fechaOpcional = (valor?: string) => (valor ? new Date(valor) : undefined);

// Solo metadatos (videos.list): importar un Principal ya subido no descarga el video.
export async function obtenerVideo(videoId: string, ctx: ContextoLectura): Promise<VideoYoutube | null> {
  const parametros = new URLSearchParams({ part: 'snippet,status', id: videoId });
  const r = await solicitar(
    ctx.http,
    `${API}/videos?${parametros.toString()}`,
    { method: 'GET', headers: autorizacion(ctx.sesion) },
    { red: RED, clasificar: clasificarGoogle },
  );
  const video = (r.json as { items?: RecursoVideo[] }).items?.[0];
  if (!video?.id) return null;
  const privacidad = video.status?.privacyStatus;
  const resultado: VideoYoutube = {
    id: video.id,
    channelId: video.snippet?.channelId ?? '',
    title: video.snippet?.title ?? '',
    description: video.snippet?.description ?? '',
    privacy: privacidad === 'public' || privacidad === 'unlisted' ? privacidad : 'private',
  };
  const publishAt = fechaOpcional(video.status?.publishAt);
  const publishedAt = fechaOpcional(video.snippet?.publishedAt);
  if (publishAt) resultado.publishAt = publishAt;
  if (publishedAt) resultado.publishedAt = publishedAt;
  return resultado;
}

interface RespuestaToken {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export function crearOAuthYoutube(cfg: {
  clientId: string;
  clientSecret: string;
  http: Http;
  ahora?: () => Date;
}): OAuthProvider {
  const ahora = cfg.ahora ?? (() => new Date());
  const pedirToken = async (parametros: Record<string, string>) => {
    const r = await solicitar(
      cfg.http,
      TOKEN,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          ...parametros,
        }).toString(),
      },
      { red: RED, clasificar: clasificarToken },
    );
    const token = r.json as RespuestaToken;
    if (!token.access_token) throw new PlatformError('temporal', 'sin_token', 'Google no entregó el acceso.');
    return token as RespuestaToken & { access_token: string };
  };
  const vence = (segundos?: number) => (segundos ? ahora().getTime() + segundos * 1000 : undefined);

  return {
    proveedor: 'youtube',
    buildAuthUrl({ state, redirectUri }) {
      const parametros = new URLSearchParams({
        client_id: cfg.clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: ALCANCES_YOUTUBE.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        include_granted_scopes: 'true',
        state,
      });
      return `${AUTORIZACION}?${parametros.toString()}`;
    },
    async exchangeCode({ code, redirectUri }) {
      const token = await pedirToken({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });
      if (!token.refresh_token)
        throw new PlatformError(
          'definitivo',
          'sin_refresh',
          'Google no entregó un acceso sin conexión. Vuelve a intentarlo.',
        );
      const sesion: SesionProveedor = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        datos: {},
      };
      const expira = vence(token.expires_in);
      if (expira) sesion.expiresAt = expira;
      const parametros = new URLSearchParams({ part: 'snippet,contentDetails', mine: 'true' });
      const r = await solicitar(
        cfg.http,
        `${API}/channels?${parametros.toString()}`,
        { method: 'GET', headers: autorizacion(sesion) },
        { red: RED, clasificar: clasificarGoogle },
      );
      const canal = (
        r.json as {
          items?: {
            id: string;
            snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
            contentDetails?: { relatedPlaylists?: { uploads?: string } };
          }[];
        }
      ).items?.[0];
      if (!canal)
        throw new PlatformError('definitivo', 'sin_canal', 'Esta cuenta de Google no tiene un canal de YouTube.');
      sesion.datos = { channelId: canal.id, uploadsPlaylistId: canal.contentDetails?.relatedPlaylists?.uploads ?? '' };
      const cuenta: { id: string; name: string; handle?: string; avatarUrl?: string } = {
        id: canal.id,
        name: canal.snippet?.title ?? canal.id,
      };
      if (canal.snippet?.customUrl) cuenta.handle = canal.snippet.customUrl;
      if (canal.snippet?.thumbnails?.default?.url) cuenta.avatarUrl = canal.snippet.thumbnails.default.url;
      return { sesion, scopes: (token.scope ?? '').split(' ').filter(Boolean), cuentas: { youtube: cuenta } };
    },
    async refresh(sesion) {
      if (!sesion.refreshToken)
        throw new PlatformError('auth', 'sin_refresh', 'El acceso a YouTube fue revocado o venció.');
      const token = await pedirToken({ refresh_token: sesion.refreshToken, grant_type: 'refresh_token' });
      const nueva: SesionProveedor = { ...sesion, accessToken: token.access_token };
      const expira = vence(token.expires_in);
      if (expira) nueva.expiresAt = expira;
      if (token.refresh_token) nueva.refreshToken = token.refresh_token;
      return nueva;
    },
  };
}

const continuar = (stage: string, data: Record<string, unknown>, delaySec?: number): StepResult => ({
  kind: 'continue',
  checkpoint: { stage, data },
  ...(delaySec ? { delaySec } : {}),
});

// 308 "Resume Incomplete" lleva Range: bytes=0-N; sin Range, YouTube aún no recibió nada.
function siguienteOffset(r: RespuestaHttp): number {
  const rango = /bytes=0-(\d+)/.exec(r.headers.get('range') ?? '');
  return rango?.[1] ? Number(rango[1]) + 1 : 0;
}

// En la subida, 308 y 404 no son errores: indican el avance o una sesión vencida.
const ACEPTADOS_SUBIDA = [308, 404];

function terminarSubida(target: DestinoEfectivo, r: RespuestaHttp, ctx: PublishContext): StepResult {
  const id = (r.json as { id?: string } | null)?.id;
  if (!id) throw new PlatformError('ambiguo', 'sin_id', 'YouTube no devolvió el id del video.');
  if (target.youtube?.thumbnail && ctx.miniatura) return continuar('miniatura', { videoId: id });
  return { kind: 'done', remote: { id, url: urlVideoYoutube(id) } };
}

async function iniciar(target: DestinoEfectivo, ctx: PublishContext): Promise<StepResult> {
  const youtube = target.youtube;
  const cuerpo = {
    snippet: {
      title: target.titulo,
      description: target.texto,
      tags: target.etiquetas,
      categoryId: youtube?.categoryId ?? '22',
    },
    status: { privacyStatus: youtube?.privacy ?? 'public', selfDeclaredMadeForKids: youtube?.madeForKids ?? false },
  };
  const r = await solicitar(
    ctx.http,
    `${SUBIDAS}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        ...autorizacion(ctx.sesion),
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(ctx.archivo.size),
        'X-Upload-Content-Type': ctx.archivo.mimeType,
      },
      body: JSON.stringify(cuerpo),
    },
    { red: RED, clasificar: clasificarGoogle },
  );
  const uploadUrl = r.headers.get('location');
  if (!uploadUrl) throw new PlatformError('temporal', 'sin_sesion', 'YouTube no abrió la sesión de subida.');
  return continuar('subiendo', { uploadUrl, offset: 0 });
}

async function subir(target: DestinoEfectivo, data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const uploadUrl = String(data.uploadUrl);
  const { size, mimeType } = ctx.archivo;
  let offset = Number(data.offset ?? 0);
  if (ctx.reanudando) {
    const estado = await solicitar(
      ctx.http,
      uploadUrl,
      {
        method: 'PUT',
        headers: { ...autorizacion(ctx.sesion), 'Content-Range': `bytes */${size}` },
        redirect: 'manual',
      },
      { red: RED, clasificar: clasificarGoogle, aceptar: ACEPTADOS_SUBIDA },
    );
    if (estado.status === 404) return continuar('inicio', {});
    if (estado.status === 200 || estado.status === 201) return terminarSubida(target, estado, ctx);
    offset = siguienteOffset(estado);
  }
  const fin = Math.min(offset + TAMANO_PARTE_YOUTUBE, size) - 1;
  const bytes = await ctx.archivo.leerRango(offset, fin);
  const r = await solicitar(
    ctx.http,
    uploadUrl,
    {
      method: 'PUT',
      headers: {
        ...autorizacion(ctx.sesion),
        'Content-Type': mimeType,
        'Content-Range': `bytes ${offset}-${fin}/${size}`,
      },
      body: bytes,
      redirect: 'manual',
    },
    {
      red: RED,
      clasificar: clasificarGoogle,
      aceptar: ACEPTADOS_SUBIDA,
      final: fin === size - 1,
      timeoutMs: 10 * 60_000,
    },
  );
  if (r.status === 404) return continuar('inicio', {});
  if (r.status === 308) return continuar('subiendo', { uploadUrl, offset: siguienteOffset(r) });
  return terminarSubida(target, r, ctx);
}

// La miniatura exige un canal verificado; si falla, el video ya está publicado y se termina igual.
async function miniatura(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const videoId = String(data.videoId);
  const archivo = ctx.miniatura;
  if (archivo) {
    try {
      await solicitar(
        ctx.http,
        `${SUBIDAS}/thumbnails/set?videoId=${encodeURIComponent(videoId)}`,
        {
          method: 'POST',
          headers: { ...autorizacion(ctx.sesion), 'Content-Type': archivo.mimeType },
          body: await archivo.leerRango(0, archivo.size - 1),
        },
        { red: RED, clasificar: clasificarGoogle },
      );
    } catch {
      // Sin miniatura propia: YouTube usa la automática.
    }
  }
  return { kind: 'done', remote: { id: videoId, url: urlVideoYoutube(videoId) } };
}

export const adaptadorYoutube: PlatformAdapter = {
  platform: 'youtube',
  async publishStep(target, checkpoint: Checkpoint | null, ctx) {
    try {
      switch (checkpoint?.stage ?? 'inicio') {
        case 'subiendo':
          return await subir(target, checkpoint!.data, ctx);
        case 'miniatura':
          return await miniatura(checkpoint!.data, ctx);
        default:
          return await iniciar(target, ctx);
      }
    } catch (error) {
      if (esPlatformError(error)) return { kind: 'error', error };
      throw error;
    }
  },
  async findExisting(target, ventana, ctx: ContextoLectura) {
    const lista = ctx.sesion.datos.uploadsPlaylistId;
    if (!lista) return null;
    const r = await solicitar(
      ctx.http,
      `${API}/playlistItems?part=snippet&playlistId=${encodeURIComponent(lista)}&maxResults=10`,
      { method: 'GET', headers: autorizacion(ctx.sesion) },
      { red: RED, clasificar: clasificarGoogle },
    );
    const items =
      (
        r.json as {
          items?: { snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }[];
        }
      ).items ?? [];
    const encontrado = items.find((i) => {
      const fecha = i.snippet?.publishedAt ? new Date(i.snippet.publishedAt).getTime() : NaN;
      return (
        i.snippet?.title === target.titulo &&
        fecha >= ventana.desde.getTime() &&
        fecha <= ventana.hasta.getTime() &&
        Boolean(i.snippet.resourceId?.videoId)
      );
    });
    const id = encontrado?.snippet?.resourceId?.videoId;
    return id ? { id, url: urlVideoYoutube(id) } : null;
  },
  async postComment(remoteId, texto, ctx) {
    const r = await solicitar(
      ctx.http,
      `${API}/commentThreads?part=snippet`,
      {
        method: 'POST',
        headers: { ...autorizacion(ctx.sesion), 'Content-Type': 'application/json' },
        body: JSON.stringify({ snippet: { videoId: remoteId, topLevelComment: { snippet: { textOriginal: texto } } } }),
      },
      { red: RED, clasificar: clasificarGoogle, final: true },
    );
    return { id: String((r.json as { id?: string }).id ?? '') };
  },
};
