'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ENLACE = 'text-oro-profundo underline underline-offset-2';

// Trae como Principal un video ya subido o programado en YouTube: solo sus datos, sin descargarlo.
export function ImportarYoutube({
  conectado,
  alImportar,
}: {
  conectado: boolean;
  alImportar(url: string): Promise<void>;
}) {
  const [url, setUrl] = useState('');
  const [importando, setImportando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const limpia = url.trim();
    if (!limpia) return;
    setImportando(true);
    try {
      await alImportar(limpia);
    } finally {
      setImportando(false);
    }
  }

  return (
    <section aria-label="Importar desde YouTube" className="neu-elevado flex flex-col gap-4 p-6">
      <h2 className="font-heading text-2xl text-texto">Importar desde YouTube</h2>
      {conectado ? (
        <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="url-youtube" className="font-heading text-lg">
              URL del video de YouTube
            </Label>
            <Input
              id="url-youtube"
              type="url"
              inputMode="url"
              placeholder="https://youtu.be/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-11 rounded-[12px] bg-superficie-elevada text-base"
            />
          </div>
          <Button type="submit" className="boton-oro h-11" disabled={importando || !url.trim()}>
            {importando ? 'Importando…' : 'Importar'}
          </Button>
        </form>
      ) : (
        <p className="text-texto-secundario">
          Conecta YouTube en{' '}
          <Link href="/ajustes/conexiones" className={ENLACE}>
            Ajustes &gt; Conexiones
          </Link>{' '}
          para importar videos.
        </p>
      )}
      <p className="text-sm text-texto-secundario">
        Úsalo para un video que ya subiste o programaste en YouTube: OmniStream solo guarda sus datos y le crea su lista
        de promoción.
      </p>
    </section>
  );
}
