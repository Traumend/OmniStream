import { expect, it } from 'vitest';
import { aFechaUtc, aPartesLocales } from './fechas';

it('convierte la hora local de la zona a UTC', () => {
  expect(aFechaUtc('2026-10-08', '10:30', 'America/Mexico_City').toISOString()).toBe('2026-10-08T16:30:00.000Z');
});
it('una hora inexistente por horario de verano pasa a la siguiente válida', () => {
  expect(aFechaUtc('2026-03-08', '02:30', 'America/New_York').toISOString()).toBe('2026-03-08T07:30:00.000Z');
});
it('aPartesLocales es la inversa', () => {
  expect(aPartesLocales(new Date('2026-10-08T16:30:00Z'), 'America/Mexico_City')).toEqual({
    fecha: '2026-10-08',
    hora: '10:30',
  });
});
