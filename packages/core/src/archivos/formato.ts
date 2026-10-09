export const LOCALE = 'es-419';

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB'];
const numero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });

export function formatearBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNIDADES.length - 1);
  return `${numero.format(bytes / 1024 ** indice)} ${UNIDADES[indice]}`;
}

export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatearFechaHora(fecha: Date, zona: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: zona }).format(fecha);
}
