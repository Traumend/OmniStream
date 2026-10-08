import { randomUUID } from 'node:crypto';
import { createHmac } from 'node:crypto';
import { borrarDatosMeta } from '@omnistream/functions/src/conexiones/borradoDatosMeta';
import { firmarTokenMedia, servirMedia } from '@omnistream/functions/src/conexiones/media';
import { expect, it } from 'vitest';
import { adminDemo } from '../admin';
import { sembrarConexion, sembrarSesion } from '../datos';

const { db, bucket } = adminDemo('media');
const CLAVE = Buffer.alloc(32, 6).toString('base64');
const AHORA = new Date('2030-05-01T10:00:00Z');
const SECRETO = 'secreto-de-la-app';
const URL_PUBLICA = 'http://localhost:3000';

async function leerFlujo(flujo: NodeJS.ReadableStream): Promise<string> {
  const partes: Buffer[] = [];
  for await (const parte of flujo) partes.push(Buffer.from(parte as Buffer));
  return Buffer.concat(partes).toString('utf8');
}

function signedRequest(payload: Record<string, unknown>): string {
  const codificado = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${createHmac('sha256', SECRETO).update(codificado).digest('base64url')}.${codificado}`;
}

const depsBorrado = { db, appSecret: SECRETO, urlPublica: URL_PUBLICA, ahora: () => AHORA };

it('servirMedia entrega el archivo con su tipo', async () => {
  const ruta = `originales/media-${randomUUID()}`;
  await bucket.file(ruta).save(Buffer.from('imagen'), { contentType: 'image/jpeg' });
  const token = firmarTokenMedia(CLAVE, ruta, AHORA.getTime() + 3_600_000);

  const respuesta = await servirMedia(token, { bucket, clave: CLAVE, ahora: () => AHORA });

  expect(respuesta.status).toBe(200);
  if (respuesta.status !== 200) return;
  expect(respuesta.contentType).toBe('image/jpeg');
  expect(respuesta.size).toBe(6);
  expect(await leerFlujo(respuesta.stream)).toBe('imagen');
});

it('un token vencido es 404', async () => {
  const ruta = `originales/media-${randomUUID()}`;
  await bucket.file(ruta).save(Buffer.from('x'), { contentType: 'image/jpeg' });
  const token = firmarTokenMedia(CLAVE, ruta, AHORA.getTime() - 1);
  expect(await servirMedia(token, { bucket, clave: CLAVE, ahora: () => AHORA })).toEqual({ status: 404 });
});

it('un archivo que ya no existe es 404', async () => {
  const token = firmarTokenMedia(CLAVE, `originales/media-${randomUUID()}`, AHORA.getTime() + 60_000);
  expect(await servirMedia(token, { bucket, clave: CLAVE, ahora: () => AHORA })).toEqual({ status: 404 });
});

it('borrarDatosMeta borra la sesión y desconecta Facebook e Instagram', async () => {
  await sembrarSesion(db, 'meta');
  await sembrarConexion(db, 'facebook');
  await sembrarConexion(db, 'instagram');

  const respuesta = await borrarDatosMeta(signedRequest({ algorithm: 'HMAC-SHA256', user_id: '42' }), depsBorrado);

  expect(respuesta.status).toBe(200);
  if (respuesta.status !== 200) return;
  const codigo = respuesta.cuerpo.confirmation_code;
  expect(codigo).toMatch(/^[0-9a-f]{16}$/);
  expect(respuesta.cuerpo.url).toBe(`${URL_PUBLICA}/privacidad?borrado=${codigo}#borrado-de-datos`);
  expect((await db.doc('secrets/meta').get()).exists).toBe(false);
  for (const red of ['facebook', 'instagram']) {
    expect((await db.doc(`connections/${red}`).get()).data()).toEqual({
      platform: red,
      authStatus: 'sin_conectar',
      publishMode: 'manual',
      readEnabled: false,
      scopes: [],
    });
  }
  expect((await db.doc(`dataDeletions/${codigo}`).get()).data()).toMatchObject({ userId: '42' });
});

it('un signed_request inválido es 400 y no borra nada', async () => {
  await sembrarSesion(db, 'meta');
  expect(await borrarDatosMeta('firma.invalida', depsBorrado)).toEqual({
    status: 400,
    cuerpo: { error: 'La solicitud no es válida.' },
  });
  expect((await db.doc('secrets/meta').get()).exists).toBe(true);
  await db.doc('secrets/meta').delete();
});
