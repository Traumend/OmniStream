import type { EstadoDestino, EstadoPublicacion } from './tipos';

const EDITABLES: ReadonlySet<EstadoDestino> = new Set(['borrador', 'programada', 'cancelada']);

export const ESTADOS_CANCELABLES: ReadonlySet<EstadoDestino> = new Set([
  'borrador',
  'programada',
  'pendiente_manual',
  'fallida',
]);

// Reglas de la spec 6.8. 'idea' y 'borrador' los fija el usuario; se conservan mientras no haya destinos en curso.
export function estadoPublicacion(estados: readonly EstadoDestino[], actual: EstadoPublicacion): EstadoPublicacion {
  const conservado = actual === 'idea' ? 'idea' : 'borrador';
  const activos = estados.filter((e) => e !== 'cancelada' && e !== 'borrador');
  if (activos.length === 0) return estados.some((e) => e === 'borrador') || estados.length === 0 ? conservado : 'borrador';
  if (activos.every((e) => e === 'publicada')) return 'publicada';
  if (activos.includes('publicando')) return 'publicando';
  if (activos.some((e) => e === 'programada' || e === 'pendiente_manual')) return 'programada';
  return activos.includes('publicada') ? 'parcial' : 'fallida';
}

export const esEditable = (estados: readonly EstadoDestino[]): boolean => estados.every((e) => EDITABLES.has(e));

export const sePuedeEliminar = (estados: readonly EstadoDestino[]): boolean =>
  !estados.some((e) => e === 'publicada' || e === 'publicando');

export const sePuedeMover = (estados: readonly EstadoDestino[], nuevaFecha: Date, ahora: Date): boolean =>
  esEditable(estados) && nuevaFecha.getTime() > ahora.getTime();
