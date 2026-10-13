import type { Asset } from '@omnistream/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import type { ProgresoSubida } from '@/lib/archivos/gestorSubidas';
import { PasoArchivo } from './PasoArchivo';

const listo: Asset = {
  id: 'a1',
  kind: 'video',
  source: 'subida',
  originalName: 'vertical.mp4',
  storagePath: 'originales/a1',
  mimeType: 'video/mp4',
  sizeBytes: 1000,
  status: 'listo',
  width: 1080,
  height: 1920,
  aspect: 0.5625,
  durationSec: 30,
  createdAt: new Date('2026-10-01T00:00:00Z'),
};

it('Subir archivo elige el archivo nuevo y muestra su progreso', async () => {
  const user = userEvent.setup();
  const alSubir = vi.fn().mockResolvedValue({ ok: true, assetId: 'nuevo' });
  const subiendo: Asset = { ...listo, id: 'nuevo', originalName: 'nuevo.mp4', status: 'subiendo' };
  const progreso = new Map<string, ProgresoSubida>([
    ['nuevo', { assetId: 'nuevo', nombre: 'nuevo.mp4', bytesTransferidos: 50, bytesTotales: 100, estado: 'subiendo' }],
  ]);
  function Contenedor() {
    const [elegido, setElegido] = useState('');
    const [subido, setSubido] = useState(false);
    return (
      <PasoArchivo
        archivos={subido ? [listo, subiendo] : [listo]}
        subidas={progreso}
        elegido={elegido}
        alElegir={setElegido}
        alSubir={async (archivo) => {
          const resultado = await alSubir(archivo);
          setSubido(true);
          return resultado;
        }}
      />
    );
  }
  render(<Contenedor />);
  const archivo = new File(['x'], 'nuevo.mp4', { type: 'video/mp4' });
  await user.upload(screen.getByLabelText('Subir archivo'), archivo);
  expect(alSubir).toHaveBeenCalledWith(archivo);
  await waitFor(() => expect(screen.getByRole('radio', { name: /nuevo\.mp4/ })).toBeChecked());
  expect(screen.getByRole('progressbar', { name: 'Subida de nuevo.mp4' })).toHaveAttribute('aria-valuenow', '50');
});

it('un error al subir se muestra', async () => {
  const user = userEvent.setup();
  render(
    <PasoArchivo
      archivos={[listo]}
      subidas={new Map()}
      elegido=""
      alElegir={vi.fn()}
      alSubir={vi.fn().mockResolvedValue({ ok: false, mensaje: 'Formato no admitido.' })}
    />,
  );
  await user.upload(screen.getByLabelText('Subir archivo'), new File(['x'], 'malo.mp4', { type: 'video/mp4' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('malo.mp4: Formato no admitido.');
});
