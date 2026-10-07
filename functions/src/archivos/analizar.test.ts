import { expect, it } from 'vitest';
import { analizarSalidaFfprobe } from './analizar';

const video = { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30000/1001' };

it('extrae los datos de un video vertical con audio', () => {
  expect(analizarSalidaFfprobe({ streams: [video, { codec_type: 'audio' }], format: { duration: '12.345' } })).toEqual({
    width: 1080,
    height: 1920,
    aspect: 0.5625,
    durationSec: 12.345,
    fps: 29.97,
    hasAudio: true,
    codec: 'h264',
    rotation: 0,
  });
});

it('aplica la rotación de la matriz de visualización', () => {
  const r = analizarSalidaFfprobe({
    streams: [{ ...video, width: 1920, height: 1080, side_data_list: [{ side_data_type: 'Display Matrix', rotation: -90 }] }],
    format: { duration: '5' },
  });
  expect(r).toMatchObject({ width: 1080, height: 1920, aspect: 0.5625, rotation: 270, hasAudio: false });
});

it('aplica la rotación de la etiqueta rotate', () => {
  const r = analizarSalidaFfprobe({
    streams: [{ ...video, width: 1920, height: 1080, tags: { rotate: '90' } }],
    format: { duration: '5' },
  });
  expect(r).toMatchObject({ width: 1080, height: 1920, rotation: 90 });
});

it('falla sin pista de video', () => {
  expect(() => analizarSalidaFfprobe({ streams: [{ codec_type: 'audio' }], format: { duration: '5' } })).toThrowError(
    expect.objectContaining({ codigo: 'sin_pista_video' }),
  );
});

it('falla con duración ausente o cero', () => {
  expect(() => analizarSalidaFfprobe({ streams: [video], format: {} })).toThrowError(
    expect.objectContaining({ codigo: 'duracion_invalida' }),
  );
  expect(() => analizarSalidaFfprobe({ streams: [video], format: { duration: '0' } })).toThrowError(
    expect.objectContaining({ codigo: 'duracion_invalida' }),
  );
});
