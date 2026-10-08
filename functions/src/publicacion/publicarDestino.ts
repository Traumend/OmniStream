import { randomUUID } from 'node:crypto';
import {
  decidirToma,
  destinoEfectivo,
  ETIQUETAS_RED,
  idContinuacion,
  LEASE_MS,
  leerDestino,
  MAX_INTENTOS_TAREA,
  mensajeProblemas,
  proveedorDe,
  urlVideoYoutube,
  validarPublicacion,
  type Asset,
  type Destino,
  type Intento,
  type MotivoOmision,
  type Publicacion,
  type RemoteRef,
  type TipoError,
} from '@omnistream/core';
import { esPlatformError, type PlatformError, type PublishContext, type SesionProveedor } from '@omnistream/platforms';
import { FieldValue, getFirestore, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { claveCifrado, REGION, SECRETOS_CONECTORES } from '../config';
import { crearCifrador } from '../conexiones/cifrado';
import { ADAPTADORES, proveedoresReales } from '../conexiones/proveedores';
import { marcarExpirada, sesionVigente, type DependenciasSesion } from '../conexiones/sesiones';
import { encoladorCloudTasks, type TareaPublicacion } from './cola';
import { leerContexto, leerPublicacionCompleta, refDestino } from './firestore';
import { fuentesDePublicacion } from './fuentes';
import { crearNotificador, enviarPushFcm } from './notificaciones';
import { avanzarPorApi, PRESUPUESTO_API_MS, type DependenciasApi } from './porApi';

export type ResultadoTarea = 'pendiente_manual' | 'publicada' | 'esperando' | 'fallida' | MotivoOmision;

interface ContextoTarea {
  ahora: () => Date;
  ultimoIntento: boolean;
  api?: DependenciasApi;
}

const VENTANA_AMBIGUO_MS = 30 * 60 * 1000;

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

// Título y enlace del Principal para la referencia que TikTok lleva en la descripción.
async function referenciaPrincipal(
  db: Firestore,
  principal: Publicacion | null,
): Promise<{ title: string; url?: string } | undefined> {
  if (!principal) return undefined;
  const youtube = await refDestino(db, principal.id, 'youtube').get();
  const remote = youtube.exists ? leerDestino(youtube.data()).remote : undefined;
  return remote ? { title: principal.title, url: urlVideoYoutube(remote.id) } : { title: principal.title };
}

async function publicarPorApi(p: {
  db: Firestore;
  ref: DocumentReference;
  attemptId: string;
  tarea: TareaPublicacion;
  destino: Destino;
  publicacion: Publicacion;
  asset: Asset;
  principal: Publicacion | null;
  continuar: boolean;
  contexto: ContextoTarea;
  api: DependenciasApi;
}): Promise<ResultadoTarea> {
  const { db, ref, attemptId, tarea, destino, api, contexto } = p;
  const red = tarea.platform;

  const fallar = async (error: PlatformError): Promise<ResultadoTarea> => {
    if (error.kind === 'auth') await api.marcarExpirada(red, error);
    const ahora = contexto.ahora();
    await finalizar(
      db,
      ref,
      attemptId,
      ahora,
      { status: 'fallida', lastError: errorDe(error.code, error.kind, error.message, ahora) },
      { stage: 'api', result: 'error', error: error.message },
    );
    return 'fallida';
  };

  const publicada = async (remote: RemoteRef): Promise<ResultadoTarea> => {
    const ahora = contexto.ahora();
    const referencia = red === 'tiktok' && destino.parentRef.status !== 'no_aplica';
    await finalizar(
      db,
      ref,
      attemptId,
      ahora,
      {
        status: 'publicada',
        remote: { ...remote, publishedAt: ahora },
        checkpoint: FieldValue.delete(),
        ...(referencia ? { 'parentRef.status': 'publicada' } : {}),
      },
      { stage: 'api', result: 'ok' },
    );
    return 'publicada';
  };

  let sesion: SesionProveedor;
  try {
    sesion = await api.sesion(red);
  } catch (error) {
    if (esPlatformError(error) && error.kind !== 'temporal' && error.kind !== 'ambiguo') return fallar(error);
    throw error;
  }

  const principal = red === 'tiktok' && p.publicacion.parentId ? await referenciaPrincipal(db, p.principal) : undefined;
  const efectivo = destinoEfectivo(p.publicacion, destino, { principal, duracionSeg: p.asset.durationSec });
  const ctx: PublishContext = {
    http: api.http,
    sesion,
    ...(await api.fuentes(p.asset, destino)),
    reanudando: p.continuar,
    ahora: contexto.ahora,
  };
  const adaptador = api.adaptador(red);
  const resultado = await avanzarPorApi({
    db,
    ref,
    attemptId,
    checkpoint: destino.checkpoint ?? null,
    efectivo,
    adaptador,
    ctx,
    ahora: contexto.ahora,
    presupuestoMs: api.presupuestoMs,
  });

  switch (resultado.tipo) {
    case 'hecho':
      return publicada(resultado.remote);
    case 'perdido':
      return 'ocupada';
    case 'esperar': {
      // Libera el lease conservando el estado y el checkpoint; la continuación sigue desde ahí.
      const ahora = contexto.ahora();
      await finalizar(db, ref, attemptId, ahora, {}, { stage: 'api_continua', result: 'ok' });
      const id = idContinuacion(tarea.postId, red, tarea.scheduleVersion, resultado.seq);
      await api.encolar(
        { postId: tarea.postId, platform: red, scheduleVersion: tarea.scheduleVersion, continuacion: resultado.seq },
        resultado.delaySec > 0 ? { id, scheduleTime: new Date(ahora.getTime() + resultado.delaySec * 1000) } : { id },
      );
      return 'esperando';
    }
    case 'error': {
      const { error } = resultado;
      if (error.kind === 'temporal') throw error;
      if (error.kind === 'ambiguo') {
        // Sin respuesta al crear la publicación: si ya existe en la red, no se publica dos veces.
        const ahora = contexto.ahora().getTime();
        const existente = await adaptador.findExisting(
          efectivo,
          { desde: new Date(ahora - VENTANA_AMBIGUO_MS), hasta: new Date(ahora + VENTANA_AMBIGUO_MS) },
          { http: api.http, sesion },
        );
        if (existente) return publicada(existente);
        throw error;
      }
      return fallar(error);
    }
  }
}

export async function ejecutarTarea(
  db: Firestore,
  tarea: TareaPublicacion,
  contexto: ContextoTarea,
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
      modos: { [tarea.platform]: destino.publishMode },
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

    if (destino.publishMode === 'api' && contexto.api && relacionados.asset) {
      return await publicarPorApi({
        db,
        ref,
        attemptId,
        tarea,
        destino,
        publicacion,
        asset: relacionados.asset,
        principal: relacionados.principal,
        continuar: toma.decision.continuar,
        contexto,
        api: contexto.api,
      });
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

function dependenciasApi(): DependenciasApi {
  const db = getFirestore();
  const sesiones: DependenciasSesion = {
    db,
    cifrador: crearCifrador(claveCifrado.value()),
    proveedores: proveedoresReales(),
    ahora: () => new Date(),
    notificar: crearNotificador(db, enviarPushFcm()),
  };
  return {
    adaptador: (red) => ADAPTADORES[red],
    sesion: (red) => sesionVigente(red, sesiones),
    // urlMedia llega con /api/media/ (Tarea 13); mientras tanto TikTok imagen por API no se usa.
    fuentes: (asset, destino) => fuentesDePublicacion(getStorage().bucket(), asset, destino),
    marcarExpirada: (red, error) => marcarExpirada(proveedorDe(red), error, sesiones),
    encolar: encoladorCloudTasks(),
    http: fetch,
    presupuestoMs: PRESUPUESTO_API_MS,
  };
}

export const publicarDestino = onTaskDispatched<TareaPublicacion>(
  {
    region: REGION,
    retryConfig: { maxAttempts: MAX_INTENTOS_TAREA, minBackoffSeconds: 60, maxBackoffSeconds: 1800 },
    rateLimits: { maxConcurrentDispatches: 4 },
    timeoutSeconds: 1800,
    memory: '1GiB',
    secrets: SECRETOS_CONECTORES,
  },
  async (solicitud) => {
    await ejecutarTarea(getFirestore(), solicitud.data, {
      ahora: () => new Date(),
      ultimoIntento: solicitud.retryCount >= MAX_INTENTOS_TAREA - 1,
      api: dependenciasApi(),
    });
  },
);
