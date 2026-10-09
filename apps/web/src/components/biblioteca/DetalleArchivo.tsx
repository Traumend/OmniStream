'use client';

import {
  describirProporcion,
  fechaDePurgaVisible,
  formatearBytes,
  formatearDuracion,
  formatearFechaHora,
  LOCALE,
  type Asset,
  type Fotograma,
} from '@omnistream/core';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const VISTAS_VIDEO: { fotograma: Fotograma; titulo: string; alt: string }[] = [
  { fotograma: 'start', titulo: 'Inicio', alt: 'Fotograma de inicio' },
  { fotograma: 'middle', titulo: 'Mitad', alt: 'Fotograma de la mitad' },
  { fotograma: 'end', titulo: 'Final', alt: 'Fotograma del final' },
];

function Vista({ url, alt, titulo }: { url?: string; alt: string; titulo: string }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="neu-hundido flex aspect-video items-center justify-center overflow-hidden">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className="size-full object-contain" />
        ) : (
          <span className="text-sm text-texto-secundario">Sin vista previa</span>
        )}
      </div>
      <figcaption className="etiqueta-ornamental text-center text-[0.6rem] text-texto-secundario">{titulo}</figcaption>
    </figure>
  );
}

export function DetalleArchivo({
  asset,
  urls,
  abierto,
  alCerrar,
  zonaHoraria,
  alPosponer,
}: {
  asset: Asset;
  urls: Partial<Record<Fotograma, string>>;
  abierto: boolean;
  alCerrar(): void;
  zonaHoraria?: string;
  alPosponer?(): void;
}) {
  const purga = fechaDePurgaVisible(asset);
  const esVideo = asset.kind === 'video';
  const datos: [string, string][] = [
    ['Tipo', esVideo ? 'Video' : 'Imagen'],
    ['Formato', asset.mimeType],
    ['Tamaño', formatearBytes(asset.sizeBytes)],
    ['Resolución', asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—'],
    ['Proporción', asset.aspect ? describirProporcion(asset.aspect) : '—'],
    ...(esVideo
      ? ([
          ['Duración', asset.durationSec ? formatearDuracion(asset.durationSec) : '—'],
          ['FPS', asset.fps ? String(asset.fps) : '—'],
          ['Audio', asset.hasAudio === undefined ? '—' : asset.hasAudio ? 'Sí' : 'No'],
          ['Códec', asset.codec ?? '—'],
        ] as [string, string][])
      : []),
    [
      'Fecha',
      new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short', timeZone: zonaHoraria }).format(
        asset.createdAt,
      ),
    ],
  ];

  return (
    <Dialog open={abierto} onOpenChange={(abrir) => !abrir && alCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-superficie sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">{asset.originalName}</DialogTitle>
          <DialogDescription>Datos técnicos y vista previa del archivo.</DialogDescription>
        </DialogHeader>

        {asset.status === 'fallido' && asset.error && (
          <p
            role="alert"
            className="rounded-[12px] border border-peligro/40 bg-peligro/5 px-4 py-3 text-sm text-peligro"
          >
            {asset.error}
          </p>
        )}

        {esVideo ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {VISTAS_VIDEO.map((v) => (
              <Vista key={v.fotograma} url={urls[v.fotograma]} alt={v.alt} titulo={v.titulo} />
            ))}
          </div>
        ) : (
          <Vista url={urls.start} alt="Vista de la imagen" titulo="Imagen" />
        )}

        {(purga || asset.status === 'listo') && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-borde px-4 py-3 text-sm">
            {purga ? (
              <p className="text-texto-secundario">Se purgará el {formatearFechaHora(purga, zonaHoraria ?? 'UTC')}</p>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {purga && alPosponer && (
                <Button type="button" variant="outline" size="sm" onClick={alPosponer}>
                  Posponer 7 días
                </Button>
              )}
              {asset.status === 'listo' && (
                <Button asChild size="sm" className="boton-oro">
                  <Link href={`/crear?archivo=${asset.id}`}>Crear publicación</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        <dl className="cifras grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {datos.map(([termino, valor]) => (
            <div key={termino} className="contents">
              <dt className="text-texto-secundario">{termino}</dt>
              <dd className="text-texto">{valor}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
