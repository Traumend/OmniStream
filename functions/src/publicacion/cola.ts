import { idTarea, VENTANA_COLA_MS, type Destino, type Platform } from '@omnistream/core';
import type { Firestore } from 'firebase-admin/firestore';
import { getFunctions } from 'firebase-admin/functions';
import { REGION } from '../config';
import { refDestino } from './firestore';

export interface TareaPublicacion {
  postId: string;
  platform: Platform;
  scheduleVersion: number;
}

export type Encolador = (tarea: TareaPublicacion, opciones: { id: string; scheduleTime?: Date }) => Promise<void>;

export function encoladorCloudTasks(): Encolador {
  const cola = getFunctions().taskQueue<TareaPublicacion>(`locations/${REGION}/functions/publicarDestino`);
  return async (tarea, { id, scheduleTime }) => {
    try {
      await cola.enqueue(tarea, scheduleTime ? { id, scheduleTime } : { id });
    } catch (error) {
      // El id incluye la versión: si ya existe, esa versión ya está en la cola.
      if (!String((error as { code?: string }).code).endsWith('task-already-exists')) throw error;
    }
  };
}

export async function encolarDestino(
  db: Firestore,
  postId: string,
  destino: Pick<Destino, 'platform' | 'scheduleVersion' | 'scheduledAt' | 'attempts'>,
  encolar: Encolador,
  ahora: Date,
  recuperacion = false,
): Promise<boolean> {
  const hora = destino.scheduledAt ?? ahora;
  if (hora.getTime() - ahora.getTime() > VENTANA_COLA_MS) return false;
  const version = destino.scheduleVersion;
  const id = idTarea(postId, destino.platform, version, recuperacion ? destino.attempts : undefined);
  await encolar(
    { postId, platform: destino.platform, scheduleVersion: version },
    hora.getTime() > ahora.getTime() ? { id, scheduleTime: hora } : { id },
  );
  const ref = refDestino(db, postId, destino.platform);
  await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (actual.exists && actual.get('scheduleVersion') === version) tx.update(ref, { enqueuedVersion: version });
  });
  return true;
}
