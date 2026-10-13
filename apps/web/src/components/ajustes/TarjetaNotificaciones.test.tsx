import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TarjetaNotificaciones } from './TarjetaNotificaciones';

it.each([
  [
    'no_soportado',
    'Este navegador no admite notificaciones push. En iPhone, instala OmniStream en la pantalla de inicio desde Safari.',
  ],
  ['sin_configurar', 'Falta configurar la llave VAPID (NEXT_PUBLIC_FIREBASE_VAPID_KEY).'],
  ['bloqueadas', 'Las notificaciones están bloqueadas en este navegador. Permítelas en la configuración del sitio.'],
  ['activadas', 'Activadas en este dispositivo.'],
] as const)('%s', (estado, texto) => {
  render(<TarjetaNotificaciones estado={estado} alActivar={vi.fn()} />);
  expect(screen.getByText(texto)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Activar en este dispositivo' })).not.toBeInTheDocument();
});

it('desactivadas ofrece activar', async () => {
  const user = userEvent.setup();
  let terminar: () => void = () => undefined;
  const alActivar = vi.fn(() => new Promise<void>((resolver) => (terminar = resolver)));
  render(<TarjetaNotificaciones estado="desactivadas" alActivar={alActivar} />);
  const boton = screen.getByRole('button', { name: 'Activar en este dispositivo' });
  await user.click(boton);
  expect(alActivar).toHaveBeenCalledTimes(1);
  expect(boton).toBeDisabled();
  terminar();
  await vi.waitFor(() => expect(boton).toBeEnabled());
});

it('mientras se comprueba el navegador no ofrece nada', () => {
  render(<TarjetaNotificaciones estado={null} alActivar={vi.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Comprobando este navegador…');
});
