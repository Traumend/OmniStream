import type { Crop } from './recorte';
import type { Destino, Platform, Publicacion } from './tipos';
import type { Problema } from './validacion';

export const CAMPOS_AJUSTABLES = ['text', 'hashtags', 'title', 'crop', 'scheduledAt'] as const;
export type CampoAjustable = (typeof CAMPOS_AJUSTABLES)[number];

export interface AjustesEfectivos {
  text: string;
  hashtags: string[];
  title: string;
  crop?: Crop;
  scheduledAt: Date | null;
}

// efectivo = override ?? base, campo por campo (spec 6.4). Un override vacío ('' o []) también reemplaza.
export function ajustesEfectivos(
  publicacion: Pick<Publicacion, 'title' | 'base' | 'scheduledAt'>,
  destino: Pick<Destino, 'overrides'>,
): AjustesEfectivos {
  const o = destino.overrides;
  const efectivos: AjustesEfectivos = {
    text: o.text ?? publicacion.base.text,
    hashtags: o.hashtags ?? publicacion.base.hashtags,
    title: o.title ?? publicacion.title,
    scheduledAt: o.scheduledAt ?? publicacion.scheduledAt,
  };
  if (o.crop) efectivos.crop = o.crop;
  return efectivos;
}

export const esPersonalizado = (destino: Pick<Destino, 'overrides'>): boolean =>
  CAMPOS_AJUSTABLES.some((campo) => destino.overrides[campo] !== undefined);

// Los problemas sin red afectan a todas.
export function estadoDeRed(problemas: readonly Problema[], red: Platform): 'correcto' | 'advertencia' | 'error' {
  const propios = problemas.filter((p) => p.red === undefined || p.red === red);
  if (propios.some((p) => p.nivel === 'error')) return 'error';
  return propios.length > 0 ? 'advertencia' : 'correcto';
}
