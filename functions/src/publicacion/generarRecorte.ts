import type { Platform } from '@omnistream/core';
import { getFunctions } from 'firebase-admin/functions';
import { REGION } from '../config';

export interface TareaRecorte {
  postId: string;
  platform: Platform;
  cropHash: string;
}

export type EncoladorRecortes = (tarea: TareaRecorte) => Promise<void>;

// Retraso de la cola: mientras se arrastra el recorte con autoguardado, solo el último llega a generarse.
const RETRASO_RECORTE_MS = 60_000;

export function encoladorRecortes(): EncoladorRecortes {
  const cola = getFunctions().taskQueue<TareaRecorte>(`locations/${REGION}/functions/generarRecorte`);
  return async (tarea) => {
    try {
      await cola.enqueue(tarea, {
        id: `${tarea.postId}-${tarea.platform}-${tarea.cropHash}`,
        scheduleTime: new Date(Date.now() + RETRASO_RECORTE_MS),
      });
    } catch (error) {
      // El id incluye la huella: si ya existe, ese recorte ya está en la cola.
      if (!String((error as { code?: string }).code).endsWith('task-already-exists')) throw error;
    }
  };
}
