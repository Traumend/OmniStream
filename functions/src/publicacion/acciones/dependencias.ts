import type { Firestore } from 'firebase-admin/firestore';
import type { Encolador } from '../cola';
import type { EncoladorRecortes } from '../generarRecorte';

export interface DependenciasAccion {
  db: Firestore;
  ahora: Date;
  encolar: Encolador;
  encolarRecorte?: EncoladorRecortes; // sin él, guardar no pide derivados
}
