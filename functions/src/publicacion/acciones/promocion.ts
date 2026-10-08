import { randomUUID } from 'node:crypto';
import {
  crearPromocion,
  fechaBasePromocion,
  leerAjustes,
  leerDestino,
  leerPublicacion,
  type AccionPublicacion,
  type Destino,
  type ItemPromocion,
  type RespuestaPublicaciones,
} from '@omnistream/core';
import type { Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { refDestino, refPublicacion } from '../firestore';
import type { DependenciasAccion } from './dependencias';

const DIA_MS = 24 * 60 * 60 * 1000;

// Lista inicial de un Principal con la plantilla de Ajustes (o la de por defecto).
export async function promocionInicial(db: Firestore, base: Date | null): Promise<ItemPromocion[]> {
  const { promotionTemplate } = leerAjustes((await db.doc('settings/app').get()).data());
  return crearPromocion(promotionTemplate, base, randomUUID);
}

async function destinoYoutube(db: Firestore, postId: string): Promise<Destino | undefined> {
  const documento = await refDestino(db, postId, 'youtube').get();
  return documento.exists ? leerDestino(documento.data()) : undefined;
}

// Reemplaza la lista. Las fechas no editadas se recalculan con la fecha base actual; un item conserva su aviso
// solo si su fecha no cambió.
export async function actualizarPromocion(
  postId: string,
  items: Extract<AccionPublicacion, { accion: 'actualizarPromocion' }>['items'],
  deps: DependenciasAccion,
): Promise<RespuestaPublicaciones> {
  const { db } = deps;
  const ref = refPublicacion(db, postId);
  const youtube = await destinoYoutube(db, postId);
  await db.runTransaction(async (tx) => {
    const documento = await tx.get(ref);
    if (!documento.exists) throw new HttpsError('not-found', 'La publicación no existe.');
    const publicacion = leerPublicacion(documento.id, documento.data());
    if (publicacion.kind !== 'principal')
      throw new HttpsError('failed-precondition', 'Solo un video principal tiene lista de promoción.');
    const base = fechaBasePromocion(publicacion, youtube);
    const anteriores = new Map((publicacion.promotion?.items ?? []).map((i) => [i.id, i]));
    const nuevos = items.map((entrada): ItemPromocion => {
      const dueAt = entrada.dueAtEdited
        ? entrada.dueAt
          ? new Date(entrada.dueAt)
          : null
        : base
          ? new Date(base.getTime() + entrada.offsetDays * DIA_MS)
          : null;
      const item: ItemPromocion = {
        id: entrada.id,
        type: entrada.type,
        title: entrada.title,
        offsetDays: entrada.offsetDays,
        dueAt,
        dueAtEdited: entrada.dueAtEdited,
        status: entrada.status,
      };
      if (entrada.hijaId) item.hijaId = entrada.hijaId;
      if (entrada.note) item.note = entrada.note;
      const anterior = anteriores.get(entrada.id);
      if (anterior?.notifiedAt && (anterior.dueAt?.getTime() ?? null) === (dueAt?.getTime() ?? null)) {
        item.notifiedAt = anterior.notifiedAt;
      }
      return item;
    });
    tx.update(ref, { 'promotion.items': nuevos, updatedAt: deps.ahora });
  });
  return { postId };
}
