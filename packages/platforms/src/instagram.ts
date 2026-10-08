import type { DestinoEfectivo } from '@omnistream/core';
import { esPlatformError, PlatformError } from './errores';
import type { RespuestaHttp } from './http';
import { clasificarMeta, errorMeta, fechaGraph, graphGet, graphPost } from './meta';
import type { Checkpoint, PlatformAdapter, PublishContext, StepResult } from './tipos';

const RED = 'Instagram';
const ESPERA_SEG = 60; // la documentación recomienda consultar el contenedor una vez por minuto
const MAX_CONSULTAS = 30;
const NO_LISTO = 2207027;

const SUBCODIGOS: Record<number, [PlatformError['kind'], string]> = {
  2207042: ['definitivo', 'Instagram alcanzó el límite de publicaciones de las últimas 24 horas.'],
  [NO_LISTO]: ['temporal', 'Instagram aún no termina de procesar el archivo.'],
  2207052: ['temporal', 'Instagram no pudo descargar el archivo. Se reintentará.'],
  2207003: ['temporal', 'Instagram tardó demasiado en descargar el archivo. Se reintentará.'],
  2207020: ['definitivo', 'El contenedor de Instagram venció. Vuelve a intentarlo.'],
  2207051: ['definitivo', 'Instagram marcó la publicación como spam.'],
  2207026: ['definitivo', 'Instagram no admite el formato de este video.'],
  2207009: ['definitivo', 'Instagram no admite la proporción de esta imagen.'],
};

function clasificarInstagram(r: RespuestaHttp): PlatformError | null {
  const subcodigo = errorMeta(r)?.error_subcode;
  const conocido = subcodigo !== undefined ? SUBCODIGOS[subcodigo] : undefined;
  if (conocido) return new PlatformError(conocido[0], `ig_${subcodigo}`, conocido[1]);
  return clasificarMeta(RED, r);
}

const continuar = (stage: string, data: Record<string, unknown>, delaySec?: number): StepResult => ({
  kind: 'continue',
  checkpoint: { stage, data },
  ...(delaySec ? { delaySec } : {}),
});
const procesando = (contenedor: unknown, consultas = 0) =>
  continuar('procesando', { contenedor, consultas }, ESPERA_SEG);

const igUser = (ctx: PublishContext) => ctx.sesion.datos.igUserId ?? '';
const opciones = { clasificar: clasificarInstagram };

// Meta descarga el archivo desde un enlace firmado de 1 hora; las imágenes deben ser JPEG.
async function crearContenedor(target: DestinoEfectivo, ctx: PublishContext): Promise<StepResult> {
  const url = await ctx.archivo.urlFirmada();
  const parametros: Record<string, string> =
    target.format === 'imagen'
      ? { image_url: url, caption: target.texto }
      : { media_type: 'REELS', video_url: url, caption: target.texto, share_to_feed: 'true' };
  const r = await graphPost(ctx.http, `${igUser(ctx)}/media`, ctx.sesion.accessToken, RED, parametros, opciones);
  return procesando(String((r.json as { id?: string }).id ?? ''));
}

async function revisar(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const r = await graphGet(
    ctx.http,
    `${String(data.contenedor)}?fields=status_code`,
    ctx.sesion.accessToken,
    RED,
    opciones,
  );
  const estado = (r.json as { status_code?: string }).status_code;
  if (estado === 'FINISHED') return continuar('publicar', { contenedor: data.contenedor });
  if (estado === 'ERROR' || estado === 'EXPIRED')
    throw new PlatformError('definitivo', `ig_${estado}`, 'Instagram no pudo procesar el archivo.');
  if (estado === 'PUBLISHED')
    throw new PlatformError('ambiguo', 'ig_publicado', 'Instagram indica que el contenedor ya se publicó.');
  const consultas = Number(data.consultas ?? 0) + 1;
  if (consultas >= MAX_CONSULTAS)
    throw new PlatformError('definitivo', 'ig_sin_procesar', 'Instagram no terminó de procesar el archivo.');
  return procesando(data.contenedor, consultas);
}

async function publicar(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  try {
    const r = await graphPost(
      ctx.http,
      `${igUser(ctx)}/media_publish`,
      ctx.sesion.accessToken,
      RED,
      { creation_id: String(data.contenedor) },
      { ...opciones, final: true },
    );
    return continuar('enlace', { mediaId: String((r.json as { id?: string }).id ?? '') });
  } catch (error) {
    if (esPlatformError(error) && error.code === `ig_${NO_LISTO}`) return procesando(data.contenedor);
    throw error;
  }
}

async function enlace(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const mediaId = String(data.mediaId);
  const r = await graphGet(ctx.http, `${mediaId}?fields=permalink`, ctx.sesion.accessToken, RED, opciones);
  const url = (r.json as { permalink?: string }).permalink ?? 'https://www.instagram.com/';
  return { kind: 'done', remote: { id: mediaId, url } };
}

export const adaptadorInstagram: PlatformAdapter = {
  platform: 'instagram',
  async publishStep(target, checkpoint: Checkpoint | null, ctx) {
    try {
      switch (checkpoint?.stage) {
        case 'procesando':
          return await revisar(checkpoint.data, ctx);
        case 'publicar':
          return await publicar(checkpoint.data, ctx);
        case 'enlace':
          return await enlace(checkpoint.data, ctx);
        default:
          return await crearContenedor(target, ctx);
      }
    } catch (error) {
      if (esPlatformError(error)) return { kind: 'error', error };
      throw error;
    }
  },
  async findExisting(target, ventana, ctx) {
    const r = await graphGet(
      ctx.http,
      `${ctx.sesion.datos.igUserId ?? ''}/media?${new URLSearchParams({ fields: 'id,caption,timestamp,permalink', limit: '10' }).toString()}`,
      ctx.sesion.accessToken,
      RED,
      opciones,
    );
    const medio = (
      (r.json as { data?: { id: string; caption?: string; timestamp?: string; permalink?: string }[] }).data ?? []
    ).find((m) => {
      const fecha = fechaGraph(m.timestamp);
      return (
        (m.caption ?? '').trim() === target.texto.trim() &&
        fecha >= ventana.desde.getTime() &&
        fecha <= ventana.hasta.getTime()
      );
    });
    return medio ? { id: medio.id, url: medio.permalink ?? 'https://www.instagram.com/' } : null;
  },
  async postComment(remoteId, texto, ctx) {
    const r = await graphPost(
      ctx.http,
      `${remoteId}/comments`,
      ctx.sesion.accessToken,
      RED,
      { message: texto },
      {
        ...opciones,
        final: true,
      },
    );
    return { id: String((r.json as { id?: string }).id ?? '') };
  },
};
