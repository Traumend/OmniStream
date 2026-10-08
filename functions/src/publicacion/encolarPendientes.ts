import {
  estaAtascado,
  estaVencida,
  leerDestino,
  necesitaEncolarse,
  VENTANA_COLA_MS,
  type Destino,
} from '@omnistream/core';
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { REGION } from '../config';
import { encolarDestino, encoladorCloudTasks, type Encolador } from './cola';

interface DependenciasEncolado {
  db: Firestore;
  encolar: Encolador;
  ahora: Date;
}

const postIdDe = (documento: QueryDocumentSnapshot) => documento.ref.parent.parent?.id;

async function encolarCada(
  documentos: readonly QueryDocumentSnapshot[],
  incluir: (destino: Destino) => boolean,
  deps: DependenciasEncolado,
  recuperacion: boolean,
): Promise<number> {
  let total = 0;
  for (const documento of documentos) {
    const postId = postIdDe(documento);
    const destino = leerDestino(documento.data());
    if (!postId || !incluir(destino)) continue;
    try {
      if (await encolarDestino(deps.db, postId, destino, deps.encolar, deps.ahora, recuperacion)) total++;
    } catch (error) {
      logger.error('No se pudo encolar el destino', { postId, platform: destino.platform, error: String(error) });
    }
  }
  return total;
}

// Encola lo que entra en la ventana de Cloud Tasks y recupera los destinos cuyo intento quedó sin lease vigente
// o cuya tarea encolada nunca los tomó.
export async function encolarPendientesAhora(
  deps: DependenciasEncolado,
): Promise<{ encolados: number; recuperados: number }> {
  const { db, ahora } = deps;
  const destinos = db.collectionGroup('targets');
  const [programados, publicando] = await Promise.all([
    destinos
      .where('status', '==', 'programada')
      .where('scheduledAt', '<=', new Date(ahora.getTime() + VENTANA_COLA_MS))
      .orderBy('scheduledAt')
      .get(),
    destinos.where('status', '==', 'publicando').orderBy('scheduledAt').get(),
  ]);
  const encolados = await encolarCada(programados.docs, (d) => necesitaEncolarse(d, ahora), deps, false);
  const recuperados =
    (await encolarCada(programados.docs, (d) => estaVencida(d, ahora), deps, true)) +
    (await encolarCada(publicando.docs, (d) => estaAtascado(d, ahora), deps, true));
  if (encolados + recuperados > 0) logger.info('Destinos encolados', { encolados, recuperados });
  return { encolados, recuperados };
}

export const encolarPendientes = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'UTC', region: REGION },
  async () => {
    await encolarPendientesAhora({ db: getFirestore(), encolar: encoladorCloudTasks(), ahora: new Date() });
  },
);
