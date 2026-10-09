import { logger } from 'firebase-functions';
import { beforeEach, expect, it, vi } from 'vitest';
import type { FfprobeSalida } from './analizar';
import { MENSAJE_ERROR_LECTURA, procesarObjeto, type DependenciasProcesamiento } from './procesarObjeto';

const salidaVertical60s: FfprobeSalida = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1080, height: 1920, r_frame_rate: '30/1' },
    { codec_type: 'audio' },
  ],
  format: { duration: '60' },
};
const jpegConvertido = Buffer.from('jpeg-convertido');

let limpiar: ReturnType<typeof vi.fn>;
let deps: {
  [K in keyof DependenciasProcesamiento]: ReturnType<typeof vi.fn> & DependenciasProcesamiento[K];
};

beforeEach(() => {
  limpiar = vi.fn().mockResolvedValue(undefined);
  deps = {
    leerAsset: vi.fn().mockResolvedValue({ status: 'subiendo' }),
    actualizarAsset: vi.fn().mockResolvedValue(undefined),
    descargar: vi.fn().mockResolvedValue(Buffer.from('imagen')),
    subir: vi.fn().mockResolvedValue(undefined),
    urlDeLectura: vi.fn().mockResolvedValue({ url: 'http://origen/a1' }),
    probar: vi.fn().mockResolvedValue(salidaVertical60s),
    extraerFotograma: vi.fn().mockResolvedValue(undefined),
    procesarImagen: vi
      .fn()
      .mockResolvedValue({ width: 1200, height: 800, aspect: 1.5, rotation: 0, miniatura: Buffer.from('mini') }),
    convertirHeicAJpeg: vi.fn().mockResolvedValue(jpegConvertido),
    leerArchivo: vi.fn().mockResolvedValue(Buffer.from('fotograma')),
    directorioTemporal: vi.fn().mockResolvedValue({ ruta: '/tmp/x', limpiar }),
  } as unknown as typeof deps;
});

it('ignora objetos fuera de originales/', async () => {
  await procesarObjeto({ name: 'fotogramas/a1/start.jpg', contentType: 'image/jpeg' }, deps);
  expect(deps.actualizarAsset).not.toHaveBeenCalled();
});

it('no hace nada si el asset no existe', async () => {
  deps.leerAsset.mockResolvedValue(null);
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).not.toHaveBeenCalled();
});

it('video: marca procesando, extrae 3 fotogramas y queda listo', async () => {
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).toHaveBeenNthCalledWith(1, 'a1', { status: 'procesando' });
  expect(deps.extraerFotograma.mock.calls.map((c) => c[1])).toEqual([1, 30, 59]);
  expect(deps.subir.mock.calls.map((c) => [c[0], c[2]])).toEqual([
    ['fotogramas/a1/start.jpg', 'image/jpeg'],
    ['fotogramas/a1/middle.jpg', 'image/jpeg'],
    ['fotogramas/a1/end.jpg', 'image/jpeg'],
  ]);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith(
    'a1',
    expect.objectContaining({
      status: 'listo',
      width: 1080,
      height: 1920,
      aspect: 0.5625,
      durationSec: 60,
      hasAudio: true,
      frames: {
        start: 'fotogramas/a1/start.jpg',
        middle: 'fotogramas/a1/middle.jpg',
        end: 'fotogramas/a1/end.jpg',
      },
    }),
  );
});

it('imagen: guarda dimensiones y un fotograma', async () => {
  await procesarObjeto({ name: 'originales/a1', contentType: 'image/png' }, deps);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith(
    'a1',
    expect.objectContaining({
      status: 'listo',
      width: 1200,
      height: 800,
      frames: { start: 'fotogramas/a1/start.jpg' },
    }),
  );
});

it('heic: convierte y vuelve a subir como JPEG sin marcar listo', async () => {
  await procesarObjeto({ name: 'originales/a1', contentType: 'image/heic' }, deps);
  expect(deps.subir).toHaveBeenCalledWith('originales/a1', jpegConvertido, 'image/jpeg', { heicConvertido: '1' });
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', { mimeType: 'image/jpeg' });
});

it('un error de lectura deja el asset fallido con mensaje en español', async () => {
  deps.probar.mockRejectedValue(new Error('Invalid data found'));
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(deps.actualizarAsset).toHaveBeenLastCalledWith('a1', { status: 'fallido', error: MENSAJE_ERROR_LECTURA });
});

it('siempre limpia el directorio temporal', async () => {
  deps.probar.mockRejectedValue(new Error('x'));
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  expect(limpiar).toHaveBeenCalled();
});

it('no registra URLs firmadas en los logs', async () => {
  const registro = vi.spyOn(logger, 'error').mockImplementation(() => {});
  deps.probar.mockRejectedValue(
    new Error(
      'Command failed: ffprobe https://storage.googleapis.com/b/originales/a1?X-Goog-Algorithm=GOOG4&X-Goog-Signature=abc123: Invalid data',
    ),
  );
  await procesarObjeto({ name: 'originales/a1', contentType: 'video/mp4' }, deps);
  const registrado = JSON.stringify(registro.mock.calls);
  expect(registrado).not.toContain('X-Goog-Signature');
  expect(registrado).toContain('https://storage.googleapis.com/b/originales/a1');
  registro.mockRestore();
});
