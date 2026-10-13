'use client';

import { ETIQUETAS_RED, type Platform } from '@omnistream/core';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmarEnvio({
  abierto,
  inmediata,
  redes,
  advertencias,
  enviando,
  alCerrar,
  alConfirmar,
}: {
  abierto: boolean;
  inmediata: boolean;
  redes: readonly Platform[];
  advertencias: readonly string[];
  enviando: boolean;
  alCerrar(): void;
  alConfirmar(): void;
}) {
  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && alCerrar()}>
      <DialogContent className="bg-superficie">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">
            {inmediata ? 'Confirmar publicación' : 'Confirmar programación'}
          </DialogTitle>
          <DialogDescription>
            {`${redes.length} ${redes.length === 1 ? 'red' : 'redes'}: ${redes.map((r) => ETIQUETAS_RED[r]).join(', ')}.`}
          </DialogDescription>
        </DialogHeader>
        {advertencias.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="font-heading text-lg text-alerta">Advertencias</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-texto-secundario">
              {advertencias.map((mensaje) => (
                <li key={mensaje}>{mensaje}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-texto-secundario">Sin advertencias.</p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={alCerrar}>
            Volver
          </Button>
          <Button type="button" className="boton-oro" disabled={enviando} onClick={alConfirmar}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
