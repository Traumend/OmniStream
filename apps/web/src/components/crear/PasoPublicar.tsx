'use client';

import { ETIQUETAS_RED, PLATAFORMAS, type Platform, type Problema } from '@omnistream/core';
import { ListaErrores } from '@/components/publicaciones/ListaErrores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Intencion } from '@/lib/publicaciones/revisarEnvio';
import { cn } from '@/lib/utils';
import { CAMPO, Campo, Seccion } from './comunes';

export interface PropsPasoPublicar {
  fecha: string;
  hora: string;
  zona: string;
  errores: string[];
  problemas: Problema[];
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
  problemas,
  esProgramada,
  enviando,
  alCambiarFecha,
  alEnviar,
}: PropsPasoPublicar) {
  const grupos: { titulo: string; problemas: Problema[] }[] = [
    { titulo: 'Todas las redes', problemas: problemas.filter((p) => !p.red) },
    ...PLATAFORMAS.map((red: Platform) => ({
      titulo: ETIQUETAS_RED[red],
      problemas: problemas.filter((p) => p.red === red),
    })),
  ].filter((g) => g.problemas.length > 0);
  const hayErrores = problemas.some((p) => p.nivel === 'error');
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

      <section aria-label="Resumen" className="neu-elevado flex flex-col gap-3 p-6">
        <h2 className="font-heading text-2xl text-texto">Resumen</h2>
        {grupos.length === 0 ? (
          <p className="text-exito">Todo listo para publicar.</p>
        ) : (
          <>
            {grupos.map((grupo) => (
              <div key={grupo.titulo} role="group" aria-label={grupo.titulo} className="flex flex-col gap-1">
                <h3 className="font-heading text-lg text-texto">{grupo.titulo}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {grupo.problemas.map((p) => (
                    <li
                      key={p.mensaje}
                      data-nivel={p.nivel}
                      className={cn(p.nivel === 'error' ? 'text-peligro' : 'text-alerta')}
                    >
                      {p.mensaje}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className={cn('text-sm', hayErrores ? 'text-peligro' : 'text-texto-secundario')}>
              {hayErrores
                ? 'Corrige los errores para programar o publicar.'
                : 'Las advertencias no bloquean: se pedirá confirmación.'}
            </p>
          </>
        )}
      </section>

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
