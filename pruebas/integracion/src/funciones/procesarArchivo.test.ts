import { randomUUID } from 'node:crypto';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { prepararFixtures, type Fixtures } from '../fixtures';

let app: App;
let db: Firestore;
let fixtures: Fixtures;
const bucket = () => getStorage(app).bucket('demo-omnistream.appspot.com');

beforeAll(async () => {
  fixtures = await prepararFixtures();
  app = initializeApp({ projectId: 'demo-omnistream' }, 'procesar');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

async function subirYEsperar(ruta: string, contentType: string): Promise<Record<string, unknown> & { id: string }> {
  const id = randomUUID();
  const documento = db.collection('assets').doc(id);
  await documento.set({ status: 'subiendo', originalName: ruta, mimeType: contentType });
  await bucket().upload(ruta, { destination: `originales/${id}`, contentType });
  const limite = Date.now() + 60_000;
  while (Date.now() < limite) {
    const datos = (await documento.get()).data();
    if (datos?.status === 'listo' || datos?.status === 'fallido') return { id, ...datos };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`El asset ${id} no terminó de procesarse en 60 s`);
}

it('un video subido queda listo con sus datos y 3 fotogramas', async () => {
  const asset = await subirYEsperar(fixtures.video, 'video/mp4');
  expect(asset).toMatchObject({ status: 'listo', width: 720, height: 1280, aspect: 0.5625, hasAudio: true });
  expect(asset.durationSec as number).toBeCloseTo(4, 0);
  for (const f of ['start', 'middle', 'end']) {
    expect((await bucket().file(`fotogramas/${asset.id}/${f}.jpg`).exists())[0]).toBe(true);
  }
});

it('una imagen queda lista con un fotograma', async () => {
  expect(await subirYEsperar(fixtures.imagen, 'image/jpeg')).toMatchObject({
    status: 'listo',
    width: 1200,
    height: 800,
    frames: { start: expect.any(String) },
  });
});

it('un archivo dañado queda fallido', async () => {
  expect(await subirYEsperar(fixtures.danado, 'video/mp4')).toMatchObject({
    status: 'fallido',
    error: 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.',
  });
});
