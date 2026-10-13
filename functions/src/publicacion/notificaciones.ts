import type { Aviso } from '@omnistream/core';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions';

export type Notificador = (id: string, aviso: Aviso) => Promise<void>;
export type EnviarPush = (tokens: string[], aviso: Aviso) => Promise<{ enviados: number; invalidos: string[] }>;

const YA_EXISTE = 6; // código gRPC ALREADY_EXISTS
const TOKENS_INVALIDOS = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// Cada aviso se registra con un id derivado del evento: si el disparador se repite, el push no se duplica.
export function crearNotificador(db: Firestore, enviarPush: EnviarPush): Notificador {
  return async (id, aviso) => {
    const ref = db.collection('notifications').doc(id);
    try {
      await ref.create({ ...aviso, createdAt: new Date(), push: { enviados: 0, fallidos: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code === YA_EXISTE) return;
      throw error;
    }
    const ajustes = db.doc('settings/app');
    const guardados: unknown = (await ajustes.get()).get('fcmTokens');
    const tokens = Array.isArray(guardados) ? guardados.filter((t): t is string => typeof t === 'string') : [];
    if (tokens.length === 0) return;
    try {
      const { enviados, invalidos } = await enviarPush(tokens, aviso);
      await ref.update({ push: { enviados, fallidos: tokens.length - enviados } });
      if (invalidos.length > 0) await ajustes.update({ fcmTokens: FieldValue.arrayRemove(...invalidos) });
    } catch (error) {
      logger.warn('No se pudo enviar el aviso push', { id, error: String(error) });
      await ref.update({ push: { enviados: 0, fallidos: tokens.length } });
    }
  };
}

// Mensaje solo de datos: el service worker de la web arma la notificación.
export function enviarPushFcm(): EnviarPush {
  return async (tokens, aviso) => {
    const respuesta = await getMessaging().sendEachForMulticast({
      tokens,
      data: { titulo: aviso.titulo, cuerpo: aviso.cuerpo, enlace: aviso.enlace },
    });
    const invalidos = respuesta.responses.flatMap((r, i) =>
      !r.success && r.error && TOKENS_INVALIDOS.has(r.error.code) ? [tokens[i] as string] : [],
    );
    return { enviados: respuesta.successCount, invalidos };
  };
}
