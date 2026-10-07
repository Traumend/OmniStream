'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ConfirmarEliminacion({
  nombre,
  abierto,
  alCerrar,
  alConfirmar,
}: {
  nombre: string;
  abierto: boolean;
  alCerrar(): void;
  alConfirmar(): Promise<void>;
}) {
  const [eliminando, setEliminando] = useState(false);
  const confirmar = async () => {
    setEliminando(true);
    try {
      await alConfirmar();
    } finally {
      setEliminando(false);
    }
  };
  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && alCerrar()}>
      <DialogContent className="bg-superficie">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">¿Eliminar este archivo?</DialogTitle>
          <DialogDescription>
            Se eliminarán «{nombre}» y sus fotogramas. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={alCerrar} disabled={eliminando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmar} disabled={eliminando}>
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
