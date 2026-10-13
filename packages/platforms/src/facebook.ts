import type { DestinoEfectivo } from '@omnistream/core';
import { esPlatformError, PlatformError } from './errores';
import { solicitar } from './http';
import { clasificarMeta, fechaGraph, graphGet, graphPost, VERSION_GRAPH } from './meta';
import type { Checkpoint, PlatformAdapter, PublishContext, StepResult } from './tipos';

const RED = 'Facebook';
const ESPERA_SEG = 30;
const MAX_CONSULTAS = 60;

const continuar = (stage: string, data: Record<string, unknown>, delaySec?: number): StepResult => ({
  kind: 'continue',
  checkpoint: { stage, data },
  ...(delaySec ? { delaySec } : {}),
});

const urlVideo = (tipo: unknown, pageId: string, videoId: string) =>
  tipo === 'reel' ? `https://www.facebook.com/reel/${videoId}` : `https://www.facebook.com/${pageId}/videos/${videoId}`;

async function iniciar(target: DestinoEfectivo, ctx: PublishContext): Promise<StepResult> {
  const { pageId = '' } = ctx.sesion.datos;
  const token = ctx.sesion.accessToken;
  if (target.format === 'reel') {
    const r = await graphPost(ctx.http, `${pageId}/video_reels`, token, RED, { upload_phase: 'start' });
    const { video_id, upload_url } = r.json as { video_id?: string; upload_url?: string };
    if (!video_id || !upload_url) throw new PlatformError('temporal', 'sin_video', 'Facebook no inició la subida.');
    return continuar('subir', { videoId: video_id, uploadUrl: upload_url });
  }
  if (target.format === 'imagen') {
    const r = await graphPost(
      ctx.http,
      `${pageId}/photos`,
      token,
      RED,
      { url: await ctx.archivo.urlFirmada(), caption: target.texto },
      { final: true },
    );
    const { post_id, id } = r.json as { post_id?: string; id?: string };
    return continuar('enlace', { postId: post_id ?? id ?? '' });
  }
  const r = await graphPost(
    ctx.http,
    `https://graph-video.facebook.com/${VERSION_GRAPH}/${pageId}/videos`,
    token,
    RED,
    { file_url: await ctx.archivo.urlFirmada(), title: target.titulo, description: target.texto },
    { final: true, timeoutMs: 10 * 60_000 },
  );
  return continuar('estado', { videoId: String((r.json as { id?: string }).id ?? ''), tipo: 'video', consultas: 0 });
}

// Subida por URL: Facebook descarga el archivo desde el enlace firmado.
async function subir(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  await solicitar(
    ctx.http,
    String(data.uploadUrl),
    {
      method: 'POST',
      headers: { Authorization: `OAuth ${ctx.sesion.accessToken}`, file_url: await ctx.archivo.urlFirmada() },
    },
    { red: RED, clasificar: (r) => clasificarMeta(RED, r), timeoutMs: 10 * 60_000 },
  );
  return continuar('finalizar', { videoId: data.videoId });
}

async function finalizar(target: DestinoEfectivo, data: Record<string, unknown>, ctx: PublishContext) {
  await graphPost(
    ctx.http,
    `${ctx.sesion.datos.pageId}/video_reels`,
    ctx.sesion.accessToken,
    RED,
    {
      upload_phase: 'finish',
      video_id: String(data.videoId),
      video_state: 'PUBLISHED',
      description: target.texto,
      title: target.titulo,
    },
    { final: true },
  );
  return continuar('estado', { videoId: data.videoId, tipo: 'reel', consultas: 0 }, ESPERA_SEG);
}

interface EstadoVideo {
  status?: { video_status?: string; publishing_phase?: { status?: string } };
}

async function estado(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const videoId = String(data.videoId);
  const r = await graphGet(ctx.http, `${videoId}?fields=status`, ctx.sesion.accessToken, RED);
  const { video_status, publishing_phase } = (r.json as EstadoVideo).status ?? {};
  if (video_status === 'upload_failed' || video_status === 'error' || video_status === 'expired')
    throw new PlatformError('definitivo', `video_${video_status}`, 'Facebook no pudo procesar el video.');
  if (publishing_phase?.status === 'published' || video_status === 'ready')
    return {
      kind: 'done',
      remote: { id: videoId, url: urlVideo(data.tipo, ctx.sesion.datos.pageId ?? '', videoId) },
    };
  const consultas = Number(data.consultas ?? 0) + 1;
  if (consultas >= MAX_CONSULTAS)
    throw new PlatformError('definitivo', 'sin_procesar', 'Facebook no terminó de procesar el video.');
  return continuar('estado', { ...data, consultas }, ESPERA_SEG);
}

async function enlace(data: Record<string, unknown>, ctx: PublishContext): Promise<StepResult> {
  const postId = String(data.postId);
  const r = await graphGet(ctx.http, `${postId}?fields=permalink_url`, ctx.sesion.accessToken, RED);
  const url = (r.json as { permalink_url?: string }).permalink_url ?? `https://www.facebook.com/${postId}`;
  return { kind: 'done', remote: { id: postId, url } };
}

const limpio = (texto: string | undefined) => (texto ?? '').trim();

export const adaptadorFacebook: PlatformAdapter = {
  platform: 'facebook',
  async publishStep(target, checkpoint: Checkpoint | null, ctx) {
    try {
      switch (checkpoint?.stage) {
        case 'subir':
          return await subir(checkpoint.data, ctx);
        case 'finalizar':
          return await finalizar(target, checkpoint.data, ctx);
        case 'estado':
          return await estado(checkpoint.data, ctx);
        case 'enlace':
          return await enlace(checkpoint.data, ctx);
        default:
          return await iniciar(target, ctx);
      }
    } catch (error) {
      if (esPlatformError(error)) return { kind: 'error', error };
      throw error;
    }
  },
  async findExisting(target, ventana, ctx) {
    const pageId = ctx.sesion.datos.pageId ?? '';
    const enVentana = (fecha: number) => fecha >= ventana.desde.getTime() && fecha <= ventana.hasta.getTime();
    if (target.format === 'imagen') {
      const r = await graphGet(
        ctx.http,
        `${pageId}/published_posts?${new URLSearchParams({ fields: 'id,message,created_time,permalink_url', limit: '10' }).toString()}`,
        ctx.sesion.accessToken,
        RED,
      );
      const post = (
        (r.json as { data?: { id: string; message?: string; created_time?: string; permalink_url?: string }[] }).data ??
        []
      ).find((p) => limpio(p.message) === limpio(target.texto) && enVentana(fechaGraph(p.created_time)));
      return post ? { id: post.id, url: post.permalink_url ?? `https://www.facebook.com/${post.id}` } : null;
    }
    const r = await graphGet(
      ctx.http,
      `${pageId}/videos?${new URLSearchParams({ fields: 'id,description,created_time', limit: '10' }).toString()}`,
      ctx.sesion.accessToken,
      RED,
    );
    const video = (
      (r.json as { data?: { id: string; description?: string; created_time?: string }[] }).data ?? []
    ).find((v) => limpio(v.description) === limpio(target.texto) && enVentana(fechaGraph(v.created_time)));
    return video
      ? { id: video.id, url: urlVideo(target.format === 'reel' ? 'reel' : 'video', pageId, video.id) }
      : null;
  },
  async postComment(remoteId, texto, ctx) {
    const r = await graphPost(
      ctx.http,
      `${remoteId}/comments`,
      ctx.sesion.accessToken,
      RED,
      { message: texto },
      {
        final: true,
      },
    );
    return { id: String((r.json as { id?: string }).id ?? '') };
  },
};
