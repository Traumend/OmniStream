'use client';

import { ListaErrores } from '@/components/publicaciones/ListaErrores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Intencion } from '@/lib/publicaciones/revisarEnvio';
import { CAMPO, Campo, Seccion } from './comunes';

export interface PropsPasoPublicar {
  fecha: string;
  hora: string;
  zona: string;
  errores: string[];
  esProgramada: boolean;
  enviando: boolean;
  alCambiarFecha(cambios: { fecha?: string; hora?: string }): void;
  alEnviar(intencion: Intencion): void;
}

// Spec 8.6: fecha y hora en la zona configurada, errores que bloquean y los botones de envío.
export function PasoPublicar({
  fecha,
  hora,
  zona,
  errores,
  esProgramada,
  enviando,
  alCambiarFecha,
  alEnviar,
}: PropsPasoPublicar) {
  return (
    <>
      <Seccion titulo="Fecha y hora">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="fecha" etiqueta="Fecha">
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => alCambiarFecha({ fecha: e.target.value })}
              className={CAMPO}
            />
          </Campo>
          <Campo id="hora" etiqueta="Hora">
            <Input
              id="hora"
              type="time"
              value={hora}
              onChange={(e) => alCambiarFecha({ hora: e.target.value })}
              className={CAMPO}
            />
          </Campo>
        </div>
        <p className="text-sm text-texto-secundario">Zona horaria: {zona}</p>
      </Seccion>

      <ListaErrores errores={errores} />

      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" disabled={enviando} onClick={() => alEnviar('guardar')}>
          {esProgramada ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
        {!esProgramada && (
          <Button type="button" variant="outline" disabled={enviando} onClick={() => alEnviar('programar')}>
            Programar
          </Button>
        )}
        <Button type="button" className="boton-oro" disabled={enviando} onClick={() => alEnviar('publicar_ahora')}>
          Publicar ahora
        </Button>
      </div>
    </>
  );
}
