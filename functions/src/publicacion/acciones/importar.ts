import {
  analizarUrlPublica,
  CAMPOS_YOUTUBE_POR_DEFECTO,
  destinoNuevo,
  urlVideoYoutube,
  type Platform,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import { esPlatformError, obtenerVideo, type Http, type SesionProveedor } from '@omnistream/platforms';
import { HttpsError } from 'firebase-functions/v2/https';
import { refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';
import { promocionInicial } from './promocion';

const YA_EXISTE = 6; // código gRPC ALREADY_EXISTS

export interface DependenciasImportar extends DependenciasAccion {
  sesion(red: Platform): Promise<SesionProveedor>;
  http: Http;
}

// Trae un video ya subido o programado en YouTube como Principal, solo con sus metadatos: no se descarga.
export async function importarYoutube(url: string, deps: DependenciasImportar): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  const id = analizarUrlPublica('youtube', url)?.id;
  if (!id) throw new HttpsError('invalid-argument', 'La URL no corresponde a un video de YouTube.');

  let sesion: SesionProveedor;
  try {
    sesion = await deps.sesion('youtube');
  } catch (error) {
    if (esPlatformError(error) && error.kind === 'auth')
      throw new HttpsError('failed-precondition', 'Conecta YouTube en Ajustes > Conexiones para importar videos.');
    throw new HttpsError('unavailable', 'YouTube no respondió. Intenta de nuevo en unos minutos.');
  }

  let video;
  try {
    video = await obtenerVideo(id, { http: deps.http, sesion });
  } catch (error) {
    if (esPlatformError(error) && error.kind === 'auth')
      throw new HttpsError('failed-precondition', 'Conecta YouTube en Ajustes > Conexiones para importar videos.');
    throw new HttpsError('unavailable', 'YouTube no respondió. Intenta de nuevo en unos minutos.');
  }
  if (!video) throw new HttpsError('not-found', 'No se encontró ese video en YouTube.');
  if (!sesion.datos.channelId || video.channelId !== sesion.datos.channelId)
    throw new HttpsError('failed-precondition', 'El video no pertenece a tu canal conectado.');

  const fecha = video.publishAt ?? video.publishedAt ?? null;
  const pendiente = video.publishAt && video.publishAt.getTime() > ahora.getTime() ? video.publishAt : undefined;
  const items = await promocionInicial(db, fecha);
  const postId = `yt-${id}`;
  const destino = {
    ...destinoNuevo('youtube', 'video_largo', {
      esHija: false,
      ahora,
      youtube: { ...CAMPOS_YOUTUBE_POR_DEFECTO, description: video.description, privacy: video.privacy },
    }),
    status: 'publicada' as const,
    publishMode: 'manual' as const,
    scheduledAt: fecha ?? undefined,
    remote: { id, url: urlVideoYoutube(id), publishedAt: fecha ?? ahora },
  };

  try {
    await db.runTransaction(async (tx) => {
      tx.create(refPublicacion(db, postId), {
        kind: 'principal',
        origin: 'youtube_importado',
        status: 'publicada',
        title: video.title,
        base: { text: video.description, hashtags: [] },
        scheduledAt: fecha,
        targetStatus: { youtube: 'publicada' },
        promotion: { items },
        awaitingPublicationUntil: pendiente,
        createdAt: ahora,
        updatedAt: ahora,
      });
      tx.create(refDestino(db, postId, 'youtube'), destino);
    });
  } catch (error) {
    if ((error as { code?: number }).code === YA_EXISTE)
      throw new HttpsError('already-exists', 'Ese video ya está en OmniStream.');
    throw error;
  }
  return { postId };
}
