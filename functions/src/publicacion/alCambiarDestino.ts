import {
  asignarHija,
  avisoDe,
  estadoPublicacion,
  fechaBasePromocion,
  idReferencia,
  leerAjustes,
  leerConexion,
  leerDestino,
  leerPublicacion,
  puedeComentarPorApi,
  recalcularFechas,
  type Conexion,
  type Destino,
  type Platform,
} from '@omnistream/core';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { REGION } from '../config';
import { encoladorReferencias, type TareaReferencia } from './comentarReferencia';
import { leerPublicacionCompleta, refDestino, refPublicacion } from './firestore';
import { purgarSiTerminal } from './limpiarRetencion';
import { crearNotificador, enviarPushFcm, type Notificador } from './notificaciones';

export interface DependenciasCambio {
  notificar: Notificador;
  encolarReferencia(tarea: TareaReferencia, id: string): Promise<void>;
  conexion(red: Platform): Promise<Conexion>;
  purgar?(assetId: string): Promise<boolean>;
  ahora?(): Date;
}

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

// Activa la referencia que esperaba la URL del Principal. Con permiso para comentar por API la deja en 'publicando'
// y encola el comentario; si no, pasa a 'pendiente'. Devuelve si hay que avisar para hacerla a mano.
async function activarReferencia(
  db: Firestore,
  postId: string,
  red: Platform,
  deps: DependenciasCambio,
): Promise<boolean> {
  const porApi = puedeComentarPorApi(await deps.conexion(red));
  const ref = refDestino(db, postId, red);
  const version = await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists) return null;
    const destino = leerDestino(actual.data());
    if (destino.parentRef.status !== 'en_espera') return null;
    tx.update(ref, { 'parentRef.status': porApi ? 'publicando' : 'pendiente' });
    return destino.scheduleVersion;
  });
  if (version === null) return false;
  if (!porApi) return true;
  try {
    await deps.encolarReferencia({ postId, platform: red }, idReferencia(postId, red, version));
    return false;
  } catch (error) {
    logger.error('No se pudo encolar la referencia', { postId, red, error: String(error) });
    await ref.update({ 'parentRef.status': 'pendiente' });
    return true;
  }
}

// El Principal cuenta como publicado cuando su video ya es visible: uno importado y programado en YouTube tiene
// remote desde el inicio, pero con publishedAt en el futuro.
const yaPublicado = (destino: Destino | undefined, ahora: Date): boolean =>
  destino?.remote !== undefined && destino.remote.publishedAt.getTime() <= ahora.getTime();

async function principalPublicado(db: Firestore, principalId: string, ahora: Date): Promise<boolean> {
  const youtube = await refDestino(db, principalId, 'youtube').get();
  return youtube.exists && yaPublicado(leerDestino(youtube.data()), ahora);
}

// Las Hijas ya publicadas que esperaban la URL del Principal activan su referencia.
export async function activarReferenciasDeHijas(
  db: Firestore,
  principalId: string,
  deps: DependenciasCambio,
  idEvento: string,
): Promise<void> {
  const hijas = await db.collection('posts').where('parentId', '==', principalId).get();
  for (const hija of hijas.docs) {
    const destinosHija = await hija.ref.collection('targets').get();
    for (const documento of destinosHija.docs) {
      const destino = leerDestino(documento.data());
      if (destino.status !== 'publicada' || destino.platform === 'tiktok') continue;
      if (destino.parentRef.status !== 'en_espera') continue;
      if (await activarReferencia(db, hija.id, destino.platform, deps)) {
        await deps.notificar(
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

// Mover o publicar el video de YouTube del Principal mueve las fechas no editadas de su lista de promoción.
async function recalcularPromocion(db: Firestore, postId: string, youtube: Destino): Promise<void> {
  const ref = refPublicacion(db, postId);
  await db.runTransaction(async (tx) => {
    const documento = await tx.get(ref);
    if (!documento.exists) return;
    const publicacion = leerPublicacion(documento.id, documento.data());
    const items = publicacion.promotion?.items;
    if (publicacion.kind !== 'principal' || !items) return;
    const nuevos = recalcularFechas(items, fechaBasePromocion(publicacion, youtube));
    if (nuevos.some((item, i) => item !== items[i])) tx.update(ref, { 'promotion.items': nuevos });
  });
}

// Una Hija publicada cumple el siguiente short pendiente de su Principal.
async function cumplirShort(db: Firestore, principalId: string, hijaId: string): Promise<void> {
  const ref = refPublicacion(db, principalId);
  await db.runTransaction(async (tx) => {
    const documento = await tx.get(ref);
    if (!documento.exists) return;
    const items = leerPublicacion(documento.id, documento.data()).promotion?.items;
    if (!items) return;
    const nuevos = asignarHija(items, hijaId);
    if (nuevos !== items) tx.update(ref, { 'promotion.items': nuevos });
  });
}

const TERMINALES = new Set(['publicada', 'cancelada']);

export async function reaccionarACambio(db: Firestore, cambio: CambioDestino, deps: DependenciasCambio): Promise<void> {
  const { postId, platform, antes, despues, idEvento } = cambio;
  const { notificar } = deps;
  const ahora = deps.ahora?.() ?? new Date();
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

  if (publicacion.kind === 'principal' && platform === 'youtube' && despues && publicacion.promotion) {
    await recalcularPromocion(db, postId, despues);
  }

  if (!despues || antes?.status === despues.status) return;
  const datos = { postId, titulo: publicacion.title, platform };

  if (despues.status === 'pendiente_manual') {
    await notificar(idEvento, avisoDe('pendiente_manual', datos));
  } else if (despues.status === 'fallida') {
    await notificar(idEvento, avisoDe('fallo', { ...datos, error: despues.lastError?.message }));
  } else if (despues.status === 'publicada') {
    if (publicacion.kind === 'hija' && publicacion.parentId) {
      await cumplirShort(db, publicacion.parentId, postId);
      // Una Hija publicada cuando su Principal ya está visible: su referencia queda lista para publicarse.
      if (
        platform !== 'tiktok' &&
        despues.parentRef.status === 'en_espera' &&
        (await principalPublicado(db, publicacion.parentId, ahora)) &&
        (await activarReferencia(db, postId, platform, deps))
      ) {
        await notificar(`${idEvento}-ref`, avisoDe('referencia', datos));
      }
    }

    // Al publicarse el Principal en YouTube, las Hijas ya publicadas que esperaban su URL activan su referencia.
    // Si el video está programado para después, lo hace encolarPendientes al llegar la hora.
    if (publicacion.kind === 'principal' && platform === 'youtube' && yaPublicado(despues, ahora)) {
      await activarReferenciasDeHijas(db, postId, deps, idEvento);
    }
  }

  // Con retención de 0 días el original se borra en cuanto todos sus destinos quedan terminales.
  if (TERMINALES.has(despues.status) && publicacion.assetId && deps.purgar) {
    const { retentionDays } = leerAjustes((await db.doc('settings/app').get()).data());
    if (retentionDays === 0) await deps.purgar(publicacion.assetId);
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
      {
        notificar: crearNotificador(db, enviarPushFcm()),
        encolarReferencia: encoladorReferencias(),
        conexion: async (red) => leerConexion(red, (await db.collection('connections').doc(red).get()).data()),
        purgar: (assetId) => purgarSiTerminal(db, getStorage().bucket(), assetId, new Date()),
      },
    );
  },
);
