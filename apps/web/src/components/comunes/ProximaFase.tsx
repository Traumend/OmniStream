import { Laurel } from '@/components/marca/Laurel';
import { Meandro } from '@/components/marca/Meandro';

export function ProximaFase({ titulo, fase, descripcion }: { titulo: string; fase: number; descripcion: string }) {
  return (
    <section className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-4 text-center">
      <div className="neu-elevado flex w-full flex-col items-center gap-4 px-10 py-12">
        <Laurel className="size-14 text-oro" />
        <h1 className="text-4xl text-texto">{titulo}</h1>
        <p className="text-texto-secundario">{descripcion}</p>
        <p className="etiqueta-ornamental text-xs text-oro-profundo">Disponible en la fase {fase}</p>
        <Meandro className="mt-2 w-48 text-oro-claro" />
      </div>
    </section>
  );
}
