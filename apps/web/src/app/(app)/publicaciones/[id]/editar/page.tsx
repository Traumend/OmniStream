'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';
import { Cargando } from '@/components/comunes/Cargando';
import { EditorExistente } from '@/components/crear/EditorExistente';

function Editar() {
  const { id } = useParams<{ id: string }>();
  return <EditorExistente id={id} titulo="Editar publicación" />;
}

export default function EditarPublicacion() {
  return (
    <section className="flex flex-col gap-6">
      <Suspense fallback={<Cargando />}>
        <Editar />
      </Suspense>
    </section>
  );
}
