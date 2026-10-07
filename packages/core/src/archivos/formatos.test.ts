import { expect, it } from 'vitest';
import { detectarTipo, validarArchivo } from './formatos';

const GB = 1024 ** 3;

it('detecta por extensión sin importar mayúsculas', () => {
  expect(detectarTipo('clip.MOV', '')).toEqual({ tipo: 'video', mime: 'video/quicktime' });
  expect(detectarTipo('foto.heic', '')).toEqual({ tipo: 'image', mime: 'image/heic' });
});
it('usa el MIME si no hay extensión', () => {
  expect(detectarTipo('sin-extension', 'video/mp4')).toEqual({ tipo: 'video', mime: 'video/mp4' });
});
it('devuelve null para formatos no soportados', () => {
  expect(detectarTipo('doc.pdf', 'application/pdf')).toBeNull();
});
it('acepta un video dentro del límite', () => {
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 2 * GB }, 10)).toEqual({
    ok: true,
    tipo: 'video',
    mime: 'video/mp4',
  });
});
it('rechaza archivos vacíos, excedidos y no soportados', () => {
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 0 }, 10)).toMatchObject({
    ok: false,
    error: 'archivo_vacio',
    mensaje: 'El archivo está vacío.',
  });
  expect(validarArchivo({ nombre: 'a.mp4', mime: 'video/mp4', bytes: 11 * GB }, 10)).toMatchObject({
    ok: false,
    error: 'excede_limite',
    mensaje: 'El archivo supera el límite de 10 GB.',
  });
  expect(validarArchivo({ nombre: 'a.png', mime: 'image/png', bytes: 51 * 1024 ** 2 }, 10)).toMatchObject({
    ok: false,
    error: 'imagen_excede_limite',
    mensaje: 'Las imágenes no pueden superar 50 MB.',
  });
  expect(validarArchivo({ nombre: 'a.pdf', mime: 'application/pdf', bytes: 10 }, 10)).toMatchObject({
    ok: false,
    error: 'formato_no_soportado',
    mensaje: 'Formato no soportado. Usa mp4, mov, webm, jpg, png, webp o heic.',
  });
});
