import type { Platform } from '@omnistream/core';
import type { Firestore } from 'firebase-admin/firestore';
import type { Encolador } from '../cola';
import type { EncoladorRecortes } from '../generarRecorte';

export interface DependenciasAccion {
  db: Firestore;
  ahora: Date;
  encolar: Encolador;
  encolarRecorte?: EncoladorRecortes; // sin él, guardar no pide derivados
  // Borra de Storage los derivados de una red, o de toda la publicación sin red.
  borrarDerivados?(postId: string, red?: Platform): Promise<void>;
}
