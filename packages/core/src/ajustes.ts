import { z } from 'zod';

export function esZonaHorariaValida(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const MENSAJE_RETENCION = 'Debe ser entre 1 y 90 días';
const MENSAJE_SUBIDA = 'Debe ser entre 1 y 50 GB';

export const ajustesAppSchema = z.object({
  timezone: z.string().refine(esZonaHorariaValida, 'Zona horaria inválida'),
  retentionDays: z
    .number({ error: MENSAJE_RETENCION })
    .int(MENSAJE_RETENCION)
    .min(1, MENSAJE_RETENCION)
    .max(90, MENSAJE_RETENCION),
  maxUploadGb: z.number({ error: MENSAJE_SUBIDA }).min(1, MENSAJE_SUBIDA).max(50, MENSAJE_SUBIDA),
});

export type AjustesApp = z.infer<typeof ajustesAppSchema>;

export const AJUSTES_POR_DEFECTO: AjustesApp = { timezone: 'UTC', retentionDays: 7, maxUploadGb: 10 };

export function leerAjustes(datos: unknown): AjustesApp {
  const origen = (typeof datos === 'object' && datos !== null ? datos : {}) as Record<string, unknown>;
  const campo = <K extends keyof AjustesApp>(clave: K): AjustesApp[K] => {
    const resultado = ajustesAppSchema.shape[clave].safeParse(origen[clave]);
    return resultado.success ? (resultado.data as AjustesApp[K]) : AJUSTES_POR_DEFECTO[clave];
  };
  return { timezone: campo('timezone'), retentionDays: campo('retentionDays'), maxUploadGb: campo('maxUploadGb') };
}
