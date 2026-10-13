import { expect, it } from 'vitest';
import { argumentosRecorteVideo } from './recortar';

it('los argumentos de ffmpeg recortan, escalan y codifican en H.264 con inicio rápido', () => {
  const args = argumentosRecorteVideo({
    url: 'http://origen/video',
    cabeceras: 'Authorization: Bearer owner\r\n',
    px: { x: 438, y: 0, w: 404, h: 720 },
    salida: { width: 1080, height: 1920 },
    destino: '/tmp/salida.mp4',
  });
  expect(args).toContain('crop=404:720:438:0,scale=1080:1920,setsar=1');
  for (const valor of ['libx264', 'veryfast', '20', 'yuv420p', 'aac', '+faststart']) expect(args).toContain(valor);
  expect(args.indexOf('-headers')).toBeLessThan(args.indexOf('-i'));
  expect(args.at(-1)).toBe('/tmp/salida.mp4');
});
