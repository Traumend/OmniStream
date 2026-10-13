'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const PESTANAS = [
  { href: '/ajustes/general', etiqueta: 'General' },
  { href: '/ajustes/conexiones', etiqueta: 'Conexiones' },
] as const;

export function PestanasAjustes() {
  const ruta = usePathname();
  return (
    <nav aria-label="Ajustes" className="flex gap-2 border-b border-borde">
      {PESTANAS.map(({ href, etiqueta }) => {
        const activa = ruta === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-texto-secundario',
              activa ? 'border-oro font-medium text-texto' : 'border-transparent hover:text-texto',
            )}
          >
            {etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
