'use client';

import { ETIQUETAS_RED, type Platform } from '@omnistream/core';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { aFechaUtc } from '@/lib/fechas';
import type { FormularioOverrides } from '@/lib/publicaciones/formulario';
import { CAMPO } from '../comunes';

type Base = { text: string; hashtags: string; title: string; fecha: string; hora: string };
type Campo = 'text' | 'hashtags' | 'title' | 'hora';

const NOMBRES: Record<Campo, string> = { text: 'texto', hashtags: 'hashtags', title: 'título', hora: 'hora' };

export interface PropsAjustesRed {
  red: Platform;
  base: Base;
  overrides: FormularioOverrides;
  zona: string;
  ahora?: () => Date;
  alCambiar(overrides: FormularioOverrides): void;
}

function Ajuste({
  campo,
  vinculado,
  alDesvincular,
  alRevincular,
  children,
}: {
  campo: Campo;
  vinculado: boolean;
  alDesvincular(): void;
  alRevincular(): void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-texto-secundario">{vinculado ? 'Heredado' : 'Propio de esta red'}</span>
        <Button type="button" variant="outline" size="sm" onClick={vinculado ? alDesvincular : alRevincular}>
          {vinculado ? `Desvincular ${NOMBRES[campo]}` : `Revincular ${NOMBRES[campo]}`}
        </Button>
      </div>
    </div>
  );
}

// Spec 8.3: cada campo hereda el valor base; "Desvincular" lo copia a overrides para editarlo y "Revincular" lo
// borra. El recorte, que también es un ajuste por red, lo maneja MarcoRecorte.
export function AjustesRed({ red, base, overrides, zona, ahora = () => new Date(), alCambiar }: PropsAjustesRed) {
  const nombre = ETIQUETAS_RED[red];
  const id = (campo: string) => `ajuste-${red}-${campo}`;
  const cambiar = (cambios: Partial<FormularioOverrides>) => alCambiar({ ...overrides, ...cambios });
  const quitar = (...campos: (keyof FormularioOverrides)[]) =>
    alCambiar(Object.fromEntries(Object.entries(overrides).filter(([clave]) => !campos.includes(clave as never))));

  const horaPropia = overrides.fecha !== undefined && overrides.hora !== undefined;
  const fecha = horaPropia ? overrides.fecha! : base.fecha;
  const hora = horaPropia ? overrides.hora! : base.hora;
  const vencida = horaPropia && fecha && hora ? aFechaUtc(fecha, hora, zona).getTime() <= ahora().getTime() : false;

  return (
    <section aria-label={`Ajustes de ${nombre}`} className="flex flex-col gap-4">
      <h3 className="font-heading text-lg text-texto">Ajustes de {nombre}</h3>

      <Ajuste
        campo="text"
        vinculado={overrides.text === undefined}
        alDesvincular={() => cambiar({ text: base.text })}
        alRevincular={() => quitar('text')}
      >
        <Label htmlFor={id('texto')}>Texto de {nombre}</Label>
        <Textarea
          id={id('texto')}
          rows={4}
          readOnly={overrides.text === undefined}
          value={overrides.text ?? base.text}
          onChange={(e) => cambiar({ text: e.target.value })}
          className="rounded-[12px] bg-superficie-elevada text-base read-only:opacity-70"
        />
      </Ajuste>

      <Ajuste
        campo="hashtags"
        vinculado={overrides.hashtags === undefined}
        alDesvincular={() => cambiar({ hashtags: base.hashtags })}
        alRevincular={() => quitar('hashtags')}
      >
        <Label htmlFor={id('hashtags')}>Hashtags de {nombre}</Label>
        <Input
          id={id('hashtags')}
          readOnly={overrides.hashtags === undefined}
          value={overrides.hashtags ?? base.hashtags}
          onChange={(e) => cambiar({ hashtags: e.target.value })}
          className={`${CAMPO} read-only:opacity-70`}
        />
      </Ajuste>

      {red === 'youtube' && (
        <Ajuste
          campo="title"
          vinculado={overrides.title === undefined}
          alDesvincular={() => cambiar({ title: base.title })}
          alRevincular={() => quitar('title')}
        >
          <Label htmlFor={id('titulo')}>Título de {nombre}</Label>
          <Input
            id={id('titulo')}
            readOnly={overrides.title === undefined}
            value={overrides.title ?? base.title}
            onChange={(e) => cambiar({ title: e.target.value })}
            className={`${CAMPO} read-only:opacity-70`}
          />
        </Ajuste>
      )}

      <Ajuste
        campo="hora"
        vinculado={!horaPropia}
        alDesvincular={() => cambiar({ fecha: base.fecha, hora: base.hora })}
        alRevincular={() => quitar('fecha', 'hora')}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={id('fecha')}>Fecha de {nombre}</Label>
            <Input
              id={id('fecha')}
              type="date"
              readOnly={!horaPropia}
              value={fecha}
              onChange={(e) => cambiar({ fecha: e.target.value, hora })}
              className={`${CAMPO} read-only:opacity-70`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={id('hora')}>Hora de {nombre}</Label>
            <Input
              id={id('hora')}
              type="time"
              readOnly={!horaPropia}
              value={hora}
              onChange={(e) => cambiar({ fecha, hora: e.target.value })}
              className={`${CAMPO} read-only:opacity-70`}
            />
          </div>
        </div>
        {vencida && <p className="text-sm text-peligro">La hora programada ya pasó.</p>}
      </Ajuste>
    </section>
  );
}
