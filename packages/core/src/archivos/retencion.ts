import type { EstadoDestino } from '../publicaciones/tipos';
import type { Asset } from './asset';

const DIA_MS = 24 * 60 * 60 * 1000;
export const DIAS_SIN_USO = 30;
export const DIAS_FALLIDA_TERMINAL = 30;
export const DIAS_AL_POSPONER = 7;

export interface UsoDeArchivo {
  status: EstadoDestino;
  statusChangedAt: Date;
}

const sumarDias = (fecha: Date, dias: number) => new Date(fecha.getTime() + dias * DIA_MS);
const mayor = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

// Momento desde el que un uso cuenta como terminal, o null si todavía no lo es (spec 7.7).
function terminalDesde(uso: UsoDeArchivo, ahora: Date): Date | null {
  if (uso.status === 'publicada' || uso.status === 'cancelada') return uso.statusChangedAt;
  if (uso.status === 'fallida') {
    const terminal = sumarDias(uso.statusChangedAt, DIAS_FALLIDA_TERMINAL);
    return terminal.getTime() <= ahora.getTime() ? terminal : null;
  }
  return null;
}

export function calcularPurga(entrada: {
  createdAt: Date;
  usos: readonly UsoDeArchivo[];
  retentionDays: number;
  retainUntil?: Date;
  ahora: Date;
}): Date | null {
  let fecha: Date;
  if (entrada.usos.length === 0) {
    fecha = sumarDias(entrada.createdAt, DIAS_SIN_USO);
  } else {
    const terminales = entrada.usos.map((uso) => terminalDesde(uso, entrada.ahora));
    if (terminales.some((t) => t === null)) return null;
    fecha = sumarDias((terminales as Date[]).reduce(mayor), entrada.retentionDays);
    // Un archivo que no llegó a publicarse (todo cancelado o fallido) se conserva como uno sin uso: cancelar no
    // borra el video aunque la retención sea de 0 días (D17 borra lo ya publicado).
    if (!entrada.usos.some((uso) => uso.status === 'publicada')) {
      fecha = mayor(fecha, sumarDias(entrada.createdAt, DIAS_SIN_USO));
    }
  }
  return entrada.retainUntil ? mayor(fecha, entrada.retainUntil) : fecha;
}

export function fechaDePurgaVisible(asset: Pick<Asset, 'purgeAt' | 'retainUntil'>): Date | undefined {
  if (asset.purgeAt && asset.retainUntil) return mayor(asset.purgeAt, asset.retainUntil);
  return asset.purgeAt ?? asset.retainUntil;
}

export function posponerHasta(asset: Pick<Asset, 'purgeAt' | 'retainUntil'>, ahora: Date): Date {
  const visible = fechaDePurgaVisible(asset);
  return sumarDias(visible ? mayor(visible, ahora) : ahora, DIAS_AL_POSPONER);
}
