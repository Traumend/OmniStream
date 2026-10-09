import { z } from 'zod';
import { PLANTILLA_PROMOCION_POR_DEFECTO, plantillaPromocionSchema } from './publicaciones/promocion';

export function esZonaHorariaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const MENSAJE_RETENCION = 'La retención debe estar entre 0 y 90 días.';
const MENSAJE_SUBIDA = 'Debe ser entre 1 y 50 GB';

export const ajustesAppSchema = z.object({
  timezone: z.string().refine(esZonaHorariaValida, 'Zona horaria inválida'),
  retentionDays: z
    .number({ error: MENSAJE_RETENCION })
    .int(MENSAJE_RETENCION)
    .min(0, MENSAJE_RETENCION)
    .max(90, MENSAJE_RETENCION),
  maxUploadGb: z.number({ error: MENSAJE_SUBIDA }).min(1, MENSAJE_SUBIDA).max(50, MENSAJE_SUBIDA),
  // Pendientes que recibe cada Principal nuevo (spec 6.10).
  promotionTemplate: z.array(plantillaPromocionSchema).max(30, 'La plantilla admite hasta 30 pendientes.'),
});

export type AjustesApp = z.infer<typeof ajustesAppSchema>;

// Por defecto el video se borra en cuanto se publica en todas sus redes (D17): solo se conservan sus datos.
export const AJUSTES_POR_DEFECTO: AjustesApp = {
  timezone: 'UTC',
  retentionDays: 0,
  maxUploadGb: 10,
  promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
};

export function leerAjustes(datos: unknown): AjustesApp {
  const origen = (typeof datos === 'object' && datos !== null ? datos : {}) as Record<string, unknown>;
  const campo = <K extends keyof AjustesApp>(clave: K): AjustesApp[K] => {
    const resultado = ajustesAppSchema.shape[clave].safeParse(origen[clave]);
    return resultado.success ? (resultado.data as AjustesApp[K]) : AJUSTES_POR_DEFECTO[clave];
  };
  return {
    timezone: campo('timezone'),
    retentionDays: campo('retentionDays'),
    maxUploadGb: campo('maxUploadGb'),
    promotionTemplate: campo('promotionTemplate'),
  };
}
