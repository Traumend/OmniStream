import type { Metadata } from 'next';
import { Cinzel, Cormorant_Garamond, Source_Serif_4 } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import './globals.css';

const fuenteTitulo = Cormorant_Garamond({
  variable: '--fuente-titulo',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const fuenteOrnamental = Cinzel({
  variable: '--fuente-ornamental',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const fuenteTexto = Source_Serif_4({
  variable: '--fuente-texto',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'OmniStream',
  description: 'Una visión. Cada plataforma.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${fuenteTitulo.variable} ${fuenteOrnamental.variable} ${fuenteTexto.variable} h-full antialiased`}
    >
      <body className="fondo-marmol min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
