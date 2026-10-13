import { getStorage } from 'firebase-admin/storage';

const VIGENCIA_MS = 15 * 60 * 1000;

export async function urlDeLectura(bucket: string, ruta: string): Promise<{ url: string; cabeceras?: string }> {
  const emulador = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (process.env.FUNCTIONS_EMULATOR === 'true' && emulador) {
    const host = emulador.replace(/^https?:\/\//, '');
    return {
      url: `http://${host}/v0/b/${bucket}/o/${encodeURIComponent(ruta)}?alt=media`,
      cabeceras: 'Authorization: Bearer owner\r\n',
    };
  }
  const [url] = await getStorage()
    .bucket(bucket)
    .file(ruta)
    .getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + VIGENCIA_MS });
  return { url };
}
