import { ETIQUETAS_ESTADO_PUBLICACION, type Publicacion } from '@omnistream/core';
import Link from 'next/link';

export function BorradoresSinFecha({ publicaciones }: { publicaciones: Publicacion[] }) {
  return (
    <section aria-labelledby="titulo-sin-fecha" className="neu-elevado flex flex-col gap-3 p-5">
      <h2 id="titulo-sin-fecha" className="font-heading text-xl text-texto">
        Borradores sin fecha
      </h2>
      {publicaciones.length === 0 ? (
        <p className="text-sm text-texto-secundario">No hay borradores sin fecha.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {publicaciones.map((p) => (
            <li key={p.id} className="flex flex-col">
              <Link href={`/publicaciones/${p.id}`} className="text-oro-profundo underline underline-offset-2">
                {p.title}
              </Link>
              <span className="text-xs text-texto-secundario">{ETIQUETAS_ESTADO_PUBLICACION[p.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
