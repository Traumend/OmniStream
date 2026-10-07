import { cn } from '@/lib/utils';
import { Laurel } from './Laurel';

export function Logo({ variante = 'completo', className }: { variante?: 'completo' | 'compacto'; className?: string }) {
  const compacto = variante === 'compacto';
  return (
    <div role="img" aria-label="OmniStream" className={cn('flex items-center gap-2.5', className)}>
      <Laurel className={cn('shrink-0 text-oro', compacto ? 'size-9' : 'size-12')} />
      <div className="leading-none">
        <span className={cn('font-heading font-semibold text-oro-profundo', compacto ? 'text-2xl' : 'text-4xl')}>
          OmniStream
        </span>
        {!compacto && (
          <span className="etiqueta-ornamental mt-1.5 block text-[0.62rem] text-texto-secundario">
            UNA VISIÓN. CADA PLATAFORMA.
          </span>
        )}
      </div>
    </div>
  );
}
