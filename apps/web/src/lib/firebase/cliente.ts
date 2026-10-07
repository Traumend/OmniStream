import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import { configuracionFirebase, usarEmuladores } from './config';

interface ServiciosFirebase {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

const REINTENTOS_SUBIDA_MS = 60 * 60 * 1000;

let servicios: ServiciosFirebase | undefined;

export function obtenerFirebase(): ServiciosFirebase {
  if (servicios) return servicios;
  const app = getApps()[0] ?? initializeApp(configuracionFirebase());
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  if (usarEmuladores()) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }
  storage.maxUploadRetryTime = REINTENTOS_SUBIDA_MS;
  servicios = { app, auth, db, storage };
  return servicios;
}
