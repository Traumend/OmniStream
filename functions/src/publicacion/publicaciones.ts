import { accionPublicacionSchema, type AccionPublicacion, type RespuestaPublicaciones } from '@omnistream/core';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { REGION } from '../config';
import type { DependenciasAccion } from './acciones/dependencias';
import { guardarPublicacion } from './acciones/guardar';
import {
  cancelarPublicacion,
  desvincularHija,
  eliminarPublicacion,
  marcarPublicada,
  marcarReferencia,
} from './acciones/cierre';
import { moverPublicacion, programarPublicacion, reintentarDestino } from './acciones/programar';
import { exigirPropietario } from './autorizacion';
import { encoladorCloudTasks } from './cola';

export type ManejadoresAccion = {
  [K in AccionPublicacion['accion']]?: (
    accion: Extract<AccionPublicacion, { accion: K }>,
  ) => Promise<RespuestaPublicaciones>;
};

export async function despacharAccion(
  auth: { token?: Record<string, unknown> } | undefined,
  datos: unknown,
  manejadores: ManejadoresAccion,
): Promise<RespuestaPublicaciones> {
  exigirPropietario(auth);
  const resultado = accionPublicacionSchema.safeParse(datos);
  if (!resultado.success) {
    throw new HttpsError('invalid-argument', resultado.error.issues[0]?.message ?? 'Datos inválidos.');
  }
  const accion = resultado.data;
  const manejador = manejadores[accion.accion] as
    ((a: AccionPublicacion) => Promise<RespuestaPublicaciones>) | undefined;
  if (!manejador) throw new HttpsError('unimplemented', 'Acción no disponible.');
  return manejador(accion);
}

export function crearManejadores(deps: DependenciasAccion): ManejadoresAccion {
  return {
    guardar: (a) => guardarPublicacion(a.publicacion, deps),
    programar: (a) => programarPublicacion(a.postId, a.inmediata, deps),
    mover: (a) => moverPublicacion(a.postId, new Date(a.scheduledAt), deps),
    cancelar: (a) => cancelarPublicacion(a.postId, deps),
    reintentar: (a) => reintentarDestino(a.postId, a.platform, deps),
    eliminar: (a) => eliminarPublicacion(a.postId, deps),
    desvincular: (a) => desvincularHija(a.postId, deps),
    marcarPublicada: (a) => marcarPublicada(a.postId, a.platform, a.url, deps),
    marcarReferencia: (a) => marcarReferencia(a.postId, a.platform, deps),
  };
}

export const publicaciones = onCall({ region: REGION, memory: '512MiB', timeoutSeconds: 60 }, (solicitud) =>
  despacharAccion(
    solicitud.auth,
    solicitud.data,
    crearManejadores({ db: getFirestore(), ahora: new Date(), encolar: encoladorCloudTasks() }),
  ),
);
