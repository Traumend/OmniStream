import type { AccionPublicacion, RespuestaPublicaciones } from '@omnistream/core';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth as getAuthAdmin } from 'firebase-admin/auth';
import { adminDemo, PROYECTO } from './admin';

export const CORREO_PROPIETARIO = 'propietario@omnistream.test';
const CONTRASENA = 'contrasena-de-prueba';

export interface Cliente {
  llamar(accion: AccionPublicacion): Promise<RespuestaPublicaciones>;
  cerrar(): Promise<void>;
}

let contador = 0;

function crearCliente(): { app: FirebaseApp; cliente: Cliente } {
  const app = initializeApp(
    { projectId: PROYECTO, apiKey: 'demo', authDomain: `${PROYECTO}.firebaseapp.com` },
    `cliente-${++contador}`,
  );
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
  const funciones = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(funciones, '127.0.0.1', 5001);
  const publicaciones = httpsCallable<AccionPublicacion, RespuestaPublicaciones>(funciones, 'publicaciones');
  return {
    app,
    cliente: {
      llamar: async (accion) => (await publicaciones(accion)).data,
      cerrar: () => deleteApp(app),
    },
  };
}

export async function clienteAnonimo(): Promise<Cliente> {
  return crearCliente().cliente;
}

// Crea (o reutiliza) al propietario en el emulador de Auth; la función de bloqueo le asigna el claim owner al entrar.
export async function clientePropietario(): Promise<Cliente> {
  const auth = getAuthAdmin(adminDemo('sesion').app);
  try {
    await auth.createUser({ email: CORREO_PROPIETARIO, password: CONTRASENA, emailVerified: true });
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/email-already-exists') throw error;
    const usuario = await auth.getUserByEmail(CORREO_PROPIETARIO);
    await auth.updateUser(usuario.uid, { password: CONTRASENA, emailVerified: true });
  }
  const { app, cliente } = crearCliente();
  await signInWithEmailAndPassword(getAuth(app), CORREO_PROPIETARIO, CONTRASENA);
  return cliente;
}
