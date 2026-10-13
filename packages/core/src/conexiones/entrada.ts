import { z } from 'zod';
import { PLATAFORMAS } from '../publicaciones/tipos';
import { PROVEEDORES, type InfoCreadorTiktok } from './tipos';

const proveedor = z.enum(PROVEEDORES);

export const accionConexionSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('iniciar'), proveedor }),
  z.object({ accion: z.literal('desconectar'), proveedor }),
  z.object({
    accion: z.literal('configurar'),
    platform: z.enum(PLATAFORMAS),
    publishMode: z.enum(['api', 'manual']).optional(),
    readEnabled: z.boolean().optional(),
    mediaVerified: z.boolean().optional(),
  }),
  z.object({ accion: z.literal('infoCreadorTiktok') }),
]);

export type AccionConexion = z.infer<typeof accionConexionSchema>;

export interface RespuestaConexiones {
  url?: string;
  info?: InfoCreadorTiktok;
}
