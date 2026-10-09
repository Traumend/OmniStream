'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ajustesAppSchema, type AjustesApp } from '@omnistream/core';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PlantillaPromocion } from './PlantillaPromocion';

function MensajeError({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-peligro">{mensaje}</p> : null;
}

function SelectorZona({
  id,
  valor,
  zonas,
  alCambiar,
}: {
  id: string;
  valor: string;
  zonas: string[];
  alCambiar(z: string): void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={abierto}
          className="h-11 w-full justify-between rounded-[12px] bg-superficie-elevada text-base font-normal"
        >
          {valor}
          <ChevronsUpDown className="size-4 text-texto-secundario" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar zona horaria…" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            {zonas.map((zona) => (
              <CommandItem
                key={zona}
                value={zona}
                onSelect={() => {
                  alCambiar(zona);
                  setAbierto(false);
                }}
              >
                <Check className={cn('size-4', zona === valor ? 'opacity-100' : 'opacity-0')} />
                {zona}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Primer mensaje de error dentro de un campo anidado (la plantilla es una lista de objetos).
function primerMensaje(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const { message } = error as { message?: unknown };
  if (typeof message === 'string') return message;
  for (const valor of Object.values(error)) {
    const encontrado = primerMensaje(valor);
    if (encontrado) return encontrado;
  }
  return undefined;
}

export function FormularioAjustes({
  valores,
  zonas,
  alGuardar,
}: {
  valores: AjustesApp;
  zonas: string[];
  alGuardar(v: AjustesApp): Promise<void>;
}) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AjustesApp>({ resolver: zodResolver(ajustesAppSchema), defaultValues: valores });

  const claveValores = JSON.stringify(valores);
  useEffect(() => {
    reset(JSON.parse(claveValores) as AjustesApp);
  }, [claveValores, reset]);

  return (
    <form onSubmit={handleSubmit((datos) => alGuardar(datos))} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="zona-horaria" className="font-heading text-lg">
          Zona horaria
        </Label>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <SelectorZona id="zona-horaria" valor={field.value} zonas={zonas} alCambiar={field.onChange} />
          )}
        />
        <p className="text-sm text-texto-secundario">Las fechas y horas se muestran en esta zona.</p>
        <MensajeError mensaje={errors.timezone?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="retencion" className="font-heading text-lg">
          Días de retención
        </Label>
        <Input
          id="retencion"
          type="number"
          min={0}
          max={90}
          className="cifras h-11 rounded-[12px] bg-superficie-elevada text-base"
          aria-invalid={!!errors.retentionDays}
          {...register('retentionDays', { valueAsNumber: true })}
        />
        <p className="text-sm text-texto-secundario">
          Días que se conservan los archivos originales después de publicarse en todas las redes.
        </p>
        <p className="text-sm text-texto-secundario">0 = borrar el video en cuanto se publica en todas sus redes.</p>
        <MensajeError mensaje={errors.retentionDays?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tamano-maximo" className="font-heading text-lg">
          Tamaño máximo de subida (GB)
        </Label>
        <Input
          id="tamano-maximo"
          type="number"
          min={1}
          max={50}
          className="cifras h-11 rounded-[12px] bg-superficie-elevada text-base"
          aria-invalid={!!errors.maxUploadGb}
          {...register('maxUploadGb', { valueAsNumber: true })}
        />
        <p className="text-sm text-texto-secundario">Límite por archivo.</p>
        <MensajeError mensaje={errors.maxUploadGb?.message} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg">Plantilla de promoción</h2>
        <p className="text-sm text-texto-secundario">
          Lo que recibe cada video principal nuevo para darle exposición: shorts, comunidad y tus propios medios.
        </p>
        <Controller
          control={control}
          name="promotionTemplate"
          render={({ field }) => <PlantillaPromocion valores={field.value} alCambiar={field.onChange} />}
        />
        <MensajeError mensaje={primerMensaje(errors.promotionTemplate)} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="boton-oro self-start rounded-[14px] px-8 py-2.5 font-heading text-lg font-semibold disabled:opacity-60"
      >
        {isSubmitting ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
