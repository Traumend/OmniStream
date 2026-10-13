import {
  LEASE_MS,
  type Asset,
  type Destino,
  type DestinoEfectivo,
  type Platform,
  type RemoteRef,
} from '@omnistream/core';
import type {
  Checkpoint,
  Http,
  PlatformAdapter,
  PlatformError,
  PublishContext,
  SesionProveedor,
} from '@omnistream/platforms';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { Encolador } from './cola';
import type { FuentesPublicacion } from './fuentes';

export interface DependenciasApi {
  adaptador(red: Platform): PlatformAdapter;
  sesion(red: Platform): Promise<SesionProveedor>;
  fuentes(asset: Asset, destino: Destino): Promise<FuentesPublicacion>;
  marcarExpirada(red: Platform, error: PlatformError): Promise<void>;
  encolar: Encolador;
  http: Http;
  presupuestoMs: number;
}

export const PRESUPUESTO_API_MS = 25 * 60 * 1000;

export type ResultadoApi =
  | { tipo: 'hecho'; remote: RemoteRef }
  | { tipo: 'esperar'; delaySec: number; seq: number }
  | { tipo: 'error'; error: PlatformError }
  | { tipo: 'perdido' };

type CheckpointGuardado = Checkpoint & { seq: number };

// Ejecuta etapas del conector mientras quede presupuesto. Cada etapa intermedia se guarda con su seq y extiende el
// lease, solo si el lease sigue siendo de este intento: así otra ejecución retoma desde la última etapa confirmada.
export async function avanzarPorApi(p: {
  db: Firestore;
  ref: DocumentReference;
  attemptId: string;
  checkpoint: CheckpointGuardado | null;
  efectivo: DestinoEfectivo;
  adaptador: PlatformAdapter;
  ctx: PublishContext;
  ahora: () => Date;
  presupuestoMs: number;
}): Promise<ResultadoApi> {
  const inicio = p.ahora().getTime();
  let checkpoint = p.checkpoint;
  let ctx = p.ctx;
  for (;;) {
    const resultado = await p.adaptador.publishStep(
      p.efectivo,
      checkpoint ? { stage: checkpoint.stage, data: checkpoint.data } : null,
      ctx,
    );
    if (resultado.kind === 'done') return { tipo: 'hecho', remote: resultado.remote };
    if (resultado.kind === 'error') return { tipo: 'error', error: resultado.error };

    const nuevo: CheckpointGuardado = { ...resultado.checkpoint, seq: (checkpoint?.seq ?? 0) + 1 };
    const ahora = p.ahora();
    const vigente = await p.db.runTransaction(async (tx) => {
      const actual = await tx.get(p.ref);
      if (!actual.exists || actual.get('lease.attemptId') !== p.attemptId) return false;
      tx.update(p.ref, { checkpoint: nuevo, 'lease.until': new Date(ahora.getTime() + LEASE_MS) });
      return true;
    });
    if (!vigente) return { tipo: 'perdido' };
    checkpoint = nuevo;
    // Solo la primera etapa de una ejecución retoma un trabajo interrumpido.
    ctx = { ...ctx, reanudando: false };

    const delaySec = resultado.delaySec ?? 0;
    if (delaySec > 0 || ahora.getTime() - inicio >= p.presupuestoMs) {
      return { tipo: 'esperar', delaySec, seq: nuevo.seq };
    }
  }
}
