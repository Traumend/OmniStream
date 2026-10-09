import {
  avisoDe,
  leerDestino,
  leerPublicacion,
  MAX_INTENTOS_TAREA,
  textoReferencia,
  urlVideoYoutube,
  type Platform,
} from '@omnistream/core';
import { esPlatformError } from '@omnistream/platforms';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { logger } from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { REGION, SECRETOS_CONECTORES } from '../config';
import { refDestino, refPublicacion } from './firestore';
import { crearNotificador, enviarPushFcm, type Notificador } from './notificaciones';
import type { DependenciasApi } from './porApi';
import { dependenciasApi } from './publicarDestino';

export interface TareaReferencia {
  postId: string;
  platform: Platform;
}

export interface DependenciasReferencia {
  api: Pick<DependenciasApi, 'adaptador' | 'sesion' | 'marcarExpirada' | 'http'>;
  notificar: Notificador;
  ultimoIntento: boolean;
  ahora: () => Date;
}

export function encoladorReferencias(): (tarea: TareaReferencia, id: string) => Promise<void> {
  const cola = getFunctions().taskQueue<TareaReferencia>(`locations/${REGION}/functions/comentarReferencia`);
  return async (tarea, id) => {
    try {
      await cola.enqueue(tarea, { id });
    } catch (error) {
      // El id incluye la versión del destino: si ya existe, esa referencia ya está en la cola.
      if (!String((error as { code?: string }).code).endsWith('task-already-exists')) throw error;
    }
  };
}

async function urlDelPrincipal(db: Firestore, principalId: string): Promise<{ title: string; url: string } | null> {
  const [principal, youtube] = await Promise.all([
    refPublicacion(db, principalId).get(),
    refDestino(db, principalId, 'youtube').get(),
  ]);
  const remote = youtube.exists ? leerDestino(youtube.data()).remote : undefined;
  if (!principal.exists || !remote) return null;
  return { title: leerPublicacion(principal.id, principal.data()).title, url: urlVideoYoutube(remote.id) };
}

// Publica la referencia al Principal como comentario en la Hija; si no se puede, la deja para hacerla a mano.
export async function ejecutarReferencia(
  db: Firestore,
  tarea: TareaReferencia,
  deps: DependenciasReferencia,
): Promise<'publicada' | 'omitida' | 'manual'> {
  const { postId, platform: red } = tarea;
  if (red === 'tiktok') return 'omitida';
  const ref = refDestino(db, postId, red);
  const [documento, post] = await Promise.all([ref.get(), refPublicacion(db, postId).get()]);
  if (!documento.exists || !post.exists) return 'omitida';
  const destino = leerDestino(documento.data());
  const publicacion = leerPublicacion(post.id, post.data());
  if (destino.parentRef.status !== 'publicando' || !destino.remote || !publicacion.parentId) return 'omitida';

  // Cambia la referencia solo si sigue en 'publicando': desvincular la Hija mientras tanto la deja sin efecto.
  const cerrar = (cambios: Record<string, unknown>) =>
    db.runTransaction(async (tx) => {
      const actual = await tx.get(ref);
      if (!actual.exists || leerDestino(actual.data()).parentRef.status !== 'publicando') return false;
      tx.update(ref, cambios);
      return true;
    });

  const aManual = async (mensaje: string): Promise<'manual' | 'omitida'> => {
    if (!(await cerrar({ 'parentRef.status': 'pendiente', 'parentRef.error': mensaje }))) return 'omitida';
    await deps.notificar(
      `ref-manual-${postId}-${red}`,
      avisoDe('referencia', { postId, titulo: publicacion.title, platform: red }),
    );
    return 'manual';
  };

  const principal = await urlDelPrincipal(db, publicacion.parentId);
  if (!principal) return aManual('No se encontró el video principal publicado.');

  try {
    const sesion = await deps.api.sesion(red);
    const { id } = await deps.api
      .adaptador(red)
      .postComment(destino.remote.id, textoReferencia(principal.title, principal.url), { http: deps.api.http, sesion });
    const guardado = await cerrar({ 'parentRef.status': 'publicada', 'parentRef.remoteCommentId': id });
    return guardado ? 'publicada' : 'omitida';
  } catch (error) {
    const fallo = esPlatformError(error) ? error : null;
    if ((!fallo || fallo.kind === 'temporal') && !deps.ultimoIntento) throw error;
    if (fallo?.kind === 'auth') await deps.api.marcarExpirada(red, fallo);
    logger.warn('No se pudo comentar la referencia', { postId, red, code: fallo?.code, message: fallo?.message });
    return aManual(fallo?.message ?? 'No se pudo publicar el comentario.');
  }
}

export const comentarReferencia = onTaskDispatched<TareaReferencia>(
  {
    region: REGION,
    retryConfig: { maxAttempts: MAX_INTENTOS_TAREA, minBackoffSeconds: 60, maxBackoffSeconds: 1800 },
    secrets: SECRETOS_CONECTORES,
  },
  async (solicitud) => {
    const db = getFirestore();
    await ejecutarReferencia(db, solicitud.data, {
      api: dependenciasApi(),
      notificar: crearNotificador(db, enviarPushFcm()),
      ultimoIntento: solicitud.retryCount >= MAX_INTENTOS_TAREA - 1,
      ahora: () => new Date(),
    });
  },
);
