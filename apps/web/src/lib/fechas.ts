import { DateTime } from 'luxon';

// Luxon resuelve las horas inexistentes por horario de verano avanzando a la siguiente hora válida.
export function aFechaUtc(fecha: string, hora: string, zona: string): Date {
  return DateTime.fromISO(`${fecha}T${hora}`, { zone: zona }).toJSDate();
}

export function aPartesLocales(fecha: Date, zona: string): { fecha: string; hora: string } {
  const local = DateTime.fromJSDate(fecha, { zone: zona });
  return { fecha: local.toFormat('yyyy-MM-dd'), hora: local.toFormat('HH:mm') };
}
