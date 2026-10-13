import type { Platform } from '@omnistream/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import type { FormularioOverrides } from '@/lib/publicaciones/formulario';
import { AjustesRed } from './AjustesRed';

const BASE = { text: 'Hola', hashtags: '#uno', title: 'Mi video', fecha: '2026-10-08', hora: '10:30' };

function montar(red: Platform = 'tiktok', inicial: FormularioOverrides = {}) {
  const alCambiar = vi.fn<(o: FormularioOverrides) => void>();
  const user = userEvent.setup();
  function Contenedor() {
    const [overrides, setOverrides] = useState(inicial);
    return (
      <AjustesRed
        red={red}
        base={BASE}
        overrides={overrides}
        zona="America/Mexico_City"
        ahora={() => new Date('2026-10-07T12:00:00Z')}
        alCambiar={(o) => {
          alCambiar(o);
          setOverrides(o);
        }}
      />
    );
  }
  render(<Contenedor />);
  return { alCambiar, user };
}

it('desvincular copia la base y permite editar', async () => {
  const { alCambiar, user } = montar();
  const texto = screen.getByLabelText('Texto de TikTok');
  expect(texto).toHaveValue('Hola');
  expect(texto).toHaveAttribute('readonly');
  await user.click(screen.getByRole('button', { name: 'Desvincular texto' }));
  expect(alCambiar).toHaveBeenLastCalledWith({ text: 'Hola' });
  expect(screen.getByLabelText('Texto de TikTok')).not.toHaveAttribute('readonly');
  await user.type(screen.getByLabelText('Texto de TikTok'), '!');
  expect(alCambiar).toHaveBeenLastCalledWith({ text: 'Hola!' });
});

it('revincular borra el override y vuelve a mostrar la base', async () => {
  const crop = { aspect: '9:16', x: 0.3, y: 0, w: 0.3, h: 1 } as const;
  const { alCambiar, user } = montar('tiktok', { text: 'Propio', crop });
  expect(screen.getByLabelText('Texto de TikTok')).toHaveValue('Propio');
  await user.click(screen.getByRole('button', { name: 'Revincular texto' }));
  expect(alCambiar).toHaveBeenLastCalledWith({ crop });
  expect(screen.getByLabelText('Texto de TikTok')).toHaveValue('Hola');
  expect(screen.getByLabelText('Texto de TikTok')).toHaveAttribute('readonly');
});

it('el título solo aparece en YouTube', () => {
  montar('tiktok');
  expect(screen.queryByLabelText('Título de TikTok')).not.toBeInTheDocument();
  document.body.innerHTML = '';
  montar('youtube');
  expect(screen.getByLabelText('Título de YouTube')).toHaveValue('Mi video');
});

it('la hora propia de la red se guarda en su override', async () => {
  const { alCambiar, user } = montar();
  await user.click(screen.getByRole('button', { name: 'Desvincular hora' }));
  expect(alCambiar).toHaveBeenLastCalledWith({ fecha: '2026-10-08', hora: '10:30' });
  await user.clear(screen.getByLabelText('Hora de TikTok'));
  await user.type(screen.getByLabelText('Hora de TikTok'), '11:45');
  expect(alCambiar).toHaveBeenLastCalledWith({ fecha: '2026-10-08', hora: '11:45' });
});

it('una hora propia que ya pasó se avisa', async () => {
  montar('tiktok', { fecha: '2026-10-01', hora: '10:00' });
  expect(screen.getByText('La hora programada ya pasó.')).toBeInTheDocument();
});
