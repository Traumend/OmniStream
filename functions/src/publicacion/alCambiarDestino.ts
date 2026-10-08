import { avisoDe, estadoPublicacion, leerDestino, type Destino, type Platform } from '@omnistream/core';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { REGION } from '../config';
import { leerPublicacionCompleta, refDestino, refPublicacion } from './firestore';
import { crearNotificador, enviarPushFcm, type Notificador } from './notificaciones';

export interface CambioDestino {
  postId: string;
  platform: Platform;
  antes: Destino | null;
  despues: Destino | null;
  idEvento: string;
}

const claveOrdenada = (objeto: Record<string, unknown>) =>
  JSON.stringify(
    Object.keys(objeto)
      .sort()
      .map((k) => [k, objeto[k]]),
  );

// Pasa la referencia de en_espera a pendiente; devuelve si la cambió (solo entonces se avisa).
async function activarReferencia(db: Firestore, postId: string, red: Platform): Promise<boolean> {
  const ref = refDestino(db, postId, red);
  return db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists || leerDestino(actual.data()).parentRef.status !== 'en_espera') return false;
    tx.update(ref, { 'parentRef.status': 'pendiente' });
    return true;
  });
}

async function principalPublicado(db: Firestore, principalId: string): Promise<boolean> {
  const youtube = await refDestino(db, principalId, 'youtube').get();
  return youtube.exists && leerDestino(youtube.data()).remote !== undefined;
}

export async function reaccionarACambio(db: Firestore, cambio: CambioDestino, notificar: Notificador): Promise<void> {
  const { postId, platform, antes, despues, idEvento } = cambio;
  const completa = await leerPublicacionCompleta(db, postId);
  if (!completa) return;
  const { publicacion, destinos } = completa;

  const status = estadoPublicacion(
    destinos.map((d) => d.status),
    publicacion.status,
  );
  const targetStatus = Object.fromEntries(destinos.map((d) => [d.platform, d.status]));
  if (status !== publicacion.status || claveOrdenada(targetStatus) !== claveOrdenada(publicacion.targetStatus)) {
    await refPublicacion(db, postId).update({ status, targetStatus });
  }

  if (!despues || antes?.status === despues.status) return;
  const datos = { postId, titulo: publicacion.title, platform };

  if (despues.status === 'pendiente_manual') {
    await notificar(idEvento, avisoDe('pendiente_manual', datos));
  } else if (despues.status === 'fallida') {
    await notificar(idEvento, avisoDe('fallo', { ...datos, error: despues.lastError?.message }));
  } else if (despues.status === 'publicada') {
    // Una Hija publicada cuando su Principal ya tiene URL: su referencia queda lista para publicarse.
    if (
      publicacion.kind === 'hija' &&
      publicacion.parentId &&
      platform !== 'tiktok' &&
      despues.parentRef.status === 'en_espera' &&
      (await principalPublicado(db, publicacion.parentId)) &&
      (await activarReferencia(db, postId, platform))
    ) {
      await notificar(`${idEvento}-ref`, avisoDe('referencia', datos));
    }

    // Al publicarse el Principal en YouTube, las Hijas ya publicadas que esperaban su URL pasan a pendiente.
    if (publicacion.kind === 'principal' && platform === 'youtube') {
      const hijas = await db.collection('posts').where('parentId', '==', postId).get();
      for (const hija of hijas.docs) {
        const destinosHija = await hija.ref.collection('targets').get();
        for (const documento of destinosHija.docs) {
          const destino = leerDestino(documento.data());
          if (destino.status !== 'publicada' || destino.platform === 'tiktok') continue;
          if (destino.parentRef.status !== 'en_espera') continue;
          if (await activarReferencia(db, hija.id, destino.platform)) {
            await notificar(
              `${idEvento}-${hija.id}-${destino.platform}`,
              avisoDe('referencia', {
                postId: hija.id,
                titulo: String(hija.get('title') ?? ''),
                platform: destino.platform,
              }),
            );
          }
        }
      }
    }
  }
}

export const alCambiarDestino = onDocumentWritten(
  { document: 'posts/{postId}/targets/{platform}', region: REGION },
  async (evento) => {
    const antes = evento.data?.before.exists ? leerDestino(evento.data.before.data()) : null;
    const despues = evento.data?.after.exists ? leerDestino(evento.data.after.data()) : null;
    const db = getFirestore();
    await reaccionarACambio(
      db,
      {
        postId: evento.params.postId,
        platform: evento.params.platform as Platform,
        antes,
        despues,
        idEvento: evento.id,
      },
      crearNotificador(db, enviarPushFcm()),
    );
  },
);
