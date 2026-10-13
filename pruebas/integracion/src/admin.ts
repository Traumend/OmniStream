import { getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

export const PROYECTO = 'demo-omnistream';
export const BUCKET = 'demo-omnistream.appspot.com';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

const configurados = new WeakSet<Firestore>();

// App de administración contra los emuladores, con el mismo ajuste de Firestore que usan las funciones.
export function adminDemo(nombre: string): { app: App; db: Firestore; bucket: Bucket } {
  const app =
    getApps().find((a) => a.name === nombre) ?? initializeApp({ projectId: PROYECTO, storageBucket: BUCKET }, nombre);
  const db = getFirestore(app);
  if (!configurados.has(db)) {
    db.settings({ ignoreUndefinedProperties: true });
    configurados.add(db);
  }
  return { app, db, bucket: getStorage(app).bucket(BUCKET) };
}
