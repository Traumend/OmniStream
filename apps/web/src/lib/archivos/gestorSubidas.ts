import { rutaOriginal, validarArchivo, type Asset } from '@omnistream/core';

export type EstadoSubida = 'subiendo' | 'pausada' | 'error' | 'completada' | 'cancelada';

export interface ProgresoSubida {
  assetId: string;
  nombre: string;
  bytesTransferidos: number;
  bytesTotales: number;
  estado: EstadoSubida;
  error?: string;
}

export interface TareaSubida {
  alProgresar(cb: (transferidos: number, total: number) => void): void;
  pausar(): boolean;
  reanudar(): boolean;
  cancelar(): boolean;
  terminado: Promise<void>;
}

export interface MetadatosLocales {
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface DependenciasSubida {
  generarId(): string;
  crearDocumento(datos: Omit<Asset, 'createdAt'>): Promise<void>;
  subir(ruta: string, archivo: File, mime: string): TareaSubida;
  eliminarDocumento(id: string): Promise<void>;
  leerMetadatosLocales(archivo: File, tipo: 'video' | 'image'): Promise<MetadatosLocales>;
}

export interface GestorSubidas {
  iniciar(archivo: File, maxUploadGb: number): Promise<{ ok: true; assetId: string } | { ok: false; mensaje: string }>;
  pausar(id: string): void;
  reanudar(id: string): void;
  cancelar(id: string): Promise<void>;
  suscribir(cb: () => void): () => void;
  obtenerEstado(): ReadonlyMap<string, ProgresoSubida>;
  activas(): ReadonlySet<string>;
}

const MENSAJE_FALLO = 'La subida falló. Revisa tu conexión e inténtalo de nuevo.';
const MENSAJE_INICIO = 'No se pudo iniciar la subida. Revisa tu conexión e inténtalo de nuevo.';
const ESTADOS_ACTIVOS: ReadonlySet<EstadoSubida> = new Set(['subiendo', 'pausada', 'completada']);

export function crearGestorSubidas(deps: DependenciasSubida): GestorSubidas {
  let estado: ReadonlyMap<string, ProgresoSubida> = new Map();
  let activas: ReadonlySet<string> = new Set();
  const tareas = new Map<string, TareaSubida>();
  const suscriptores = new Set<() => void>();

  // Se reemplazan las colecciones en cada cambio para que useSyncExternalStore detecte la diferencia.
  // Una subida completada sigue activa hasta que el servidor cambie el estado del documento.
  const publicar = (siguiente: Map<string, ProgresoSubida>) => {
    estado = siguiente;
    activas = new Set([...siguiente.values()].filter((p) => ESTADOS_ACTIVOS.has(p.estado)).map((p) => p.assetId));
    suscriptores.forEach((cb) => cb());
  };

  const actualizar = (id: string, cambios: Partial<ProgresoSubida>) => {
    const actual = estado.get(id);
    if (!actual) return;
    publicar(new Map(estado).set(id, { ...actual, ...cambios }));
  };

  const registrar = (progreso: ProgresoSubida) => publicar(new Map(estado).set(progreso.assetId, progreso));

  const quitar = (id: string) => {
    const siguiente = new Map(estado);
    siguiente.delete(id);
    publicar(siguiente);
  };

  return {
    async iniciar(archivo, maxUploadGb) {
      const validacion = validarArchivo({ nombre: archivo.name, mime: archivo.type, bytes: archivo.size }, maxUploadGb);
      if (!validacion.ok) return { ok: false, mensaje: validacion.mensaje };

      const id = deps.generarId();
      const metadatos = await deps.leerMetadatosLocales(archivo, validacion.tipo).catch((): MetadatosLocales => ({}));
      const definidos = Object.fromEntries(Object.entries(metadatos).filter(([, v]) => v !== undefined));
      // Se registra antes de crear el documento para que la tarjeta nunca aparezca como interrumpida.
      registrar({
        assetId: id,
        nombre: archivo.name,
        bytesTransferidos: 0,
        bytesTotales: archivo.size,
        estado: 'subiendo',
      });
      try {
        await deps.crearDocumento({
          id,
          kind: validacion.tipo,
          source: 'subida',
          originalName: archivo.name,
          storagePath: rutaOriginal(id),
          mimeType: validacion.mime,
          sizeBytes: archivo.size,
          status: 'subiendo',
          ...definidos,
        });
      } catch {
        quitar(id);
        return { ok: false, mensaje: MENSAJE_INICIO };
      }

      const tarea = deps.subir(rutaOriginal(id), archivo, validacion.mime);
      tareas.set(id, tarea);
      tarea.alProgresar((transferidos, total) =>
        actualizar(id, { bytesTransferidos: transferidos, bytesTotales: total }),
      );
      tarea.terminado.then(
        () => actualizar(id, { estado: 'completada', bytesTransferidos: archivo.size }),
        () => {
          if (estado.get(id)?.estado !== 'cancelada') actualizar(id, { estado: 'error', error: MENSAJE_FALLO });
        },
      );
      return { ok: true, assetId: id };
    },
    pausar(id) {
      if (tareas.get(id)?.pausar()) actualizar(id, { estado: 'pausada' });
    },
    reanudar(id) {
      if (tareas.get(id)?.reanudar()) actualizar(id, { estado: 'subiendo' });
    },
    async cancelar(id) {
      actualizar(id, { estado: 'cancelada' });
      tareas.get(id)?.cancelar();
      await deps.eliminarDocumento(id);
    },
    suscribir(cb) {
      suscriptores.add(cb);
      return () => suscriptores.delete(cb);
    },
    obtenerEstado: () => estado,
    activas: () => activas,
  };
}
