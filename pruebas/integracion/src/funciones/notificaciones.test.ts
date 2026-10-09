import { randomUUID } from 'node:crypto';
import type { Aviso } from '@omnistream/core';
import { crearNotificador } from '@omnistream/functions/src/publicacion/notificaciones';
import { afterEach, expect, it, vi } from 'vitest';
import { adminDemo } from '../admin';

const { db } = adminDemo('notificaciones');
const aviso: Aviso = {
  tipo: 'pendiente_manual',
  titulo: 'Publicación pendiente',
  cuerpo: 'Mi corto · TikTok',
  enlace: '/pendientes/p1/tiktok',
};
const ajustes = db.doc('settings/app');

// Los demás archivos de prueba disparan avisos reales: sin tokens no intentan enviar a FCM.
afterEach(async () => {
  await ajustes.set({ fcmTokens: [] }, { merge: true });
});

it('un mismo id envía el push una sola vez', async () => {
  await ajustes.set({ fcmTokens: ['t1'] }, { merge: true });
  const enviar = vi.fn().mockResolvedValue({ enviados: 1, invalidos: [] });
  const notificar = crearNotificador(db, enviar);
  const id = `evento-${randomUUID()}`;
  await notificar(id, aviso);
  await notificar(id, aviso);
  expect(enviar).toHaveBeenCalledTimes(1);
  expect(enviar).toHaveBeenCalledWith(['t1'], aviso);
  expect((await db.doc(`notifications/${id}`).get()).data()).toMatchObject({
    ...aviso,
    push: { enviados: 1, fallidos: 0 },
  });
});

it('quita los tokens inválidos', async () => {
  await ajustes.set({ fcmTokens: ['t1', 't2'] }, { merge: true });
  const enviar = vi.fn().mockResolvedValue({ enviados: 1, invalidos: ['t2'] });
  const id = `evento-${randomUUID()}`;
  await crearNotificador(db, enviar)(id, aviso);
  expect((await ajustes.get()).get('fcmTokens')).toEqual(['t1']);
  expect((await db.doc(`notifications/${id}`).get()).get('push')).toEqual({ enviados: 1, fallidos: 1 });
});

it('sin tokens registra el aviso y no envía', async () => {
  await ajustes.set({ fcmTokens: [] }, { merge: true });
  const enviar = vi.fn();
  const id = `evento-${randomUUID()}`;
  await crearNotificador(db, enviar)(id, aviso);
  expect(enviar).not.toHaveBeenCalled();
  expect((await db.doc(`notifications/${id}`).get()).get('push')).toEqual({ enviados: 0, fallidos: 0 });
});

it('un error al enviar se registra como fallido', async () => {
  await ajustes.set({ fcmTokens: ['t1', 't2'] }, { merge: true });
  const enviar = vi.fn().mockRejectedValue(new Error('sin red'));
  const id = `evento-${randomUUID()}`;
  await crearNotificador(db, enviar)(id, aviso);
  expect((await db.doc(`notifications/${id}`).get()).get('push')).toEqual({ enviados: 0, fallidos: 2 });
});
