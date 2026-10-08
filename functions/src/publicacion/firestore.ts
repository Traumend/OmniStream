import {
  leerConexion,
  leerDestino,
  leerPublicacion,
  modoDePublicacion,
  type Asset,
  type Destino,
  type ModoPublicacion,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import type { DocumentReference, Firestore, Transaction } from 'firebase-admin/firestore';

export const refPublicacion = (db: Firestore, postId: string): DocumentReference => db.collection('posts').doc(postId);

export const refDestino = (db: Firestore, postId: string, red: Platform): DocumentReference =>
  refPublicacion(db, postId).collection('targets').doc(red);

export interface PublicacionCompleta {
  publicacion: Publicacion;
  destinos: Destino[];
}

export async function leerPublicacionCompleta(
  db: Firestore,
  postId: string,
  tx?: Transaction,
): Promise<PublicacionCompleta | null> {
  const ref = refPublicacion(db, postId);
  const coleccion = ref.collection('targets');
  const [post, destinos] = tx
    ? await Promise.all([tx.get(ref), tx.get(coleccion)])
    : await Promise.all([ref.get(), coleccion.get()]);
  if (!post.exists) return null;
  return {
    publicacion: leerPublicacion(post.id, post.data()),
    destinos: destinos.docs.map((d) => leerDestino(d.data())),
  };
}

const aFecha = (valor: unknown): Date | undefined =>
  typeof (valor as { toDate?: unknown } | undefined)?.toDate === 'function'
    ? (valor as { toDate(): Date }).toDate()
    : undefined;

export function leerAsset(id: string, datos: unknown): Asset {
  const d = (datos ?? {}) as Record<string, unknown>;
  return {
    ...(d as unknown as Asset),
    id,
    createdAt: aFecha(d.createdAt) ?? new Date(0),
    purgeAt: aFecha(d.purgeAt),
  };
}

export interface ContextoPublicacion {
  asset: Asset | null;
  principal: Publicacion | null;
  numeroDeHijas: number;
}

export async function leerContexto(
  db: Firestore,
  publicacion: Pick<Publicacion, 'id' | 'assetId' | 'parentId'>,
): Promise<ContextoPublicacion> {
  const [asset, principal, hijas] = await Promise.all([
    publicacion.assetId ? db.collection('assets').doc(publicacion.assetId).get() : null,
    publicacion.parentId ? refPublicacion(db, publicacion.parentId).get() : null,
    db.collection('posts').where('parentId', '==', publicacion.id).count().get(),
  ]);
  return {
    asset: asset?.exists ? leerAsset(asset.id, asset.data()) : null,
    principal: principal?.exists ? leerPublicacion(principal.id, principal.data()) : null,
    numeroDeHijas: hijas.data().count,
  };
}

// Modo efectivo de cada destino según su conexión y su formato (TikTok imagen exige el dominio verificado).
export async function leerModos(
  db: Firestore,
  destinos: readonly Pick<Destino, 'platform' | 'format'>[],
): Promise<Partial<Record<Platform, ModoPublicacion>>> {
  if (destinos.length === 0) return {};
  const conexiones = await db.getAll(...destinos.map((d) => db.collection('connections').doc(d.platform)));
  return Object.fromEntries(
    destinos.map((destino, i) => [
      destino.platform,
      modoDePublicacion(leerConexion(destino.platform, conexiones[i]?.data()), destino.format),
    ]),
  );
}
