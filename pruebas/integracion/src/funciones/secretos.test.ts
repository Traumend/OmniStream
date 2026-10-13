import { crearCifrador } from '@omnistream/functions/src/conexiones/cifrado';
import { borrarSesion, guardarSesion, leerSesion } from '@omnistream/functions/src/conexiones/secretos';
import { expect, it } from 'vitest';
import { adminDemo } from '../admin';

const { db } = adminDemo('secretos');
const cifrador = crearCifrador(Buffer.alloc(32, 3).toString('base64'));

it('guarda la sesión cifrada sin el token en claro', async () => {
  await guardarSesion(
    db,
    cifrador,
    'tiktok',
    { accessToken: 'act.secreto-123', datos: { username: 'cuenta' } },
    new Date(),
  );
  const crudo = JSON.stringify((await db.doc('secrets/tiktok').get()).data());
  expect(crudo).not.toContain('secreto-123');
  expect(crudo).not.toContain('cuenta');
  expect(await leerSesion(db, cifrador, 'tiktok')).toEqual({
    accessToken: 'act.secreto-123',
    datos: { username: 'cuenta' },
  });
});

it('sin sesión guardada devuelve null y borrar la elimina', async () => {
  await guardarSesion(db, cifrador, 'meta', { accessToken: 'x', datos: {} }, new Date());
  await borrarSesion(db, 'meta');
  expect(await leerSesion(db, cifrador, 'meta')).toBeNull();
});
