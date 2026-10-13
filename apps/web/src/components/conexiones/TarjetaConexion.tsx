'use client';

import {
  ETIQUETAS_ESTADO_CONEXION,
  ETIQUETAS_PROVEEDOR,
  ETIQUETAS_RED,
  formatearFechaHora,
  proveedorDe,
  puedePublicarPorApi,
  REDES_DE_PROVEEDOR,
  type Conexion,
  type ModoPublicacion,
  type Platform,
} from '@omnistream/core';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface CambiosConexion {
  publishMode?: ModoPublicacion;
  readEnabled?: boolean;
  mediaVerified?: boolean;
}

const NOTAS_API: Record<Platform, string> = {
  youtube: 'Mientras Google no audite la app, los videos subidos por API quedan privados.',
  tiktok: 'Mientras TikTok no apruebe la app, lo publicado por API solo lo ves tú y tu cuenta debe ser privada.',
  facebook: 'Con la app de Meta en modo desarrollo, solo las personas con rol en la app ven lo publicado.',
  instagram: 'Con la app de Meta en modo desarrollo, solo las personas con rol en la app ven lo publicado.',
};

const SELECTOR = 'h-11 w-full rounded-[12px] border border-borde bg-superficie-elevada px-3 text-base text-texto';

// "Facebook e Instagram": la conjunción "y" pasa a "e" ante una palabra que empieza con el sonido "i".
function unirRedes(redes: readonly Platform[]): string {
  const nombres = redes.map((r) => ETIQUETAS_RED[r]);
  if (nombres.length < 2) return nombres.join('');
  const ultimo = nombres.at(-1) as string;
  return `${nombres.slice(0, -1).join(', ')} ${/^h?i/i.test(ultimo) ? 'e' : 'y'} ${ultimo}`;
}

export function TarjetaConexion({
  conexion,
  zona,
  ocupado,
  alConectar,
  alDesconectar,
  alConfigurar,
}: {
  conexion: Conexion;
  zona: string;
  ocupado: boolean;
  alConectar(): void;
  alDesconectar(): void;
  alConfigurar(cambios: CambiosConexion): void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const red = conexion.platform;
  const nombre = ETIQUETAS_RED[red];
  const proveedor = proveedorDe(red);
  const nombreProveedor = ETIQUETAS_PROVEEDOR[proveedor];
  const permiteApi = puedePublicarPorApi(conexion);
  const sinConectar = conexion.authStatus === 'sin_conectar';
  const conProblema = conexion.authStatus === 'expirada' || conexion.authStatus === 'error';
  const idModo = `modo-${red}`;

  return (
    <section aria-label={nombre} className="neu-elevado flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-2xl text-texto">{nombre}</h2>
        <span
          className={cn(
            'rounded-full border px-3 py-1 text-sm',
            conexion.authStatus === 'conectada' && 'border-exito text-exito',
            conProblema && 'border-peligro text-peligro',
            sinConectar && 'border-borde text-texto-secundario',
          )}
        >
          {ETIQUETAS_ESTADO_CONEXION[conexion.authStatus]}
        </span>
      </header>

      {conexion.account && (
        <div className="flex items-center gap-3">
          {conexion.account.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- avatar externo de la red, sin optimizar
            <img src={conexion.account.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
          )}
          <div className="flex flex-col">
            <span className="text-texto">{conexion.account.name}</span>
            {conexion.account.handle && (
              <span className="text-sm text-texto-secundario">{`@${conexion.account.handle}`}</span>
            )}
          </div>
        </div>
      )}
      {conexion.tokenExpiresAt && conexion.authStatus === 'conectada' && (
        <p className="text-sm text-texto-secundario">
          {`Acceso vigente hasta ${formatearFechaHora(conexion.tokenExpiresAt, zona)}`}
        </p>
      )}
      {conProblema && conexion.lastError && <p className="text-sm text-peligro">{conexion.lastError.message}</p>}

      <div className="flex flex-col gap-2">
        <label htmlFor={idModo} className="text-sm font-medium text-texto">
          Modo de publicación
        </label>
        <select
          id={idModo}
          value={conexion.publishMode}
          disabled={ocupado}
          onChange={(e) => alConfigurar({ publishMode: e.target.value as ModoPublicacion })}
          className={SELECTOR}
        >
          <option value="manual">Manual</option>
          <option value="api" disabled={!permiteApi}>
            Por API
          </option>
        </select>
        {!permiteApi && <p className="text-sm text-texto-secundario">{`Conecta ${nombre} para publicar por API.`}</p>}
        {conexion.publishMode === 'api' && <p className="text-sm text-texto-secundario">{NOTAS_API[red]}</p>}
      </div>

      <label className="flex items-center gap-2 text-texto">
        <input
          type="checkbox"
          checked={conexion.readEnabled}
          disabled={ocupado}
          onChange={(e) => alConfigurar({ readEnabled: e.target.checked })}
          className="size-4 accent-[var(--oro)]"
        />
        Leer métricas
      </label>
      {red === 'tiktok' && (
        <label className="flex items-center gap-2 text-texto">
          <input
            type="checkbox"
            checked={conexion.mediaVerified === true}
            disabled={ocupado}
            onChange={(e) => alConfigurar({ mediaVerified: e.target.checked })}
            className="size-4 accent-[var(--oro)]"
          />
          Dominio verificado en TikTok para fotos
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {sinConectar ? (
          <Button type="button" className="boton-oro" disabled={ocupado} onClick={alConectar}>
            {`Conectar con ${nombreProveedor}`}
          </Button>
        ) : (
          <>
            <Button type="button" className="boton-oro" disabled={ocupado} onClick={alConectar}>
              Reconectar
            </Button>
            <Button type="button" variant="outline" disabled={ocupado} onClick={() => setConfirmando(true)}>
              Desconectar
            </Button>
          </>
        )}
      </div>

      <Dialog open={confirmando} onOpenChange={(abrir) => !abrir && setConfirmando(false)}>
        <DialogContent className="bg-superficie">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl">{`¿Desconectar ${nombreProveedor}?`}</DialogTitle>
            <DialogDescription>
              {`Se borrarán los accesos guardados de ${unirRedes(REDES_DE_PROVEEDOR[proveedor])}. Lo programado por API fallará hasta que vuelvas a conectarla.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={ocupado}
              onClick={() => {
                setConfirmando(false);
                alDesconectar();
              }}
            >
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
