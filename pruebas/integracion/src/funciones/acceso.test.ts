import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  type Auth,
} from 'firebase/auth';
import { afterAll, beforeAll, it } from 'vitest';
import { expect } from 'vitest';

let app: FirebaseApp;
let auth: Auth;

const credencial = (email: string) =>
  GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true }));

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-omnistream', apiKey: 'demo-key' }, 'acceso');
  auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
});

afterAll(async () => {
  await signOut(auth);
  await deleteApp(app);
});

it('el correo permitido entra y recibe el claim owner', async () => {
  const { user } = await signInWithCredential(auth, credencial('propietario@omnistream.test'));
  const token = await user.getIdTokenResult(true);
  expect(token.claims.owner).toBe(true);
});

it('otro correo es rechazado', async () => {
  await expect(signInWithCredential(auth, credencial('intruso@ejemplo.com'))).rejects.toThrow(
    /Esta cuenta no tiene acceso a OmniStream/,
  );
});
