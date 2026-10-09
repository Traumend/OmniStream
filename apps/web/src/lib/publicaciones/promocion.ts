'use client';

import { leerPublicacion, proximos, type ItemPromocion } from '@omnistream/core';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { obtenerFirebase } from '@/lib/firebase/cliente';

export interface PromocionPendiente {
  postId: string;
  tituloPrincipal: string;
  item: ItemPromocion;
  vencido: boolean;
}

// Pendientes de promoción vencidos y de los próximos 7 días de todos los Principales, por fecha.
export function usePromocionesPendientes(ahora: Date = new Date()): PromocionPendiente[] {
  const [principales, setPrincipales] = useState<ReturnType<typeof leerPublicacion>[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(obtenerFirebase().db, 'posts'), where('kind', '==', 'principal')), (resultado) =>
        setPrincipales(resultado.docs.map((d) => leerPublicacion(d.id, d.data()))),
      ),
    [],
  );
  const momento = ahora.getTime();
  return principales
    .flatMap((principal) =>
      proximos(principal.promotion?.items ?? [], new Date(momento)).map((item) => ({
        postId: principal.id,
        tituloPrincipal: principal.title,
        item,
        vencido: (item.dueAt?.getTime() ?? Infinity) <= momento,
      })),
    )
    .sort((a, b) => (a.item.dueAt?.getTime() ?? 0) - (b.item.dueAt?.getTime() ?? 0));
}
