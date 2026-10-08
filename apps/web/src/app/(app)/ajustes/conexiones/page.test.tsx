import { leerConexion, PLATAFORMAS, type Conexion, type Platform } from '@omnistream/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import Conexiones from './page';

const navegacion = vi.hoisted(() => ({ busqueda: new URLSearchParams(), replace: vi.fn() }));
const avisos = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const accion = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navegacion.replace }),
  useSearchParams: () => navegacion.busqueda,
}));
vi.mock('sonner', () => ({ toast: avisos }));
vi.mock('@/lib/conexiones/repositorio', () => ({
  useConexiones: () => ({
    conexiones: Object.fromEntries(PLATAFORMAS.map((p) => [p, leerConexion(p, undefined)])) as Record<
      Platform,
      Conexion
    >,
    cargando: false,
  }),
}));
vi.mock('@/lib/conexiones/acciones', () => ({ ejecutarAccionConexion: accion }));
vi.mock('@/lib/ajustes/useAjustes', () => ({ useAjustes: () => ({ timezone: 'UTC' }) }));

beforeEach(() => {
  navegacion.busqueda = new URLSearchParams();
  vi.clearAllMocks();
});

it('muestra las 4 redes en orden', () => {
  render(<Conexiones />);
  expect(screen.getByRole('heading', { name: 'Conexiones' })).toBeInTheDocument();
  expect(screen.getAllByRole('region').map((s) => s.getAttribute('aria-label'))).toEqual([
    'Facebook',
    'Instagram',
    'YouTube',
    'TikTok',
  ]);
});

it('el retorno conectado muestra el toast y limpia la URL', async () => {
  navegacion.busqueda = new URLSearchParams('conectada=meta');
  render(<Conexiones />);
  await waitFor(() => expect(avisos.success).toHaveBeenCalledWith('Meta quedó conectada'));
  expect(navegacion.replace).toHaveBeenCalledWith('/ajustes/conexiones');
});

it('el retorno con error muestra el mensaje', async () => {
  navegacion.busqueda = new URLSearchParams({ error: 'Se canceló la conexión con TikTok.' });
  render(<Conexiones />);
  await waitFor(() => expect(avisos.error).toHaveBeenCalledWith('Se canceló la conexión con TikTok.'));
  expect(navegacion.replace).toHaveBeenCalledWith('/ajustes/conexiones');
});

it('Conectar inicia el proveedor y abre su URL', async () => {
  accion.mockResolvedValue({ url: 'https://www.facebook.com/dialog/oauth?x=1' });
  const asignar = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign: asignar });
  render(<Conexiones />);
  await userEvent.click(screen.getAllByRole('button', { name: 'Conectar con Meta' })[0] as HTMLElement);
  expect(accion).toHaveBeenCalledWith({ accion: 'iniciar', proveedor: 'meta' });
  await waitFor(() => expect(asignar).toHaveBeenCalledWith('https://www.facebook.com/dialog/oauth?x=1'));
  vi.unstubAllGlobals();
});
