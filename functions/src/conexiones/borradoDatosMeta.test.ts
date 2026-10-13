import { createHmac } from 'node:crypto';
import { expect, it } from 'vitest';
import { verificarSignedRequest } from './borradoDatosMeta';

const SECRETO = 'secreto-de-la-app';

function signedRequest(payload: Record<string, unknown>, secreto = SECRETO): string {
  const codificado = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = createHmac('sha256', secreto).update(codificado).digest('base64url');
  return `${firma}.${codificado}`;
}

it('signed_request válido devuelve el usuario', () => {
  const solicitud = signedRequest({ algorithm: 'HMAC-SHA256', user_id: '1234567890', issued_at: 1_900_000_000 });
  expect(verificarSignedRequest(solicitud, SECRETO)).toMatchObject({ user_id: '1234567890' });
});

it('firma inválida o algoritmo distinto es null', () => {
  const payload = { algorithm: 'HMAC-SHA256', user_id: '1' };
  expect(verificarSignedRequest(signedRequest(payload, 'otro'), SECRETO)).toBeNull();
  expect(verificarSignedRequest(signedRequest({ ...payload, algorithm: 'HMAC-SHA1' }, SECRETO), SECRETO)).toBeNull();
  expect(verificarSignedRequest(signedRequest({ algorithm: 'HMAC-SHA256' }), SECRETO)).toBeNull();
  expect(verificarSignedRequest('sin-punto', SECRETO)).toBeNull();
  expect(verificarSignedRequest('a.b', SECRETO)).toBeNull();
});
