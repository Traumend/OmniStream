import {
  CAMPOS_TIKTOK_POR_DEFECTO,
  CAMPOS_YOUTUBE_POR_DEFECTO,
  normalizarHashtags,
  PLATAFORMAS,
  type CamposTiktok,
  type CamposYoutube,
  type Crop,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type Fotograma,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import { aFechaUtc, aPartesLocales } from '@/lib/fechas';

// Ajustes propios de una red (spec 8.3). Un campo ausente hereda el valor base.
export interface FormularioOverrides {
  text?: string;
  hashtags?: string;
  title?: string;
  crop?: Crop;
  fecha?: string; // la hora propia, en la zona configurada
  hora?: string;
}

export interface FormularioPublicacion {
  title: string;
  assetId: string;
  text: string;
  hashtags: string;
  fecha: string; // yyyy-MM-dd en la zona configurada
  hora: string; // HH:mm en la zona configurada
  parentId: string;
  redes: Partial<Record<Platform, FormatoDestino>>;
  youtube: {
    description: string;
    tags: string; // separadas por comas
    categoryId: string;
    privacy: CamposYoutube['privacy'];
    madeForKids: boolean;
    // Spec 8.4: uno de los 3 fotogramas o una imagen lista de la Biblioteca.
    miniatura: { tipo: 'fotograma'; frame: Fotograma } | { tipo: 'imagen'; assetId: string };
  };
  tiktok: CamposTiktok;
  overrides: Partial<Record<Platform, FormularioOverrides>>;
}

export const FORMULARIO_VACIO: FormularioPublicacion = {
  title: '',
  assetId: '',
  text: '',
  hashtags: '',
  fecha: '',
  hora: '',
  parentId: '',
  redes: {},
  youtube: {
    description: CAMPOS_YOUTUBE_POR_DEFECTO.description,
    tags: '',
    categoryId: CAMPOS_YOUTUBE_POR_DEFECTO.categoryId,
    privacy: CAMPOS_YOUTUBE_POR_DEFECTO.privacy,
    madeForKids: CAMPOS_YOUTUBE_POR_DEFECTO.madeForKids,
    miniatura: { tipo: 'fotograma', frame: 'start' },
  },
  tiktok: CAMPOS_TIKTOK_POR_DEFECTO,
  overrides: {},
};

const etiquetasDe = (texto: string) =>
  texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

type OverridesEntrada = NonNullable<EntradaPublicacion['destinos'][number]['overrides']>;

function overridesDeEntrada(o: FormularioOverrides | undefined, zona: string): OverridesEntrada | undefined {
  if (!o) return undefined;
  const overrides: OverridesEntrada = {};
  if (o.text !== undefined) overrides.text = o.text;
  if (o.hashtags !== undefined) overrides.hashtags = normalizarHashtags(o.hashtags);
  if (o.title !== undefined) overrides.title = o.title;
  if (o.crop) overrides.crop = o.crop;
  if (o.fecha && o.hora) overrides.scheduledAt = aFechaUtc(o.fecha, o.hora, zona).toISOString();
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function overridesDeFormulario(o: Destino['overrides'] | undefined, zona: string): FormularioOverrides | undefined {
  if (!o) return undefined;
  const formulario: FormularioOverrides = {};
  if (o.text !== undefined) formulario.text = o.text;
  if (o.hashtags !== undefined) formulario.hashtags = o.hashtags.map((h) => `#${h}`).join(' ');
  if (o.title !== undefined) formulario.title = o.title;
  if (o.crop) formulario.crop = o.crop;
  if (o.scheduledAt) Object.assign(formulario, aPartesLocales(o.scheduledAt, zona));
  return Object.keys(formulario).length > 0 ? formulario : undefined;
}

// Los overrides de la entrada con la hora como Date, como los lee validarPublicacion.
export function overridesDeDestino(o: OverridesEntrada | undefined): Destino['overrides'] {
  if (!o) return {};
  const { scheduledAt, ...resto } = o;
  return scheduledAt ? { ...resto, scheduledAt: new Date(scheduledAt) } : resto;
}

export function aEntrada(form: FormularioPublicacion, zona: string, postId?: string): EntradaPublicacion {
  const destinos = PLATAFORMAS.flatMap((platform): EntradaPublicacion['destinos'] => {
    const format = form.redes[platform];
    if (!format) return [];
    const overrides = overridesDeEntrada(form.overrides[platform], zona);
    const comunes = { platform, format, ...(overrides ? { overrides } : {}) };
    if (platform === 'tiktok') return [{ ...comunes, tiktok: form.tiktok }];
    if (platform !== 'youtube') return [comunes];
    const { description, tags, categoryId, privacy, madeForKids, miniatura } = form.youtube;
    // Sin imagen elegida, la miniatura propia vuelve al primer fotograma.
    const thumbnail =
      miniatura.tipo === 'imagen' && miniatura.assetId
        ? { assetId: miniatura.assetId }
        : { frame: miniatura.tipo === 'fotograma' ? miniatura.frame : ('start' as const) };
    return [
      {
        ...comunes,
        youtube: { description, tags: etiquetasDe(tags), categoryId, privacy, madeForKids, thumbnail },
      },
    ];
  });
  const esPrincipal = form.redes.youtube === 'video_largo';
  return {
    ...(postId ? { postId } : {}),
    title: form.title,
    assetId: form.assetId || null,
    base: { text: form.text, hashtags: normalizarHashtags(form.hashtags) },
    scheduledAt: form.fecha && form.hora ? aFechaUtc(form.fecha, form.hora, zona).toISOString() : null,
    parentId: esPrincipal ? null : form.parentId || null,
    destinos,
  };
}

export function aFormulario(
  publicacion: Publicacion,
  destinos: readonly Destino[],
  zona: string,
): FormularioPublicacion {
  const partes = publicacion.scheduledAt ? aPartesLocales(publicacion.scheduledAt, zona) : { fecha: '', hora: '' };
  const youtube = destinos.find((d) => d.platform === 'youtube')?.youtube ?? CAMPOS_YOUTUBE_POR_DEFECTO;
  const tiktok = destinos.find((d) => d.platform === 'tiktok')?.tiktok ?? CAMPOS_TIKTOK_POR_DEFECTO;
  return {
    title: publicacion.title,
    assetId: publicacion.assetId ?? '',
    text: publicacion.base.text,
    hashtags: publicacion.base.hashtags.map((h) => `#${h}`).join(' '),
    fecha: partes.fecha,
    hora: partes.hora,
    parentId: publicacion.parentId ?? '',
    redes: Object.fromEntries(destinos.map((d) => [d.platform, d.format])),
    youtube: {
      description: youtube.description,
      tags: youtube.tags.join(', '),
      categoryId: youtube.categoryId,
      privacy: youtube.privacy,
      madeForKids: youtube.madeForKids,
      miniatura:
        youtube.thumbnail && 'assetId' in youtube.thumbnail
          ? { tipo: 'imagen', assetId: youtube.thumbnail.assetId }
          : { tipo: 'fotograma', frame: youtube.thumbnail?.frame ?? 'start' },
    },
    tiktok,
    overrides: Object.fromEntries(
      destinos.flatMap((d) => {
        const overrides = overridesDeFormulario(d.overrides, zona);
        return overrides ? [[d.platform, overrides]] : [];
      }),
    ),
  };
}
