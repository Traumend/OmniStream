'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/marca/Logo';
import { Meandro } from '@/components/marca/Meandro';
import { useSesion } from '@/lib/firebase/sesion';

export default function Entrar() {
  const sesion = useSesion();
  const router = useRouter();
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (sesion.estado === 'autenticado') router.replace('/calendario');
  }, [sesion.estado, router]);

  const entrar = async () => {
    setEntrando(true);
    await sesion.entrar();
    setEntrando(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="neu-elevado flex w-full max-w-md flex-col items-center gap-6 px-10 py-12 text-center">
        <Logo />
        <Meandro className="w-56 text-oro-claro" />
        <h1 className="text-3xl text-texto">Bienvenido a OmniStream</h1>
        <p className="text-texto-secundario">Entra con la cuenta de Google autorizada para continuar.</p>
        <button
          type="button"
          onClick={entrar}
          disabled={entrando || sesion.estado === 'cargando'}
          className="boton-oro w-full rounded-[14px] px-6 py-3 font-heading text-lg font-semibold disabled:opacity-60"
        >
          {entrando ? 'Entrando…' : 'Entrar con Google'}
        </button>
        {sesion.estado === 'anonimo' && sesion.mensaje && (
          <p role="alert" className="text-sm text-peligro">
            {sesion.mensaje}
          </p>
        )}
      </section>
    </main>
  );
}
