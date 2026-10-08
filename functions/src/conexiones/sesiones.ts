import {
  avisoConexion,
  ETIQUETAS_RED,
  PROVEEDORES,
  proveedorDe,
  REDES_DE_PROVEEDOR,
  type Platform,
  type Proveedor,
} from '@omnistream/core';
import { esPlatformError, PlatformError, type OAuthProvider, type SesionProveedor } from '@omnistream/platforms';
import { FieldValue, getFirestore, type Firestore, type UpdateData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { claveCifrado, REGION, SECRETOS_CONECTORES } from '../config';
import { crearNotificador, enviarPushFcm, type Notificador } from '../publicacion/notificaciones';
import { crearCifrador, type Cifrador } from './cifrado';
import { proveedoresReales } from './proveedores';
import { guardarSesion, leerSesion } from './secretos';

export interface DependenciasSesion {
  db: Firestore;
  cifrador: Cifrador;
  proveedores: Record<Proveedor, OAuthProvider>;
  ahora: () => Date;
  notificar: Notificador;
}

const MARGEN_MS = 10 * 60_000;

// Vencimiento que se muestra en la conexión: el del token de actualización cuando lo hay (TikTok).
// En YouTube el acceso dura una hora y se renueva solo, así que no se muestra.
export function vencimientoDeConexion(proveedor: Proveedor, sesion: SesionProveedor): Date | undefined {
  const ms = sesion.refreshExpiresAt ?? (proveedor === 'youtube' ? undefined : sesion.expiresAt);
  return ms === undefined ? undefined : new Date(ms);
}

// Actualiza las redes del proveedor que están conectadas (o vencidas); devuelve cuáles cambió.
async function actualizarRedes(
  db: Firestore,
  proveedor: Proveedor,
  campos: UpdateData<FirebaseFirestore.DocumentData>,
): Promise<Platform[]> {
  const cambiadas: Platform[] = [];
  for (const red of REDES_DE_PROVEEDOR[proveedor]) {
    const ref = db.collection('connections').doc(red);
    const doc = await ref.get();
    if (!doc.exists || doc.get('authStatus') === 'sin_conectar') continue;
    await ref.update(campos);
    cambiadas.push(red);
  }
  return cambiadas;
}

async function renovar(
  proveedor: Proveedor,
  sesion: SesionProveedor,
  deps: DependenciasSesion,
): Promise<SesionProveedor> {
  const nueva = await deps.proveedores[proveedor].refresh(sesion);
  await guardarSesion(deps.db, deps.cifrador, proveedor, nueva, deps.ahora());
  return nueva;
}

export async function marcarExpirada(
  proveedor: Proveedor,
  error: PlatformError,
  deps: DependenciasSesion,
): Promise<void> {
  const ahora = deps.ahora();
  const redes = await actualizarRedes(deps.db, proveedor, {
    authStatus: 'expirada',
    lastError: { code: error.code, message: error.message, at: ahora },
  });
  const dia = ahora.toISOString().slice(0, 10);
  for (const red of redes) await deps.notificar(`conexion-${red}-${dia}`, avisoConexion(red));
}

// Sesión lista para usar: la renueva si vence en menos de 10 minutos (spec 7.5).
export async function sesionVigente(red: Platform, deps: DependenciasSesion): Promise<SesionProveedor> {
  const proveedor = proveedorDe(red);
  const sesion = await leerSesion(deps.db, deps.cifrador, proveedor);
  if (!sesion) throw new PlatformError('auth', 'sin_conexion', `${ETIQUETAS_RED[red]} no está conectada.`);
  if (sesion.expiresAt === undefined || sesion.expiresAt - deps.ahora().getTime() >= MARGEN_MS) return sesion;
  try {
    const nueva = await renovar(proveedor, sesion, deps);
    await actualizarRedes(deps.db, proveedor, {
      tokenExpiresAt: vencimientoDeConexion(proveedor, nueva) ?? FieldValue.delete(),
    });
    return nueva;
  } catch (error) {
    if (esPlatformError(error) && error.kind === 'auth') await marcarExpirada(proveedor, error, deps);
    throw error;
  }
}

// Renueva TikTok y valida Meta y YouTube a diario; un acceso revocado se marca y se avisa.
export async function renovarSesionesAhora(deps: DependenciasSesion): Promise<{ renovadas: number; vencidas: number }> {
  let renovadas = 0;
  let vencidas = 0;
  for (const proveedor of PROVEEDORES) {
    try {
      const sesion = await leerSesion(deps.db, deps.cifrador, proveedor);
      if (!sesion) continue;
      const nueva = await renovar(proveedor, sesion, deps);
      await actualizarRedes(deps.db, proveedor, {
        authStatus: 'conectada',
        tokenExpiresAt: vencimientoDeConexion(proveedor, nueva) ?? FieldValue.delete(),
        lastError: FieldValue.delete(),
      });
      renovadas++;
    } catch (error) {
      if (esPlatformError(error) && error.kind === 'auth') {
        await marcarExpirada(proveedor, error, deps);
        vencidas++;
      } else if (esPlatformError(error)) {
        logger.warn('No se pudo renovar el acceso', {
          proveedor,
          kind: error.kind,
          code: error.code,
          message: error.message,
        });
      } else {
        // Sin el mensaje: un error inesperado podría incluir datos de la sesión.
        logger.error('Falló la renovación del acceso', {
          proveedor,
          error: error instanceof Error ? error.name : 'desconocido',
        });
      }
    }
  }
  return { renovadas, vencidas };
}

export const renovarSesiones = onSchedule(
  { schedule: 'every day 03:00', timeZone: 'UTC', region: REGION, secrets: SECRETOS_CONECTORES },
  async () => {
    const db = getFirestore();
    const resultado = await renovarSesionesAhora({
      db,
      cifrador: crearCifrador(claveCifrado.value()),
      proveedores: proveedoresReales(),
      ahora: () => new Date(),
      notificar: crearNotificador(db, enviarPushFcm()),
    });
    logger.info('Accesos renovados', resultado);
  },
);
