import { leerConexion, type Conexion, type Platform } from '@omnistream/core';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TarjetaConexion } from './TarjetaConexion';

const PERMISOS: Record<Platform, string> = {
  facebook: 'pages_manage_posts',
  instagram: 'instagram_content_publish',
  youtube: 'https://www.googleapis.com/auth/youtube.upload',
  tiktok: 'video.publish',
};

const conectada = (red: Platform, cambios: Partial<Conexion> = {}): Conexion => ({
  ...leerConexion(red, {
    authStatus: 'conectada',
    readEnabled: true,
    scopes: [PERMISOS[red]],
    account: { id: '1', name: 'Mi cuenta', handle: 'micuenta' },
    tokenExpiresAt: new Date('2030-01-15T18:00:00Z'),
  }),
  ...cambios,
});

function tarjeta(conexion: Conexion) {
  const props = {
    conexion,
    zona: 'UTC',
    ocupado: false,
    alConectar: vi.fn(),
    alDesconectar: vi.fn(),
    alConfigurar: vi.fn(),
  };
  render(<TarjetaConexion {...props} />);
  return props;
}

it('sin conectar ofrece Conectar con Meta en Facebook', async () => {
  const props = tarjeta(leerConexion('facebook', undefined));
  const seccion = screen.getByRole('region', { name: 'Facebook' });
  expect(within(seccion).getByText('Sin conectar')).toBeInTheDocument();
  await userEvent.click(within(seccion).getByRole('button', { name: 'Conectar con Meta' }));
  expect(props.alConectar).toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument();
});

it('conectada muestra la cuenta y permite elegir Por API', async () => {
  const props = tarjeta(conectada('instagram'));
  expect(screen.getByText('Conectada')).toBeInTheDocument();
  expect(screen.getByText('Mi cuenta')).toBeInTheDocument();
  expect(screen.getByText('@micuenta')).toBeInTheDocument();
  expect(screen.getByText(/^Acceso vigente hasta /)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Modo de publicación'), 'api');
  expect(props.alConfigurar).toHaveBeenCalledWith({ publishMode: 'api' });
});

it('sin el permiso de publicar, Por API está deshabilitada', () => {
  tarjeta(conectada('youtube', { scopes: [] }));
  expect(screen.getByRole('option', { name: 'Por API' })).toBeDisabled();
  expect(screen.getByText('Conecta YouTube para publicar por API.')).toBeInTheDocument();
});

it('acceso vencido muestra el error y Reconectar', async () => {
  const props = tarjeta(
    conectada('tiktok', {
      authStatus: 'expirada',
      lastError: { code: 'auth', message: 'El acceso a TikTok venció.', at: new Date() },
    }),
  );
  expect(screen.getByText('Acceso vencido')).toBeInTheDocument();
  expect(screen.getByText('El acceso a TikTok venció.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reconectar' }));
  expect(props.alConectar).toHaveBeenCalled();
});

it('la nota de YouTube aparece en modo API', () => {
  tarjeta(conectada('youtube', { publishMode: 'api' }));
  expect(
    screen.getByText('Mientras Google no audite la app, los videos subidos por API quedan privados.'),
  ).toBeInTheDocument();
});

it('en modo manual no hay nota', () => {
  tarjeta(conectada('youtube'));
  expect(screen.queryByText(/Mientras Google no audite la app/)).not.toBeInTheDocument();
});

it('la casilla de dominio verificado solo aparece en TikTok', async () => {
  const props = tarjeta(conectada('tiktok'));
  await userEvent.click(screen.getByLabelText('Dominio verificado en TikTok para fotos'));
  expect(props.alConfigurar).toHaveBeenCalledWith({ mediaVerified: true });
  await userEvent.click(screen.getByLabelText('Leer métricas'));
  expect(props.alConfigurar).toHaveBeenCalledWith({ readEnabled: false });
});

it('Facebook no ofrece la casilla de dominio verificado', () => {
  tarjeta(conectada('facebook'));
  expect(screen.queryByLabelText('Dominio verificado en TikTok para fotos')).not.toBeInTheDocument();
});

it('Desconectar pide confirmación', async () => {
  const props = tarjeta(conectada('instagram'));
  await userEvent.click(screen.getByRole('button', { name: 'Desconectar' }));
  const dialogo = screen.getByRole('dialog', { name: '¿Desconectar Meta?' });
  expect(
    within(dialogo).getByText(
      'Se borrarán los accesos guardados de Facebook e Instagram. Lo programado por API fallará hasta que vuelvas a conectarla.',
    ),
  ).toBeInTheDocument();
  expect(props.alDesconectar).not.toHaveBeenCalled();
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Desconectar' }));
  expect(props.alDesconectar).toHaveBeenCalled();
});
