import { z } from 'zod';
import type { Destino, Publicacion } from './tipos';

// Lista de promoción de un Principal (spec 6.10): lo que hay que publicar para darle exposición al video.
export const TIPOS_PROMOCION = ['short', 'comunidad', 'exposicion'] as const;
export type TipoPromocion = (typeof TIPOS_PROMOCION)[number];

export const ETIQUETAS_TIPO_PROMOCION: Record<TipoPromocion, string> = {
  short: 'Short',
  comunidad: 'Comunidad',
  exposicion: 'Exposición',
};

export interface PlantillaPromocion {
  type: TipoPromocion;
  title: string;
  offsetDays: number;
}

export const PLANTILLA_PROMOCION_POR_DEFECTO: PlantillaPromocion[] = [
  { type: 'short', title: 'Short 1', offsetDays: 1 },
  { type: 'short', title: 'Short 2', offsetDays: 3 },
  { type: 'short', title: 'Short 3', offsetDays: 5 },
  { type: 'comunidad', title: 'Post en Comunidad', offsetDays: 2 },
  { type: 'exposicion', title: 'Exposición en medios propios', offsetDays: 0 },
];

export interface ItemPromocion {
  id: string;
  type: TipoPromocion;
  title: string;
  offsetDays: number;
  dueAt: Date | null;
  dueAtEdited: boolean;
  status: 'pendiente' | 'hecho';
  hijaId?: string;
  note?: string;
  notifiedAt?: Date;
}

const MENSAJE_TITULO = 'Escribe un título para cada pendiente.';
const MENSAJE_DIAS = 'Los días deben ser un número entero entre -30 y 365.';

const tituloPromocion = z.string().trim().min(1, MENSAJE_TITULO).max(120, 'El título admite hasta 120 caracteres.');
const diasPromocion = z.number({ error: MENSAJE_DIAS }).int(MENSAJE_DIAS).min(-30, MENSAJE_DIAS).max(365, MENSAJE_DIAS);

export const plantillaPromocionSchema = z.object({
  type: z.enum(TIPOS_PROMOCION),
  title: tituloPromocion,
  offsetDays: diasPromocion,
});

// Lo que la web envía al editar la lista; notifiedAt lo maneja solo el servidor.
export const itemPromocionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(TIPOS_PROMOCION),
  title: tituloPromocion,
  offsetDays: diasPromocion,
  dueAt: z.iso.datetime().nullable(),
  dueAtEdited: z.boolean(),
  status: z.enum(['pendiente', 'hecho']),
  hijaId: z.string().min(1).max(128).optional(),
  note: z.string().max(500, 'La nota admite hasta 500 caracteres.').optional(),
});

const DIA_MS = 24 * 60 * 60 * 1000;
const sumarDias = (fecha: Date, dias: number) => new Date(fecha.getTime() + dias * DIA_MS);
const mismaFecha = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

// La fecha real de publicación en YouTube manda; si no, la programada del destino o la de la publicación.
export function fechaBasePromocion(
  principal: Pick<Publicacion, 'scheduledAt'>,
  youtube?: Pick<Destino, 'remote' | 'scheduledAt'>,
): Date | null {
  return youtube?.remote?.publishedAt ?? youtube?.scheduledAt ?? principal.scheduledAt ?? null;
}

export function crearPromocion(
  plantilla: readonly PlantillaPromocion[],
  base: Date | null,
  nuevoId: () => string,
): ItemPromocion[] {
  return plantilla.map(({ type, title, offsetDays }) => ({
    id: nuevoId(),
    type,
    title,
    offsetDays,
    dueAt: base ? sumarDias(base, offsetDays) : null,
    dueAtEdited: false,
    status: 'pendiente',
  }));
}

// Mueve las fechas que el titular no editó. Un pendiente con fecha nueva vuelve a poder avisar.
export function recalcularFechas(items: readonly ItemPromocion[], base: Date | null): ItemPromocion[] {
  return items.map((item) => {
    if (item.dueAtEdited) return item;
    const dueAt = base ? sumarDias(base, item.offsetDays) : null;
    if (mismaFecha(item.dueAt, dueAt)) return item;
    const nuevo: ItemPromocion = { ...item, dueAt };
    if (item.status === 'pendiente') delete nuevo.notifiedAt;
    return nuevo;
  });
}

// Una Hija publicada cumple el siguiente short pendiente; la misma Hija no cuenta dos veces.
export function asignarHija(items: readonly ItemPromocion[], hijaId: string): ItemPromocion[] {
  if (items.some((i) => i.hijaId === hijaId)) return items as ItemPromocion[];
  const indice = items.findIndex((i) => i.type === 'short' && i.status === 'pendiente' && !i.hijaId);
  if (indice < 0) return items as ItemPromocion[];
  return items.map((item, i) => (i === indice ? { ...item, status: 'hecho', hijaId } : item));
}

export function vencidosSinAviso(items: readonly ItemPromocion[], ahora: Date): ItemPromocion[] {
  return items.filter(
    (i) => i.status === 'pendiente' && i.dueAt !== null && i.dueAt.getTime() <= ahora.getTime() && !i.notifiedAt,
  );
}

// Pendientes con fecha hasta dentro de `dias` días, incluidos los vencidos, del más antiguo al más reciente.
export function proximos(items: readonly ItemPromocion[], ahora: Date, dias = 7): ItemPromocion[] {
  const limite = sumarDias(ahora, dias).getTime();
  return items
    .filter((i): i is ItemPromocion & { dueAt: Date } => i.status === 'pendiente' && i.dueAt !== null)
    .filter((i) => i.dueAt.getTime() <= limite)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
