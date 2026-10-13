import { expect, it } from 'vitest';
import { ajustesAppSchema, leerAjustes } from './ajustes';
import { PLANTILLA_PROMOCION_POR_DEFECTO } from './publicaciones/promocion';

it('acepta valores válidos', () => {
  const valores = {
    timezone: 'America/Bogota',
    retentionDays: 14,
    maxUploadGb: 20,
    promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
  };
  expect(ajustesAppSchema.parse(valores)).toEqual(valores);
});
it('valida rangos y zona horaria con mensajes en español', () => {
  const r = ajustesAppSchema.safeParse({
    timezone: 'Marte/Olimpo',
    retentionDays: 91,
    maxUploadGb: 51,
    promotionTemplate: [],
  });
  expect(r.success).toBe(false);
  const mensajes = r.success ? [] : r.error.issues.map((i) => i.message);
  expect(mensajes).toEqual(
    expect.arrayContaining([
      'Zona horaria inválida',
      'La retención debe estar entre 0 y 90 días.',
      'Debe ser entre 1 y 50 GB',
    ]),
  );
});
it('usa los valores por defecto si no hay datos', () => {
  expect(leerAjustes(undefined)).toEqual({
    timezone: 'UTC',
    retentionDays: 0,
    maxUploadGb: 10,
    promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
  });
});
it('completa los campos faltantes', () => {
  expect(leerAjustes({ retentionDays: 14, timezone: 'America/Bogota' })).toEqual({
    timezone: 'America/Bogota',
    retentionDays: 14,
    maxUploadGb: 10,
    promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
  });
});
it('reemplaza solo los campos inválidos', () => {
  expect(leerAjustes({ retentionDays: -3, maxUploadGb: 20 })).toEqual({
    timezone: 'UTC',
    retentionDays: 0,
    maxUploadGb: 20,
    promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
  });
});

it('0 días de retención es válido', () => {
  expect(ajustesAppSchema.shape.retentionDays.safeParse(0).success).toBe(true);
});

it('conserva la plantilla de promoción guardada y rechaza una inválida', () => {
  const plantilla = [{ type: 'comunidad', title: 'Encuesta', offsetDays: 4 }];
  expect(leerAjustes({ promotionTemplate: plantilla }).promotionTemplate).toEqual(plantilla);
  expect(leerAjustes({ promotionTemplate: [{ type: 'otro', title: 'x', offsetDays: 1 }] }).promotionTemplate).toEqual(
    PLANTILLA_PROMOCION_POR_DEFECTO,
  );
});
