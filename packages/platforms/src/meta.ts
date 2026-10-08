import type { CuentaRed } from '@omnistream/core';
import { PlatformError } from './errores';
import { solicitar, type Http, type RespuestaHttp } from './http';
import type { OAuthProvider, SesionProveedor } from './tipos';

export const VERSION_GRAPH = 'v26.0';
export const GRAPH = `https://graph.facebook.com/${VERSION_GRAPH}`;

const AUTENTICACION = new Set([190, 102, 10]);
const TEMPORALES = new Set([4, 17, 32, 613, 80001, 80002, 1, 2, 341, 368]);

export interface ErrorMeta {
  code?: number;
  error_subcode?: number;
  message?: string;
  error_user_msg?: string;
}

export const errorMeta = (r: RespuestaHttp): ErrorMeta | undefined => (r.json as { error?: ErrorMeta } | null)?.error;

// Spec 7.6 con los códigos de la Graph API (verificados el 2026-10-08).
export function clasificarMeta(red: string, r: RespuestaHttp): PlatformError | null {
  const error = errorMeta(r);
  if (!error) return null;
  const codigo = error.code ?? 0;
  if (AUTENTICACION.has(codigo) || (codigo >= 200 && codigo <= 299))
    return new PlatformError(
      'auth',
      `meta_${codigo}`,
      `El acceso a ${red} venció o le faltan permisos. Vuelve a conectar Meta.`,
    );
  if (TEMPORALES.has(codigo))
    return new PlatformError('temporal', `meta_${codigo}`, `${red} está limitando las solicitudes. Se reintentará.`);
  if (codigo === 506) return new PlatformError('ambiguo', 'meta_506', `${red} indica que la publicación ya existe.`);
  return new PlatformError(
    'definitivo',
    `meta_${codigo}`,
    `Meta rechazó la publicación: ${error.error_user_msg ?? error.message ?? `error ${r.status}`}`,
  );
}

const portador = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function graphGet(
  http: Http,
  ruta: string,
  token: string,
  red: string,
  opciones: { final?: boolean } = {},
): Promise<RespuestaHttp> {
  return solicitar(
    http,
    `${GRAPH}/${ruta}`,
    { method: 'GET', headers: portador(token) },
    { red, clasificar: (r) => clasificarMeta(red, r), ...opciones },
  );
}

export async function graphPost(
  http: Http,
  url: string,
  token: string,
  red: string,
  parametros: Record<string, string>,
  opciones: { final?: boolean; timeoutMs?: number } = {},
): Promise<RespuestaHttp> {
  return solicitar(
    http,
    url.startsWith('https://') ? url : `${GRAPH}/${url}`,
    {
      method: 'POST',
      headers: { ...portador(token), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(parametros).toString(),
    },
    { red, clasificar: (r) => clasificarMeta(red, r), ...opciones },
  );
}

// Graph devuelve horas como "2026-10-08T12:00:00+0000".
export const fechaGraph = (valor: string | undefined): number =>
  valor ? Date.parse(valor.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')) : NaN;

interface Pagina {
  id: string;
  name?: string;
  access_token?: string;
  picture?: { data?: { url?: string } };
  instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
}

export function crearOAuthMeta(cfg: { appId: string; appSecret: string; configId: string; http: Http }): OAuthProvider {
  const red = 'Facebook';
  const consulta = async (ruta: string, parametros: Record<string, string>) =>
    solicitar(
      cfg.http,
      `${GRAPH}/${ruta}?${new URLSearchParams(parametros).toString()}`,
      { method: 'GET' },
      { red, clasificar: (r) => clasificarMeta(red, r) },
    );

  return {
    proveedor: 'meta',
    buildAuthUrl({ state, redirectUri }) {
      const parametros = new URLSearchParams({
        client_id: cfg.appId,
        redirect_uri: redirectUri,
        state,
        response_type: 'code',
        config_id: cfg.configId,
      });
      return `https://www.facebook.com/${VERSION_GRAPH}/dialog/oauth?${parametros.toString()}`;
    },
    async exchangeCode({ code, redirectUri }) {
      const corto = await consulta('oauth/access_token', {
        client_id: cfg.appId,
        redirect_uri: redirectUri,
        client_secret: cfg.appSecret,
        code,
      });
      const largo = await consulta('oauth/access_token', {
        grant_type: 'fb_exchange_token',
        client_id: cfg.appId,
        client_secret: cfg.appSecret,
        fb_exchange_token: String((corto.json as { access_token?: string }).access_token ?? ''),
      });
      const tokenUsuario = String((largo.json as { access_token?: string }).access_token ?? '');
      const permisos = await graphGet(cfg.http, 'me/permissions', tokenUsuario, red);
      const scopes = ((permisos.json as { data?: { permission: string; status: string }[] }).data ?? [])
        .filter((p) => p.status === 'granted')
        .map((p) => p.permission);
      const cuentas = await graphGet(
        cfg.http,
        `me/accounts?${new URLSearchParams({
          fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}',
        }).toString()}`,
        tokenUsuario,
        red,
      );
      const paginas = (cuentas.json as { data?: Pagina[] }).data ?? [];
      if (paginas.length === 0)
        throw new PlatformError('definitivo', 'sin_pagina', 'Elige una página de Facebook al conectar.');
      if (paginas.length > 1)
        throw new PlatformError('definitivo', 'varias_paginas', 'Elige una sola página de Facebook al conectar.');
      const pagina = paginas[0] as Pagina;
      if (!pagina.access_token)
        throw new PlatformError('definitivo', 'sin_token_pagina', 'Meta no entregó el acceso a la página.');

      const sesion: SesionProveedor = { accessToken: pagina.access_token, datos: { pageId: pagina.id } };
      const facebook: CuentaRed = { id: pagina.id, name: pagina.name ?? pagina.id };
      if (pagina.picture?.data?.url) facebook.avatarUrl = pagina.picture.data.url;
      const resultado = { sesion, scopes, cuentas: { facebook } as Record<string, CuentaRed> };
      const ig = pagina.instagram_business_account;
      if (ig) {
        sesion.datos.igUserId = ig.id;
        const instagram: CuentaRed = { id: ig.id, name: ig.username ?? ig.id };
        if (ig.username) instagram.handle = ig.username;
        if (ig.profile_picture_url) instagram.avatarUrl = ig.profile_picture_url;
        resultado.cuentas.instagram = instagram;
      }
      return resultado;
    },
    // El acceso de la página no caduca: renovar es comprobar que sigue vigente.
    async refresh(sesion) {
      await graphGet(cfg.http, `${sesion.datos.pageId}?fields=id`, sesion.accessToken, red);
      return sesion;
    },
  };
}
