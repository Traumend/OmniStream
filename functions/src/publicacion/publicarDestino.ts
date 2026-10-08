import { randomUUID } from 'node:crypto';
import {
  decidirToma,
  ETIQUETAS_RED,
  LEASE_MS,
  leerDestino,
  MAX_INTENTOS_TAREA,
  mensajeProblemas,
  validarPublicacion,
  type Intento,
  type MotivoOmision,
  type TipoError,
} from '@omnistream/core';
import { FieldValue, getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { REGION } from '../config';
import type { TareaPublicacion } from './cola';
import { leerContexto, leerPublicacionCompleta, refDestino } from './firestore';

export type ResultadoTarea = 'pendiente_manual' | 'fallida' | MotivoOmision;

type RegistroIntento = Pick<Intento, 'stage' | 'result' | 'error'>;

const errorDe = (code: string, kind: TipoError, message: string, at: Date) => ({ code, kind, message, at });

// Escribe el cierre solo si el lease sigue siendo de este intento; otro intento pudo haberlo tomado al vencer.
async function finalizar(
  db: Firestore,
  ref: DocumentReference,
  attemptId: string,
  ahora: Date,
  datos: Record<string, unknown> | null,
  intento: RegistroIntento,
): Promise<void> {
  const escrito = await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists || actual.get('lease.attemptId') !== attemptId) return false;
    tx.update(ref, { ...(datos ? { ...datos, statusChangedAt: ahora } : {}), lease: FieldValue.delete() });
    tx.create(ref.collection('attempts').doc(attemptId), { at: ahora, ...intento });
    return true;
  });
  if (!escrito) logger.warn('El intento perdió su lease antes de cerrar', { ruta: ref.path, attemptId });
}

export async function ejecutarTarea(
  db: Firestore,
  tarea: TareaPublicacion,
  contexto: { ahora: () => Date; ultimoIntento: boolean },
): Promise<ResultadoTarea> {
  const ref = refDestino(db, tarea.postId, tarea.platform);
  const attemptId = randomUUID();

  const toma = await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    const destino = actual.exists ? leerDestino(actual.data()) : null;
    const ahora = contexto.ahora();
    const decision = decidirToma(destino, tarea.scheduleVersion, ahora);
    if (decision.tomar) {
      tx.update(ref, {
        status: 'publicando',
        lease: { attemptId, until: new Date(ahora.getTime() + LEASE_MS) },
        attempts: FieldValue.increment(1),
        statusChangedAt: ahora,
      });
    }
    return { decision, destino };
  });
  if (!toma.decision.tomar || !toma.destino) {
    const motivo = toma.decision.tomar ? 'inexistente' : toma.decision.motivo;
    logger.info('Tarea omitida', { ...tarea, motivo });
    return motivo;
  }
  const destino = toma.destino;

  try {
    const completa = await leerPublicacionCompleta(db, tarea.postId);
    if (!completa) return 'inexistente';
    const { publicacion, destinos } = completa;
    const relacionados = await leerContexto(db, publicacion);
    const ahora = contexto.ahora();
    const errores = validarPublicacion({
      publicacion,
      destinos,
      asset: relacionados.asset,
      principal: relacionados.principal,
      numeroDeHijas: 0,
      ahora,
      hora: 'sin_comprobar',
    }).filter((p) => p.nivel === 'error' && (p.red === undefined || p.red === tarea.platform));

    if (errores.length > 0) {
      const mensaje = mensajeProblemas(errores);
      await finalizar(
        db,
        ref,
        attemptId,
        ahora,
        { status: 'fallida', lastError: errorDe('validacion', 'definitivo', mensaje, ahora) },
        {
          stage: 'validacion',
          result: 'error',
          error: mensaje,
        },
      );
      return 'fallida';
    }

    if (destino.publishMode === 'api') {
      const mensaje = `La publicación por API de ${ETIQUETAS_RED[tarea.platform]} aún no está disponible.`;
      await finalizar(
        db,
        ref,
        attemptId,
        ahora,
        { status: 'fallida', lastError: errorDe('sin_conector', 'definitivo', mensaje, ahora) },
        {
          stage: 'api',
          result: 'error',
          error: mensaje,
        },
      );
      return 'fallida';
    }

    await finalizar(db, ref, attemptId, ahora, { status: 'pendiente_manual' }, { stage: 'manual', result: 'ok' });
    return 'pendiente_manual';
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    const ahora = contexto.ahora();
    if (contexto.ultimoIntento) {
      const final = 'No se pudo publicar después de varios intentos.';
      await finalizar(
        db,
        ref,
        attemptId,
        ahora,
        { status: 'fallida', lastError: errorDe('reintentos_agotados', 'temporal', final, ahora) },
        {
          stage: 'error',
          result: 'error',
          error: mensaje,
        },
      );
      return 'fallida';
    }
    // Libera el lease para que el reintento de Cloud Tasks continúe sin esperar a que venza.
    await finalizar(db, ref, attemptId, ahora, null, { stage: 'error', result: 'error', error: mensaje });
    throw error;
  }
}

export const publicarDestino = onTaskDispatched<TareaPublicacion>(
  {
    region: REGION,
    retryConfig: { maxAttempts: MAX_INTENTOS_TAREA, minBackoffSeconds: 60, maxBackoffSeconds: 1800 },
    rateLimits: { maxConcurrentDispatches: 4 },
    timeoutSeconds: 1800,
    memory: '512MiB',
  },
  async (solicitud) => {
    await ejecutarTarea(getFirestore(), solicitud.data, {
      ahora: () => new Date(),
      ultimoIntento: solicitud.retryCount >= MAX_INTENTOS_TAREA - 1,
    });
  },
);
