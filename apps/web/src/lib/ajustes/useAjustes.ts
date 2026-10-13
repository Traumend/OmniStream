'use client';

import { AJUSTES_POR_DEFECTO, type AjustesApp } from '@omnistream/core';
import { useEffect, useState } from 'react';
import { escucharAjustes } from './repositorio';

export function useEstadoAjustes(): { ajustes: AjustesApp; cargando: boolean } {
  const [estado, setEstado] = useState({ ajustes: AJUSTES_POR_DEFECTO, cargando: true });
  useEffect(() => escucharAjustes((ajustes) => setEstado({ ajustes, cargando: false })), []);
  return estado;
}

export function useAjustes(): AjustesApp {
  return useEstadoAjustes().ajustes;
}
