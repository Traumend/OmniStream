import type { ModoPublicacion, Platform, PrivacidadTiktok } from '../publicaciones/tipos';

export const PROVEEDORES = ['meta', 'youtube', 'tiktok'] as const;
export type Proveedor = (typeof PROVEEDORES)[number];

// Un solo inicio de sesión de Meta crea las conexiones de Facebook e Instagram (spec 6.2).
export const REDES_DE_PROVEEDOR: Record<Proveedor, readonly Platform[]> = {
  meta: ['facebook', 'instagram'],
  youtube: ['youtube'],
  tiktok: ['tiktok'],
};

export const ETIQUETAS_PROVEEDOR: Record<Proveedor, string> = { meta: 'Meta', youtube: 'YouTube', tiktok: 'TikTok' };

export const proveedorDe = (red: Platform): Proveedor => (red === 'facebook' || red === 'instagram' ? 'meta' : red);

export type EstadoConexion = 'sin_conectar' | 'conectada' | 'expirada' | 'error';

export const ETIQUETAS_ESTADO_CONEXION: Record<EstadoConexion, string> = {
  sin_conectar: 'Sin conectar',
  conectada: 'Conectada',
  expirada: 'Acceso vencido',
  error: 'Error',
};

export interface CuentaRed {
  id: string;
  name: string;
  handle?: string;
  avatarUrl?: string;
}

export interface Conexion {
  platform: Platform;
  authStatus: EstadoConexion;
  readEnabled: boolean;
  publishMode: ModoPublicacion;
  account?: CuentaRed;
  scopes: string[];
  tokenExpiresAt?: Date;
  lastMetricsSyncAt?: Date;
  lastError?: { code: string; message: string; at: Date };
  mediaVerified?: boolean;
}

export const PERMISO_PUBLICAR: Record<Platform, string> = {
  facebook: 'pages_manage_posts',
  instagram: 'instagram_content_publish',
  youtube: 'https://www.googleapis.com/auth/youtube.upload',
  tiktok: 'video.publish',
};

export const PERMISO_COMENTAR: Record<Exclude<Platform, 'tiktok'>, string> = {
  facebook: 'pages_manage_engagement',
  instagram: 'instagram_manage_comments',
  youtube: 'https://www.googleapis.com/auth/youtube.force-ssl',
};

export interface InfoCreadorTiktok {
  nickname: string;
  username: string;
  avatarUrl?: string;
  privacidades: PrivacidadTiktok[];
  comentariosDesactivados: boolean;
  duetDesactivado: boolean;
  stitchDesactivado: boolean;
  duracionMaximaSeg: number;
}

type Registro = Record<string, unknown>;
const registro = (valor: unknown): Registro =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? (valor as Registro) : {};
const texto = (valor: unknown): string | undefined => (typeof valor === 'string' ? valor : undefined);

function aFecha(valor: unknown): Date | undefined {
  if (valor instanceof Date) return valor;
  const conversor = (valor as { toDate?: unknown } | null | undefined)?.toDate;
  return typeof conversor === 'function' ? (conversor.call(valor) as Date) : undefined;
}

const ESTADOS: readonly EstadoConexion[] = ['sin_conectar', 'conectada', 'expirada', 'error'];

export function leerConexion(platform: Platform, datos: unknown): Conexion {
  const d = registro(datos);
  const cuenta = registro(d.account);
  const error = registro(d.lastError);
  const conexion: Conexion = {
    platform,
    authStatus: ESTADOS.includes(d.authStatus as EstadoConexion) ? (d.authStatus as EstadoConexion) : 'sin_conectar',
    readEnabled: d.readEnabled === true,
    publishMode: d.publishMode === 'api' ? 'api' : 'manual',
    scopes: Array.isArray(d.scopes) ? d.scopes.filter((s): s is string => typeof s === 'string') : [],
  };
  if (texto(cuenta.id) && texto(cuenta.name)) {
    conexion.account = { id: cuenta.id as string, name: cuenta.name as string };
    if (texto(cuenta.handle)) conexion.account.handle = cuenta.handle as string;
    if (texto(cuenta.avatarUrl)) conexion.account.avatarUrl = cuenta.avatarUrl as string;
  }
  const vence = aFecha(d.tokenExpiresAt);
  if (vence) conexion.tokenExpiresAt = vence;
  const sincronizada = aFecha(d.lastMetricsSyncAt);
  if (sincronizada) conexion.lastMetricsSyncAt = sincronizada;
  if (texto(error.message)) {
    conexion.lastError = {
      code: texto(error.code) ?? 'desconocido',
      message: error.message as string,
      at: aFecha(error.at) ?? new Date(0),
    };
  }
  if (typeof d.mediaVerified === 'boolean') conexion.mediaVerified = d.mediaVerified;
  return conexion;
}
