'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { crearDependenciasFirebase } from './dependenciasFirebase';
import { crearGestorSubidas, type GestorSubidas, type ProgresoSubida } from './gestorSubidas';

let gestor: GestorSubidas | undefined;
const obtenerGestor = () => (gestor ??= crearGestorSubidas(crearDependenciasFirebase()));

const ESTADO_VACIO: ReadonlyMap<string, ProgresoSubida> = new Map();
const ACTIVAS_VACIAS: ReadonlySet<string> = new Set();

export function useSubidas() {
  const instancia = obtenerGestor();
  const estado = useSyncExternalStore(instancia.suscribir, instancia.obtenerEstado, () => ESTADO_VACIO);
  const activas = useSyncExternalStore(instancia.suscribir, instancia.activas, () => ACTIVAS_VACIAS);

  // Avisa antes de cerrar la pestaña si hay subidas en curso.
  const hayActivas = activas.size > 0;
  useEffect(() => {
    if (!hayActivas) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [hayActivas]);

  return { gestor: instancia, estado, activas };
}
