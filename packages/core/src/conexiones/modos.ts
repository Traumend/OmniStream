import { ETIQUETAS_RED, type FormatoDestino, type ModoPublicacion, type Platform } from '../publicaciones/tipos';
import { ETIQUETAS_PROVEEDOR, PERMISO_COMENTAR, PERMISO_PUBLICAR, proveedorDe, type Conexion } from './tipos';

export const puedePublicarPorApi = (c: Conexion): boolean =>
  c.authStatus === 'conectada' && c.scopes.includes(PERMISO_PUBLICAR[c.platform]);

// Modo efectivo de un destino: TikTok imagen exige además el dominio de /api/media/ verificado.
export function modoDePublicacion(c: Conexion | null | undefined, formato?: FormatoDestino): ModoPublicacion {
  if (!c || c.publishMode !== 'api' || !puedePublicarPorApi(c)) return 'manual';
  if (c.platform === 'tiktok' && formato === 'imagen' && c.mediaVerified !== true) return 'manual';
  return 'api';
}

export function puedeComentarPorApi(c: Conexion | null | undefined): boolean {
  if (!c || c.platform === 'tiktok' || c.authStatus !== 'conectada' || c.publishMode !== 'api') return false;
  return c.scopes.includes(PERMISO_COMENTAR[c.platform]);
}

export const mensajePermisoFaltante = (red: Platform): string =>
  `Falta el permiso para publicar en ${ETIQUETAS_RED[red]}. Vuelve a conectar ${ETIQUETAS_PROVEEDOR[proveedorDe(red)]} y concédelo.`;
