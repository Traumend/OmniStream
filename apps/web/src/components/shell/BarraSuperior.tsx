'use client';

import Link from 'next/link';
import { LogOut, Menu } from 'lucide-react';
import { Logo } from '@/components/marca/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UsuarioSesion } from '@/lib/firebase/sesion';
import { NAV_SUPERIOR } from './navegacion';

function Avatar({ usuario }: { usuario: UsuarioSesion }) {
  if (usuario.foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={usuario.foto} alt="" className="size-10 rounded-full border-2 border-oro-claro object-cover" />;
  }
  const inicial = (usuario.nombre ?? usuario.email).charAt(0).toUpperCase();
  return (
    <span className="flex size-10 items-center justify-center rounded-full border-2 border-oro-claro bg-superficie-elevada font-heading text-lg text-oro-profundo">
      {inicial}
    </span>
  );
}

export function BarraSuperior({
  usuario,
  alAbrirMenu,
  alSalir,
}: {
  usuario: UsuarioSesion;
  alAbrirMenu(): void;
  alSalir(): void;
}) {
  return (
    <header className="flex items-center gap-3 px-4 py-4 sm:gap-6 sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={alAbrirMenu} aria-label="Menú">
        <Menu className="size-5" />
      </Button>
      <Link href="/biblioteca" aria-label="Ir al inicio">
        <Logo className="hidden sm:flex" />
        <Logo variante="compacto" className="sm:hidden" />
      </Link>
      <nav aria-label="Accesos" className="hidden flex-1 justify-center gap-10 xl:flex">
        {NAV_SUPERIOR.map((item) => (
          <Link
            key={item.ruta}
            href={item.ruta}
            className="etiqueta-ornamental text-xs text-texto-secundario transition-colors hover:text-oro-profundo"
          >
            {item.etiqueta}
          </Link>
        ))}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="ml-auto flex items-center gap-3 rounded-full p-1 hover:bg-accent sm:pr-3"
            aria-label="Menú de usuario"
          >
            <Avatar usuario={usuario} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-heading text-base font-semibold text-texto">
                {usuario.nombre ?? usuario.email}
              </span>
              <span className="block text-xs text-texto-secundario">Propietario</span>
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate text-texto-secundario">{usuario.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={alSalir}>
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
