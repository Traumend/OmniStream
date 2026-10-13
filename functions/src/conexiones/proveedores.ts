import type { Platform, Proveedor } from '@omnistream/core';
import {
  adaptadorFacebook,
  adaptadorInstagram,
  adaptadorTiktok,
  adaptadorYoutube,
  crearOAuthMeta,
  crearOAuthTiktok,
  crearOAuthYoutube,
  type Http,
  type OAuthProvider,
  type PlatformAdapter,
} from '@omnistream/platforms';
import {
  googleClientId,
  googleClientSecret,
  metaAppId,
  metaAppSecret,
  metaConfigId,
  tiktokClientKey,
  tiktokClientSecret,
} from '../config';

// Lee los parámetros y secretos al llamarse: solo funciona dentro de una función que declare SECRETOS_CONECTORES.
export function proveedoresReales(http: Http = fetch): Record<Proveedor, OAuthProvider> {
  return {
    meta: crearOAuthMeta({
      appId: metaAppId.value(),
      appSecret: metaAppSecret.value(),
      configId: metaConfigId.value(),
      http,
    }),
    youtube: crearOAuthYoutube({ clientId: googleClientId.value(), clientSecret: googleClientSecret.value(), http }),
    tiktok: crearOAuthTiktok({ clientKey: tiktokClientKey.value(), clientSecret: tiktokClientSecret.value(), http }),
  };
}

export const ADAPTADORES: Record<Platform, PlatformAdapter> = {
  facebook: adaptadorFacebook,
  instagram: adaptadorInstagram,
  youtube: adaptadorYoutube,
  tiktok: adaptadorTiktok,
};
