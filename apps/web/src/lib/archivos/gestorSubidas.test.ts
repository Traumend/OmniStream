import { beforeEach, expect, it, vi } from 'vitest';
import { crearGestorSubidas, type DependenciasSubida, type GestorSubidas, type TareaSubida } from './gestorSubidas';

interface TareaFalsa extends TareaSubida {
  emitirProgreso(transferidos: number, total: number): void;
  completar(): Promise<void>;
  fallar(error: Error): Promise<void>;
}

function crearTareaFalsa(): TareaFalsa {
  let alProgresar: (t: number, total: number) => void = () => {};
  let resolver!: () => void;
  let rechazar!: (e: Error) => void;
  const terminado = new Promise<void>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  const vaciar = () => new Promise((r) => setTimeout(r, 0));
  return {
    terminado,
    alProgresar: (cb) => {
      alProgresar = cb;
    },
    pausar: vi.fn(() => true),
    reanudar: vi.fn(() => true),
    cancelar: vi.fn(() => {
      rechazar(Object.assign(new Error('cancelada'), { code: 'storage/canceled' }));
      return true;
    }),
    emitirProgreso: (t, total) => alProgresar(t, total),
    completar: async () => {
      resolver();
      await vaciar();
    },
    fallar: async (error) => {
      rechazar(error);
      await vaciar();
    },
  };
}

const archivo = (nombre: string, tipo: string, bytes: number) => new File([new Uint8Array(bytes)], nombre, { type: tipo });

let tarea: TareaFalsa;
let deps: { [K in keyof DependenciasSubida]: ReturnType<typeof vi.fn> & DependenciasSubida[K] };
let gestor: GestorSubidas;

beforeEach(() => {
  tarea = crearTareaFalsa();
  deps = {
    generarId: vi.fn(() => 'a1'),
    crearDocumento: vi.fn().mockResolvedValue(undefined),
    subir: vi.fn(() => tarea),
    eliminarDocumento: vi.fn().mockResolvedValue(undefined),
    leerMetadatosLocales: vi.fn().mockResolvedValue({}),
  } as unknown as typeof deps;
  gestor = crearGestorSubidas(deps);
});

it('rechaza un formato no soportado sin crear documento', async () => {
  const r = await gestor.iniciar(archivo('doc.pdf', 'application/pdf', 10), 10);
  expect(r).toEqual({ ok: false, mensaje: 'Formato no soportado. Usa mp4, mov, webm, jpg, png, webp o heic.' });
  expect(deps.crearDocumento).not.toHaveBeenCalled();
});

it('crea el documento en estado subiendo y luego sube', async () => {
  deps.leerMetadatosLocales.mockResolvedValue({ width: 720, height: 1280, durationSec: 4 });
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 1000), 10);
  expect(deps.crearDocumento).toHaveBeenCalledWith({
    id: 'a1',
    kind: 'video',
    source: 'subida',
    originalName: 'clip.mp4',
    storagePath: 'originales/a1',
    mimeType: 'video/mp4',
    sizeBytes: 1000,
    status: 'subiendo',
    width: 720,
    height: 1280,
    durationSec: 4,
  });
  expect(deps.subir).toHaveBeenCalledWith('originales/a1', expect.any(File), 'video/mp4');
});

it('reporta el progreso y mantiene la subida activa', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  tarea.emitirProgreso(50, 100);
  expect(gestor.obtenerEstado().get('a1')).toMatchObject({ bytesTransferidos: 50, bytesTotales: 100, estado: 'subiendo' });
  expect(gestor.activas().has('a1')).toBe(true);
});

it('al completar sigue activa hasta que el servidor procese el archivo', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await tarea.completar();
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('completada');
  expect(gestor.activas().has('a1')).toBe(true);
});

it('la subida está activa antes de que se confirme el documento', async () => {
  let confirmar!: () => void;
  deps.crearDocumento.mockReturnValue(new Promise<void>((resolver) => (confirmar = resolver)));
  const inicio = gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await new Promise((r) => setTimeout(r, 0));
  expect(gestor.activas().has('a1')).toBe(true);
  confirmar();
  await inicio;
});

it('si no se puede crear el documento, informa el error y no deja la subida activa', async () => {
  deps.crearDocumento.mockRejectedValue(new Error('permission-denied'));
  const r = await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  expect(r).toEqual({ ok: false, mensaje: 'No se pudo iniciar la subida. Revisa tu conexión e inténtalo de nuevo.' });
  expect(gestor.activas().has('a1')).toBe(false);
  expect(gestor.obtenerEstado().has('a1')).toBe(false);
  expect(deps.subir).not.toHaveBeenCalled();
});

it('pausa y reanuda', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  gestor.pausar('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('pausada');
  gestor.reanudar('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('subiendo');
});

it('cancelar elimina el documento', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await gestor.cancelar('a1');
  expect(deps.eliminarDocumento).toHaveBeenCalledWith('a1');
  expect(gestor.obtenerEstado().get('a1')?.estado).toBe('cancelada');
});

it('un error deja un mensaje en español', async () => {
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  await tarea.fallar(new Error('storage/retry-limit-exceeded'));
  expect(gestor.obtenerEstado().get('a1')).toMatchObject({
    estado: 'error',
    error: 'La subida falló. Revisa tu conexión e inténtalo de nuevo.',
  });
});

it('si fallan los metadatos locales, la subida continúa', async () => {
  deps.leerMetadatosLocales.mockRejectedValue(new Error('no soportado'));
  const r = await gestor.iniciar(archivo('clip.mov', '', 100), 10);
  expect(r).toEqual({ ok: true, assetId: 'a1' });
  expect(deps.crearDocumento).toHaveBeenCalledWith(expect.not.objectContaining({ width: expect.anything() }));
});

it('notifica a los suscriptores en cada cambio', async () => {
  const cb = vi.fn();
  gestor.suscribir(cb);
  await gestor.iniciar(archivo('clip.mp4', 'video/mp4', 100), 10);
  cb.mockClear();
  tarea.emitirProgreso(10, 100);
  expect(cb).toHaveBeenCalled();
});
