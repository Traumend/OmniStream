import {
  esEditable,
  mensajeProblemas,
  validarPublicacion,
  type Destino,
  type Platform,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { HttpsError } from 'firebase-functions/v2/https';
import { encolarDestino } from '../cola';
import { leerContexto, leerModos, leerPublicacionCompleta, refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';

type DestinoAEncolar = Pick<Destino, 'platform' | 'scheduleVersion' | 'scheduledAt' | 'attempts'>;

const noExiste = () => new HttpsError('not-found', 'La publicación no existe.');
const estados = (destinos: readonly Destino[]) => destinos.map((d) => d.status);

// Un fallo al encolar no deshace la programación: encolarPendientes lo recupera en su siguiente ejecución.
export async function encolarTodos(
  db: Firestore,
  postId: string,
  destinos: readonly DestinoAEncolar[],
  deps: DependenciasAccion,
): Promise<void> {
  for (const destino of destinos) {
    try {
      await encolarDestino(db, postId, destino, deps.encolar, deps.ahora);
    } catch (error) {
      logger.error('No se pudo encolar el destino', { postId, platform: destino.platform, error: String(error) });
    }
  }
}

export async function programarPublicacion(
  postId: string,
  inmediata: boolean,
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  const completa = await leerPublicacionCompleta(db, postId);
  if (!completa) throw noExiste();
  const { publicacion, destinos } = completa;
  if (!esEditable(estados(destinos))) {
    throw new HttpsError('failed-precondition', 'Esta publicación ya no se puede programar.');
  }

  const contexto = await leerContexto(db, publicacion);
  const errores = validarPublicacion({
    publicacion,
    destinos,
    asset: contexto.asset,
    principal: contexto.principal,
    tipoActual: publicacion.kind,
    numeroDeHijas: contexto.numeroDeHijas,
    ahora,
    hora: inmediata ? 'inmediata' : 'programada',
  }).filter((p) => p.nivel === 'error');
  if (errores.length > 0) throw new HttpsError('failed-precondition', mensajeProblemas(errores));

  const modos = await leerModos(
    db,
    destinos.map((d) => d.platform),
  );
  const hora = inmediata ? ahora : (publicacion.scheduledAt ?? ahora);

  const programados = await db.runTransaction(async (tx) => {
    const fresca = await leerPublicacionCompleta(db, postId, tx);
    if (!fresca) throw noExiste();
    if (!esEditable(estados(fresca.destinos))) {
      throw new HttpsError('failed-precondition', 'Esta publicación ya no se puede programar.');
    }
    const resultado: DestinoAEncolar[] = [];
    for (const destino of fresca.destinos) {
      const scheduleVersion = destino.scheduleVersion + 1;
      const scheduledAt = inmediata ? ahora : (destino.overrides.scheduledAt ?? hora);
      tx.update(refDestino(db, postId, destino.platform), {
        status: 'programada',
        scheduleVersion,
        publishMode: modos[destino.platform],
        scheduledAt,
        statusChangedAt: ahora,
        lease: FieldValue.delete(),
        checkpoint: FieldValue.delete(),
        lastError: FieldValue.delete(),
      });
      resultado.push({ platform: destino.platform, scheduleVersion, scheduledAt, attempts: destino.attempts });
    }
    if (inmediata) tx.update(refPublicacion(db, postId), { scheduledAt: ahora, updatedAt: ahora });
    return resultado;
  });

  await encolarTodos(db, postId, programados, deps);
  return { postId };
}

export async function moverPublicacion(
  postId: string,
  nuevaFecha: Date,
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  if (nuevaFecha.getTime() <= ahora.getTime())
    throw new HttpsError('failed-precondition', 'No se puede mover al pasado.');

  const programados = await db.runTransaction(async (tx) => {
    const completa = await leerPublicacionCompleta(db, postId, tx);
    if (!completa) throw noExiste();
    if (!esEditable(estados(completa.destinos))) {
      throw new HttpsError('failed-precondition', 'Esta publicación ya no se puede mover.');
    }
    tx.update(refPublicacion(db, postId), { scheduledAt: nuevaFecha, updatedAt: ahora });
    const resultado: DestinoAEncolar[] = [];
    for (const destino of completa.destinos) {
      if (destino.overrides.scheduledAt) continue;
      const cambios: Record<string, unknown> = { scheduledAt: nuevaFecha };
      if (destino.status === 'programada') {
        const scheduleVersion = destino.scheduleVersion + 1;
        Object.assign(cambios, { scheduleVersion, statusChangedAt: ahora });
        resultado.push({
          platform: destino.platform,
          scheduleVersion,
          scheduledAt: nuevaFecha,
          attempts: destino.attempts,
        });
      }
      tx.update(refDestino(db, postId, destino.platform as Platform), cambios);
    }
    return resultado;
  });

  await encolarTodos(db, postId, programados, deps);
  return { postId };
}
