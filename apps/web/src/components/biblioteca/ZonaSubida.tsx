'use client';

import { CloudUpload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { GestorSubidas } from '@/lib/archivos/gestorSubidas';

const EXTENSIONES = '.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp,.heic';

export function ZonaSubida({ gestor, maxUploadGb }: { gestor: GestorSubidas; maxUploadGb: number }) {
  const alSoltar = async (archivos: File[]) => {
    for (const archivo of archivos) {
      const resultado = await gestor.iniciar(archivo, maxUploadGb);
      if (!resultado.ok) toast.error(`${archivo.name}: ${resultado.mensaje}`);
    }
  };
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop: alSoltar, noClick: true, multiple: true });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'neu-hundido flex flex-col items-center gap-3 border-2 border-dashed border-transparent px-6 py-10 text-center transition-colors',
        isDragActive && 'border-oro',
      )}
    >
      <input {...getInputProps()} accept={EXTENSIONES} aria-label="Elegir archivos" />
      <CloudUpload className="size-10 text-oro" strokeWidth={1.4} aria-hidden="true" />
      <p className="font-heading text-xl text-texto">Arrastra tus videos e imágenes aquí</p>
      <p className="text-sm text-texto-secundario">mp4, mov, webm, jpg, png, webp o heic · hasta {maxUploadGb} GB por archivo</p>
      <button type="button" onClick={open} className="boton-oro mt-1 rounded-[14px] px-6 py-2 font-heading text-lg font-semibold">
        Elegir archivos
      </button>
    </div>
  );
}
