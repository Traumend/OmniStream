import { expect, it } from 'vitest';

it('procesa un archivo a la vez por instancia para no agotar memoria con ffmpeg', async () => {
  process.env.FIREBASE_CONFIG = JSON.stringify({
    projectId: 'demo-omnistream',
    storageBucket: 'demo-omnistream.appspot.com',
  });
  const { procesarArchivo } = await import('./procesarArchivo');
  expect(procesarArchivo.__endpoint).toMatchObject({ concurrency: 1, availableMemoryMb: 2048, timeoutSeconds: 540 });
});
