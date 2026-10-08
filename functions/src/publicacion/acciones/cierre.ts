import {
  analizarUrlPublica,
  ESTADOS_CANCELABLES,
  ETIQUETAS_RED,
  leerDestino,
  sePuedeEliminar,
  type Platform,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { leerPublicacionCompleta, refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';

const noExiste = () => new HttpsError('not-found', 'La publicación no existe.');
const precondicion = (mensaje: string) => new HttpsError('failed-precondition', mensaje);

export async function cancelarPublicacion(postId: string, deps: DependenciasAccion): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  await db.runTransaction(async (tx) => {
    const completa = await leerPublicacionCompleta(db, postId, tx);
    if (!completa) throw noExiste();
    const cancelables = completa.destinos.filter((d) => ESTADOS_CANCELABLES.has(d.status));
    if (cancelables.length === 0) throw precondicion('No hay destinos que cancelar.');
    for (const destino of cancelables) {
      tx.update(refDestino(db, postId, destino.platform), { status: 'cancelada', statusChangedAt: ahora });
    }
  });
  return { postId };
}

export async function eliminarPublicacion(postId: string, deps: DependenciasAccion): Promise<RespuestaPublicaciones> {
  const { db } = deps;
  const completa = await leerPublicacionCompleta(db, postId);
  if (!completa) throw noExiste();
  if (!sePuedeEliminar(completa.destinos.map((d) => d.status))) {
    throw precondicion('No se puede eliminar una publicación publicada o en curso.');
  }
  const hijas = await db.collection('posts').where('parentId', '==', postId).count().get();
  if (hijas.data().count > 0) throw precondicion('Esta publicación tiene Hijas. Desvincúlalas antes de eliminarla.');
  // Las tareas pendientes de esta publicación terminarán como 'inexistente'.
  await db.recursiveDelete(refPublicacion(db, postId));
  return { postId };
}

export async function desvincularHija(postId: string, deps: DependenciasAccion): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  await db.runTransaction(async (tx) => {
    const completa = await leerPublicacionCompleta(db, postId, tx);
    if (!completa) throw noExiste();
    if (completa.publicacion.kind !== 'hija') throw precondicion('Esta publicación no pertenece a un video principal.');
    tx.update(refPublicacion(db, postId), { kind: 'independiente', parentId: FieldValue.delete(), updatedAt: ahora });
    for (const destino of completa.destinos) {
      if (destino.parentRef.status === 'en_espera' || destino.parentRef.status === 'pendiente') {
        tx.update(refDestino(db, postId, destino.platform), { 'parentRef.status': 'no_aplica' });
      }
    }
  });
  return { postId };
}

export async function marcarPublicada(
  postId: string,
  red: Platform,
  url: string,
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db, ahora } = deps;
  const remoto = analizarUrlPublica(red, url);
  const ref = refDestino(db, postId, red);
  await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists) throw noExiste();
    const destino = leerDestino(actual.data());
    if (destino.status !== 'pendiente_manual') {
      throw precondicion('Este destino no está pendiente de publicación manual.');
    }
    if (!remoto) {
      throw new HttpsError('invalid-argument', `La URL no corresponde a una publicación de ${ETIQUETAS_RED[red]}.`);
    }
    tx.update(ref, {
      status: 'publicada',
      statusChangedAt: ahora,
      remote: { ...remoto, publishedAt: ahora },
      // En TikTok la referencia al Principal va en la descripción: queda publicada junto con el video.
      ...(red === 'tiktok' && destino.parentRef.status !== 'no_aplica' ? { 'parentRef.status': 'publicada' } : {}),
    });
  });
  return { postId };
}

export async function marcarReferencia(
  postId: string,
  red: Platform,
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db } = deps;
  const ref = refDestino(db, postId, red);
  await db.runTransaction(async (tx) => {
    const actual = await tx.get(ref);
    if (!actual.exists) throw noExiste();
    if (leerDestino(actual.data()).parentRef.status !== 'pendiente')
      throw precondicion('La referencia no está pendiente.');
    tx.update(ref, { 'parentRef.status': 'publicada' });
  });
  return { postId };
}
