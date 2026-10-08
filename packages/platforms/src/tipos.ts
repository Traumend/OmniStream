import type { CuentaRed, DestinoEfectivo, Platform, Proveedor, RemoteRef } from '@omnistream/core';
import type { PlatformError } from './errores';
import type { Http } from './http';

// Sesión de un proveedor; se guarda cifrada en secrets/{proveedor}.
export interface SesionProveedor {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // ms epoch
  refreshExpiresAt?: number;
  datos: Record<string, string>; // meta: pageId, igUserId; youtube: channelId, uploadsPlaylistId; tiktok: openId, username
}

export interface ResultadoConexion {
  sesion: SesionProveedor;
  scopes: string[];
  cuentas: Partial<Record<Platform, CuentaRed>>;
}

export interface OAuthProvider {
  proveedor: Proveedor;
  buildAuthUrl(p: { state: string; redirectUri: string }): string;
  exchangeCode(p: { code: string; redirectUri: string }): Promise<ResultadoConexion>;
  refresh(sesion: SesionProveedor): Promise<SesionProveedor>;
}

export interface ArchivoFuente {
  size: number;
  mimeType: string;
  urlFirmada(): Promise<string>; // enlace de lectura de 1 hora
  leerRango(inicio: number, finInclusivo: number): Promise<Uint8Array>;
}

export interface ContextoLectura {
  http: Http;
  sesion: SesionProveedor;
}

export interface PublishContext extends ContextoLectura {
  archivo: ArchivoFuente;
  miniatura?: ArchivoFuente;
  urlMedia?(): Promise<string>;
  reanudando: boolean;
  ahora(): Date;
}

export interface Checkpoint {
  stage: string;
  data: Record<string, unknown>;
}

export type StepResult =
  | { kind: 'continue'; checkpoint: Checkpoint; delaySec?: number }
  | { kind: 'done'; remote: RemoteRef }
  | { kind: 'error'; error: PlatformError };

export interface PlatformAdapter {
  platform: Platform;
  publishStep(target: DestinoEfectivo, checkpoint: Checkpoint | null, ctx: PublishContext): Promise<StepResult>;
  findExisting(
    target: DestinoEfectivo,
    ventana: { desde: Date; hasta: Date },
    ctx: ContextoLectura,
  ): Promise<RemoteRef | null>;
  postComment(remoteId: string, texto: string, ctx: ContextoLectura): Promise<{ id: string }>;
}
