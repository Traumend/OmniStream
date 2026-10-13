'use client';

import { AJUSTES_POR_DEFECTO, estadoVisible, type AjustesApp, type Asset } from '@omnistream/core';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmarEliminacion } from '@/components/biblioteca/ConfirmarEliminacion';
import { DetalleArchivo } from '@/components/biblioteca/DetalleArchivo';
import { TarjetaArchivo } from '@/components/biblioteca/TarjetaArchivo';
import { ZonaSubida } from '@/components/biblioteca/ZonaSubida';
import { escucharAjustes } from '@/lib/ajustes/repositorio';
import {
  ArchivoEnUso,
  eliminarArchivo,
  posponerPurga,
  useArchivos,
  useUrlsFotogramas,
} from '@/lib/archivos/repositorio';
import { useSubidas } from '@/lib/archivos/useSubidas';

function Tarjeta(props: Omit<Parameters<typeof TarjetaArchivo>[0], 'miniatura'>) {
  const urls = useUrlsFotogramas(props.asset);
  return <TarjetaArchivo {...props} miniatura={urls.start} />;
}

function Detalle({ asset, alCerrar, zonaHoraria }: { asset: Asset; alCerrar(): void; zonaHoraria: string }) {
  const urls = useUrlsFotogramas(asset);
  const posponer = async () => {
    try {
      await posponerPurga(asset);
      toast.success('Purga pospuesta');
    } catch {
      toast.error('No se pudo posponer la purga.');
    }
  };
  return (
    <DetalleArchivo
      asset={asset}
      urls={urls}
      abierto
      alCerrar={alCerrar}
      zonaHoraria={zonaHoraria}
      alPosponer={() => void posponer()}
    />
  );
}

export default function Biblioteca() {
  const { archivos, cargando } = useArchivos();
  const { gestor, estado, activas } = useSubidas();
  const [ajustes, setAjustes] = useState<AjustesApp>(AJUSTES_POR_DEFECTO);
  const [idAbierto, setIdAbierto] = useState<string | null>(null);
  const [aEliminar, setAEliminar] = useState<Asset | null>(null);

  useEffect(() => escucharAjustes((leidos) => setAjustes(leidos)), []);

  const abierto = archivos.find((a) => a.id === idAbierto);

  const eliminar = async () => {
    if (!aEliminar) return;
    try {
      await eliminarArchivo(aEliminar);
      toast.success('Archivo eliminado');
      setAEliminar(null);
    } catch (error) {
      toast.error(error instanceof ArchivoEnUso ? error.message : 'No se pudo eliminar el archivo.');
      if (error instanceof ArchivoEnUso) setAEliminar(null);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-4xl text-texto">Biblioteca</h1>
        <p className="text-texto-secundario">Tus videos e imágenes, listos para publicar.</p>
      </header>

      <ZonaSubida gestor={gestor} maxUploadGb={ajustes.maxUploadGb} />

      {cargando ? (
        <p className="text-texto-secundario" role="status">
          Cargando archivos…
        </p>
      ) : archivos.length === 0 ? (
        <p className="py-10 text-center text-texto-secundario">Aún no hay archivos. Sube el primero para empezar.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {archivos.map((asset) => (
            <Tarjeta
              key={asset.id}
              asset={asset}
              estado={estadoVisible(asset, activas)}
              progreso={estado.get(asset.id)}
              alAbrir={() => setIdAbierto(asset.id)}
              alPausar={() => gestor.pausar(asset.id)}
              alReanudar={() => gestor.reanudar(asset.id)}
              alCancelar={() => void gestor.cancelar(asset.id)}
              alEliminar={() => setAEliminar(asset)}
            />
          ))}
        </div>
      )}

      {abierto && <Detalle asset={abierto} alCerrar={() => setIdAbierto(null)} zonaHoraria={ajustes.timezone} />}
      <ConfirmarEliminacion
        nombre={aEliminar?.originalName ?? ''}
        abierto={aEliminar !== null}
        alCerrar={() => setAEliminar(null)}
        alConfirmar={eliminar}
      />
    </section>
  );
}
