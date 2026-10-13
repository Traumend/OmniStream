import { expect, it } from 'vitest';
import { redactarUrls } from './redaccion';

it('el detalle de un error de ffmpeg no lleva la firma de la URL de lectura', () => {
  const error = new Error(
    'Command failed: ffmpeg -v error -i https://storage.googleapis.com/b/originales/a1?X-Goog-Algorithm=GOOG4&X-Goog-Signature=abc123 -y /tmp/s.mp4',
  );
  const detalle = redactarUrls(String(error));
  expect(detalle).not.toContain('X-Goog-Signature');
  expect(detalle).toContain('https://storage.googleapis.com/b/originales/a1?[redactado]');
});
