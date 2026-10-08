import {
  CAMPOS_YOUTUBE_POR_DEFECTO,
  normalizarHashtags,
  PLATAFORMAS,
  type CamposYoutube,
  type Destino,
  type EntradaPublicacion,
  type FormatoDestino,
  type Fotograma,
  type Platform,
  type Publicacion,
} from '@omnistream/core';
import { aFechaUtc, aPartesLocales } from '@/lib/fechas';

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
    frame: Fotograma;
  };
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
    frame: 'start',
  },
};

const etiquetasDe = (texto: string) =>
  texto
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

export function aEntrada(form: FormularioPublicacion, zona: string, postId?: string): EntradaPublicacion {
  const destinos = PLATAFORMAS.flatMap((platform): EntradaPublicacion['destinos'] => {
    const format = form.redes[platform];
    if (!format) return [];
    if (platform !== 'youtube') return [{ platform, format }];
    const { description, tags, categoryId, privacy, madeForKids, frame } = form.youtube;
    return [
      {
        platform,
        format,
        youtube: { description, tags: etiquetasDe(tags), categoryId, privacy, madeForKids, thumbnail: { frame } },
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
      frame: youtube.thumbnail?.frame ?? 'start',
    },
  };
}
