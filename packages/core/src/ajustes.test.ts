import { expect, it } from 'vitest';
import { ajustesAppSchema, leerAjustes } from './ajustes';

it('acepta valores válidos', () => {
  expect(ajustesAppSchema.parse({ timezone: 'America/Bogota', retentionDays: 14, maxUploadGb: 20 })).toEqual({
    timezone: 'America/Bogota',
    retentionDays: 14,
    maxUploadGb: 20,
  });
});
it('valida rangos y zona horaria con mensajes en español', () => {
  const r = ajustesAppSchema.safeParse({ timezone: 'Marte/Olimpo', retentionDays: 0, maxUploadGb: 51 });
  expect(r.success).toBe(false);
  const mensajes = r.success ? [] : r.error.issues.map((i) => i.message);
  expect(mensajes).toEqual(
    expect.arrayContaining(['Zona horaria inválida', 'Debe ser entre 1 y 90 días', 'Debe ser entre 1 y 50 GB']),
  );
});
it('usa los valores por defecto si no hay datos', () => {
  expect(leerAjustes(undefined)).toEqual({ timezone: 'UTC', retentionDays: 7, maxUploadGb: 10 });
});
it('completa los campos faltantes', () => {
  expect(leerAjustes({ retentionDays: 14, timezone: 'America/Bogota' })).toEqual({
    timezone: 'America/Bogota',
    retentionDays: 14,
    maxUploadGb: 10,
  });
});
it('reemplaza solo los campos inválidos', () => {
  expect(leerAjustes({ retentionDays: -3, maxUploadGb: 20 })).toEqual({
    timezone: 'UTC',
    retentionDays: 7,
    maxUploadGb: 20,
  });
});
