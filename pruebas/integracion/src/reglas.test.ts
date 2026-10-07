import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const raiz = resolve(import.meta.dirname, '../../..');
const bytes = new Uint8Array([1, 2, 3, 4]);

let entorno: RulesTestEnvironment;
let anonimo: RulesTestContext;
let extrano: RulesTestContext;
let propietario: RulesTestContext;

beforeAll(async () => {
  entorno = await initializeTestEnvironment({
    projectId: 'demo-omnistream',
    firestore: { rules: readFileSync(resolve(raiz, 'firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(raiz, 'storage.rules'), 'utf8') },
  });
  anonimo = entorno.unauthenticatedContext();
  extrano = entorno.authenticatedContext('u2', {});
  propietario = entorno.authenticatedContext('u1', { owner: true });
});

afterAll(async () => {
  await entorno.cleanup();
});

describe('Firestore', () => {
  beforeEach(async () => {
    await entorno.clearFirestore();
  });

  it('anónimo no lee settings/app', async () => {
    await assertFails(getDoc(doc(anonimo.firestore(), 'settings/app')));
  });
  it('usuario sin claim owner no lee assets', async () => {
    await assertFails(getDoc(doc(extrano.firestore(), 'assets/a1')));
  });
  it('propietario lee y escribe settings/app', async () => {
    await assertSucceeds(setDoc(doc(propietario.firestore(), 'settings/app'), { retentionDays: 7 }));
    await assertSucceeds(getDoc(doc(propietario.firestore(), 'settings/app')));
  });
  it('propietario crea assets', async () => {
    await assertSucceeds(setDoc(doc(propietario.firestore(), 'assets/a1'), { status: 'subiendo' }));
  });
  it('propietario no lee ni escribe secrets', async () => {
    await assertFails(getDoc(doc(propietario.firestore(), 'secrets/ai_anthropic')));
    await assertFails(setDoc(doc(propietario.firestore(), 'secrets/ai_anthropic'), { x: 1 }));
  });
  it('colecciones no declaradas están denegadas', async () => {
    await assertFails(getDoc(doc(propietario.firestore(), 'posts/p1')));
  });
});

describe('Storage', () => {
  beforeEach(async () => {
    await entorno.clearFirestore();
    await entorno.clearStorage();
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'assets/a1'), { status: 'subiendo' });
      await uploadBytes(ref(ctx.storage(), 'fotogramas/a1/start.jpg'), bytes, { contentType: 'image/jpeg' });
      await uploadBytes(ref(ctx.storage(), 'originales/a1'), bytes, { contentType: 'video/mp4' });
    });
  });

  it('propietario sube el original si existe el asset', async () => {
    await assertSucceeds(uploadBytes(ref(propietario.storage(), 'originales/a1'), bytes, { contentType: 'video/mp4' }));
  });
  it('sin documento de asset la subida falla', async () => {
    await assertFails(uploadBytes(ref(propietario.storage(), 'originales/zz'), bytes, { contentType: 'video/mp4' }));
  });
  it('rechaza tipos de contenido no permitidos', async () => {
    await assertFails(uploadBytes(ref(propietario.storage(), 'originales/a1'), bytes, { contentType: 'text/plain' }));
  });
  it('propietario no puede escribir fotogramas', async () => {
    await assertFails(
      uploadBytes(ref(propietario.storage(), 'fotogramas/a1/start.jpg'), bytes, { contentType: 'image/jpeg' }),
    );
  });
  it('propietario lee fotogramas', async () => {
    await assertSucceeds(getBytes(ref(propietario.storage(), 'fotogramas/a1/start.jpg')));
  });
  it('usuario sin owner no lee originales', async () => {
    await assertFails(getBytes(ref(extrano.storage(), 'originales/a1')));
  });
});
