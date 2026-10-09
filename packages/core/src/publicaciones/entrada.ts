import { z } from 'zod';
import { itemPromocionSchema } from './promocion';
import {
  ETIQUETAS_FORMATO,
  ETIQUETAS_RED,
  FORMATOS,
  FORMATOS_POR_RED,
  PLATAFORMAS,
  PRIVACIDADES_TIKTOK,
} from './tipos';

const plataforma = z.enum(PLATAFORMAS);
const formato = z.enum(FORMATOS);
const id = z.string().min(1);

export const camposYoutubeSchema = z.object({
  description: z.string().max(20000),
  tags: z.array(z.string()).max(200),
  categoryId: z.string().min(1),
  privacy: z.enum(['public', 'unlisted', 'private']),
  madeForKids: z.boolean(),
  thumbnail: z.object({ frame: z.enum(['start', 'middle', 'end']) }).optional(),
});

export const camposTiktokSchema = z.object({
  privacy: z.enum(PRIVACIDADES_TIKTOK).nullable(),
  allowComments: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
  commercial: z.object({ enabled: z.boolean(), yourBrand: z.boolean(), brandedContent: z.boolean() }),
});

const destinoEntradaSchema = z.object({
  platform: plataforma,
  format: formato,
  youtube: camposYoutubeSchema.optional(),
  tiktok: camposTiktokSchema.optional(),
});

// Los límites de cada red no van aquí: un borrador puede excederlos y los aplica validarPublicacion.
export const entradaPublicacionSchema = z.object({
  postId: id.optional(),
  title: z.string().trim().min(1, 'Escribe un título').max(200, 'El título no puede pasar de 200 caracteres.'),
  assetId: id.nullable(),
  base: z.object({
    text: z.string().max(20000, 'El texto no puede pasar de 20000 caracteres.'),
    hashtags: z.array(z.string()).max(100, 'No puede haber más de 100 hashtags.'),
  }),
  scheduledAt: z.iso.datetime().nullable(),
  parentId: id.nullable(),
  destinos: z.array(destinoEntradaSchema).superRefine((destinos, ctx) => {
    const redes = destinos.map((d) => d.platform);
    if (new Set(redes).size !== redes.length)
      ctx.addIssue({ code: 'custom', message: 'Cada red puede aparecer una sola vez.' });
    for (const d of destinos) {
      if (!FORMATOS_POR_RED[d.platform].includes(d.format)) {
        ctx.addIssue({
          code: 'custom',
          message: `${ETIQUETAS_RED[d.platform]} no admite el formato ${ETIQUETAS_FORMATO[d.format]}.`,
        });
      }
    }
  }),
});

export type EntradaPublicacion = z.infer<typeof entradaPublicacionSchema>;

export const accionPublicacionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('guardar'), publicacion: entradaPublicacionSchema }),
  z.object({ accion: z.literal('eliminar'), postId: id }),
  z.object({ accion: z.literal('desvincular'), postId: id }),
  z.object({ accion: z.literal('programar'), postId: id, inmediata: z.boolean() }),
  z.object({ accion: z.literal('mover'), postId: id, scheduledAt: z.iso.datetime() }),
  z.object({ accion: z.literal('cancelar'), postId: id }),
  z.object({ accion: z.literal('reintentar'), postId: id, platform: plataforma }),
  z.object({
    accion: z.literal('marcarPublicada'),
    postId: id,
    platform: plataforma,
    url: z.string().trim().min(1, 'Pega la URL de la publicación.'),
  }),
  z.object({ accion: z.literal('marcarReferencia'), postId: id, platform: plataforma }),
  z.object({
    accion: z.literal('importarYoutube'),
    url: z.string().trim().min(1, 'Pega el enlace del video de YouTube.'),
  }),
  z.object({
    accion: z.literal('actualizarPromocion'),
    postId: id,
    items: z.array(itemPromocionSchema).max(30, 'La lista admite hasta 30 pendientes.'),
  }),
]);

export type AccionPublicacion = z.infer<typeof accionPublicacionSchema>;

export interface RespuestaPublicaciones {
  postId: string;
}
