'use client';

import type { Crop, FormatoDestino, Platform } from '@omnistream/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Seccion } from './comunes';
import { MaquetaTelefono } from './vista/MaquetaTelefono';

export interface DestinoVista {
  platform: Platform;
  format: FormatoDestino;
  crop?: Crop;
  titulo?: string;
  texto: string;
}

export interface PropsPasoVistaPrevia {
  destinos: DestinoVista[];
  cuentas: Partial<Record<Platform, { nombre: string; avatarUrl?: string }>>;
  medio?: { tipo: 'video' | 'imagen'; url: string };
  proporcionArchivo?: number;
}

// Spec 8.5: una maqueta por red, lado a lado; en pantallas angostas se ve una a la vez.
export function PasoVistaPrevia({ destinos, cuentas, medio, proporcionArchivo }: PropsPasoVistaPrevia) {
  const [indice, setIndice] = useState(0);
  const actual = Math.min(indice, Math.max(destinos.length - 1, 0));
  return (
    <Seccion titulo="Vista previa">
      {destinos.length === 0 ? (
        <p className="text-texto-secundario">Elige al menos una red en Destinos.</p>
      ) : (
        <>
          <div className="flex flex-wrap justify-center gap-6">
            {destinos.map((destino, i) => (
              <div key={destino.platform} className={cn(i !== actual && 'hidden md:block')}>
                <MaquetaTelefono
                  red={destino.platform}
                  formato={destino.format}
                  cuenta={cuentas[destino.platform] ?? { nombre: 'Tu cuenta' }}
                  medio={medio}
                  proporcionArchivo={proporcionArchivo}
                  crop={destino.crop}
                  titulo={destino.titulo}
                  texto={destino.texto}
                />
              </div>
            ))}
          </div>
          {destinos.length > 1 && (
            <div className="flex justify-center gap-3 md:hidden">
              <Button type="button" variant="outline" disabled={actual === 0} onClick={() => setIndice(actual - 1)}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={actual === destinos.length - 1}
                onClick={() => setIndice(actual + 1)}
              >
                Siguiente
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </>
      )}
      <p className="text-center text-sm text-texto-secundario">
        Aproximación de cómo se verá; cada red muestra su propia interfaz.
      </p>
    </Seccion>
  );
}
