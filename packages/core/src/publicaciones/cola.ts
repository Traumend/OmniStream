import type { Destino, Platform } from './tipos';

const DIA_MS = 24 * 60 * 60 * 1000;

// Cloud Tasks admite hasta 30 días; 29 deja margen para la ejecución horaria de encolarPendientes.
export const VENTANA_COLA_MS = 29 * DIA_MS;
export const LEASE_MS = 15 * 60 * 1000;
// Cloud Tasks nunca entrega antes de tiempo; el emulador sí. Más allá de este margen la tarea no hace nada.
export const ANTICIPACION_MAX_MS = 60 * 1000;
export const MAX_INTENTOS_TAREA = 5;

export function idTarea(postId: string, platform: Platform, version: number, recuperacion?: number): string {
  const base = `${postId}-${platform}-v${version}`;
  return recuperacion === undefined ? base : `${base}-r${recuperacion}`;
}

export const idContinuacion = (postId: string, platform: Platform, version: number, seq: number): string =>
  `${idTarea(postId, platform, version)}-c${seq}`;

export const idReferencia = (postId: string, platform: Platform, version: number): string =>
  `${postId}-${platform}-ref-v${version}`;

export type MotivoOmision = 'inexistente' | 'version' | 'estado' | 'anticipada' | 'ocupada';
export type DecisionToma = { tomar: true; continuar: boolean } | { tomar: false; motivo: MotivoOmision };

export function decidirToma(
  destino: Pick<Destino, 'status' | 'scheduleVersion' | 'scheduledAt' | 'lease'> | null,
  scheduleVersion: number,
  ahora: Date,
): DecisionToma {
  if (!destino) return { tomar: false, motivo: 'inexistente' };
  if (destino.scheduleVersion !== scheduleVersion) return { tomar: false, motivo: 'version' };
  if (destino.status === 'programada') {
    if (destino.scheduledAt && destino.scheduledAt.getTime() - ahora.getTime() > ANTICIPACION_MAX_MS) {
      return { tomar: false, motivo: 'anticipada' };
    }
    return { tomar: true, continuar: false };
  }
  if (destino.status === 'publicando') {
    if (destino.lease && destino.lease.until.getTime() > ahora.getTime()) return { tomar: false, motivo: 'ocupada' };
    return { tomar: true, continuar: true };
  }
  return { tomar: false, motivo: 'estado' };
}

export function necesitaEncolarse(
  destino: Pick<Destino, 'status' | 'scheduleVersion' | 'enqueuedVersion' | 'scheduledAt'>,
  ahora: Date,
): boolean {
  return (
    destino.status === 'programada' &&
    destino.enqueuedVersion !== destino.scheduleVersion &&
    destino.scheduledAt !== undefined &&
    destino.scheduledAt.getTime() - ahora.getTime() <= VENTANA_COLA_MS
  );
}

// Sin lease, un destino en 'publicando' espera su continuación (por API) o el reintento de Cloud Tasks: se da por
// atascado si nada lo tocó durante un lease.
export const estaAtascado = (destino: Pick<Destino, 'status' | 'lease' | 'statusChangedAt'>, ahora: Date): boolean =>
  destino.status === 'publicando' &&
  (destino.lease
    ? destino.lease.until.getTime() < ahora.getTime()
    : destino.statusChangedAt.getTime() + LEASE_MS < ahora.getTime());

// Su tarea ya se encoló, pero la hora pasó hace más que un lease sin que nadie la tomara: la tarea se perdió
// (reintentos agotados antes de ejecutarse, cola purgada) o llegó antes de tiempo y terminó sin efecto.
export const estaVencida = (
  destino: Pick<Destino, 'status' | 'scheduleVersion' | 'enqueuedVersion' | 'scheduledAt'>,
  ahora: Date,
): boolean =>
  destino.status === 'programada' &&
  destino.enqueuedVersion === destino.scheduleVersion &&
  destino.scheduledAt !== undefined &&
  destino.scheduledAt.getTime() + LEASE_MS < ahora.getTime();
