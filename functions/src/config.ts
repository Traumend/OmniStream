import { defineSecret, defineString } from 'firebase-functions/params';

export const REGION = 'us-central1';

export const correoPermitido = defineString('ALLOWED_EMAIL');

// Conectores: identificadores públicos de cada app y la URL de la web (para los redirect de OAuth).
export const urlPublica = defineString('URL_PUBLICA');
export const metaAppId = defineString('META_APP_ID');
export const metaConfigId = defineString('META_CONFIG_ID');
export const googleClientId = defineString('GOOGLE_CLIENT_ID');
export const tiktokClientKey = defineString('TIKTOK_CLIENT_KEY');

// Secretos: en producción viven en Secret Manager; en el emulador salen de functions/.secret.local.
export const claveCifrado = defineSecret('CLAVE_CIFRADO');
export const metaAppSecret = defineSecret('META_APP_SECRET');
export const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET');
export const tiktokClientSecret = defineSecret('TIKTOK_CLIENT_SECRET');

export const SECRETOS_CONECTORES = [claveCifrado, metaAppSecret, googleClientSecret, tiktokClientSecret];
