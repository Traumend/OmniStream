'use client';

import { AJUSTES_POR_DEFECTO, type AjustesApp } from '@omnistream/core';
import { useEffect, useState } from 'react';
import { escucharAjustes } from './repositorio';

export function useAjustes(): AjustesApp {
  const [ajustes, setAjustes] = useState<AjustesApp>(AJUSTES_POR_DEFECTO);
  useEffect(() => escucharAjustes((leidos) => setAjustes(leidos)), []);
  return ajustes;
}
