import type { Firestore } from 'firebase-admin/firestore';
import type { Encolador } from '../cola';

export interface DependenciasAccion {
  db: Firestore;
  ahora: Date;
  encolar: Encolador;
}
