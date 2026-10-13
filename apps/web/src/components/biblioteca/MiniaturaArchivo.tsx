'use client';

import type { Asset } from '@omnistream/core';
import { Film, ImageIcon } from 'lucide-react';
import { useUrlsFotogramas } from '@/lib/archivos/repositorio';

export function MiniaturaArchivo({ asset }: { asset: Asset }) {
  const urls = useUrlsFotogramas(asset);
  const Icono = asset.kind === 'image' ? ImageIcon : Film;
  return (
    <span className="neu-hundido relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
      {urls.start ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={urls.start} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icono className="size-5 text-oro" strokeWidth={1.6} aria-hidden="true" />
      )}
    </span>
  );
}
