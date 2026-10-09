import {
  esEditable,
  type EstadoDestino,
  type EstadoPublicacion,
  type Platform,
  type Publicacion,
} from '@omnistream/core';

export interface EventoPublicacion {
  id: string;
  title: string;
  start: Date;
  editable: boolean;
  classNames: string[];
  extendedProps: { status: EstadoPublicacion; targetStatus: Partial<Record<Platform, EstadoDestino>> };
}

// Solo se arrastra lo que todavía se puede editar y está en el futuro (spec 8.7).
export function aEventos(publicaciones: readonly Publicacion[], ahora: Date, resaltar?: string): EventoPublicacion[] {
  return publicaciones.flatMap((p) => {
    if (!p.scheduledAt) return [];
    const estados = Object.values(p.targetStatus).filter((e): e is EstadoDestino => e !== undefined);
    const clases = ['evento-publicacion', `evento-${p.status}`];
    if (p.id === resaltar) clases.push('evento-resaltado');
    return [
      {
        id: p.id,
        title: p.title,
        start: p.scheduledAt,
        editable: esEditable(estados) && p.scheduledAt.getTime() > ahora.getTime(),
        classNames: clases,
        extendedProps: { status: p.status, targetStatus: p.targetStatus },
      },
    ];
  });
}
