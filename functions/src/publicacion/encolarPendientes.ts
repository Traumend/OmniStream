import {
  avisoPromocion,
  estaAtascado,
  estaVencida,
  leerConexion,
  leerDestino,
  leerPublicacion,
  necesitaEncolarse,
  vencidosSinAviso,
  VENTANA_COLA_MS,
  type Destino,
} from '@omnistream/core';
import { FieldValue, getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { REGION } from '../config';
import { activarReferenciasDeHijas, type DependenciasCambio } from './alCambiarDestino';
import { encolarDestino, encoladorCloudTasks, type Encolador } from './cola';
import { encoladorReferencias } from './comentarReferencia';
import { crearNotificador, enviarPushFcm, type Notificador } from './notificaciones';

interface DependenciasEncolado {
  db: Firestore;
  encolar: Encolador;
  ahora: Date;
  // Para las referencias que esperaban un Principal programado y los avisos de promoción.
  cambio?: DependenciasCambio;
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

  if (deps.cambio) {
    await liberarPrincipalesEnEspera(db, deps.cambio, ahora);
    await avisarPromocion(db, deps.cambio.notificar, ahora);
  }
  return { encolados, recuperados };
}

// Un Principal importado y programado en YouTube ya se publicó: sus Hijas activan la referencia.
async function liberarPrincipalesEnEspera(db: Firestore, cambio: DependenciasCambio, ahora: Date): Promise<void> {
  const enEspera = await db.collection('posts').where('awaitingPublicationUntil', '<=', ahora).get();
  for (const principal of enEspera.docs) {
    try {
      await activarReferenciasDeHijas(db, principal.id, cambio, `espera-${principal.id}`);
      await principal.ref.update({ awaitingPublicationUntil: FieldValue.delete() });
    } catch (error) {
      logger.error('No se pudieron activar las referencias del Principal', {
        postId: principal.id,
        error: String(error),
      });
    }
  }
}

// Avisa una sola vez cada pendiente de promoción vencido: el id del aviso y notifiedAt evitan repetirlo.
export async function avisarPromocion(db: Firestore, notificar: Notificador, ahora: Date): Promise<number> {
  const principales = await db.collection('posts').where('kind', '==', 'principal').get();
  let avisados = 0;
  for (const documento of principales.docs) {
    const publicacion = leerPublicacion(documento.id, documento.data());
    const vencidos = vencidosSinAviso(publicacion.promotion?.items ?? [], ahora);
    for (const item of vencidos) {
      try {
        await notificar(
          // La fecha va en el id: un pendiente que cambió de fecha vuelve a avisar una vez.
          `promocion-${publicacion.id}-${item.id}-${item.dueAt?.getTime() ?? 0}`,
          avisoPromocion({ postId: publicacion.id, tituloPrincipal: publicacion.title, item }),
        );
        await db.runTransaction(async (tx) => {
          const actual = await tx.get(documento.ref);
          const items = leerPublicacion(actual.id, actual.data()).promotion?.items;
          if (!items) return;
          tx.update(documento.ref, {
            'promotion.items': items.map((i) => (i.id === item.id && !i.notifiedAt ? { ...i, notifiedAt: ahora } : i)),
          });
        });
        avisados++;
      } catch (error) {
        logger.error('No se pudo avisar la promoción', {
          postId: publicacion.id,
          itemId: item.id,
          error: String(error),
        });
      }
    }
  }
  return avisados;
}

export const encolarPendientes = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'UTC', region: REGION },
  async () => {
    const db = getFirestore();
    await encolarPendientesAhora({
      db,
      encolar: encoladorCloudTasks(),
      ahora: new Date(),
      cambio: {
        notificar: crearNotificador(db, enviarPushFcm()),
        encolarReferencia: encoladorReferencias(),
        conexion: async (red) => leerConexion(red, (await db.collection('connections').doc(red).get()).data()),
      },
    });
  },
);
