import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { progreso, subiendo, videoListo } from './fixtures';
import { TarjetaArchivo } from './TarjetaArchivo';

const acciones = () => ({
  alAbrir: vi.fn(),
  alPausar: vi.fn(),
  alReanudar: vi.fn(),
  alCancelar: vi.fn(),
  alEliminar: vi.fn(),
});

it('muestra el porcentaje mientras sube', () => {
  render(
    <TarjetaArchivo
      asset={subiendo}
      estado="subiendo"
      progreso={{ ...progreso, bytesTransferidos: 450, bytesTotales: 1000 }}
      {...acciones()}
    />,
  );
  expect(screen.getByText('Subiendo 45%')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument();
});

it('ofrece eliminar una subida interrumpida', () => {
  render(<TarjetaArchivo asset={subiendo} estado="interrumpido" {...acciones()} />);
  expect(screen.getByText('Subida interrumpida')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
});

it('muestra duración y resolución cuando está listo', () => {
  render(<TarjetaArchivo asset={videoListo} estado="listo" {...acciones()} />);
  expect(screen.getByText('0:04')).toBeInTheDocument();
  expect(screen.getByText('720 × 1280')).toBeInTheDocument();
});

it('se identifica por el nombre del archivo', () => {
  render(<TarjetaArchivo asset={videoListo} estado="listo" {...acciones()} />);
  expect(screen.getByRole('article', { name: 'video-vertical.mp4' })).toBeInTheDocument();
});

it('permite eliminar un archivo que quedó en procesamiento', () => {
  render(<TarjetaArchivo asset={{ ...videoListo, status: 'procesando' }} estado="procesando" {...acciones()} />);
  expect(screen.getByText('Procesando')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
});

it('una subida completada se muestra como Procesando mientras el servidor la toma', () => {
  render(
    <TarjetaArchivo
      asset={subiendo}
      estado="subiendo"
      progreso={{ ...progreso, bytesTransferidos: 1000, estado: 'completada' }}
      {...acciones()}
    />,
  );
  expect(screen.getByText('Procesando')).toBeInTheDocument();
  expect(screen.queryByText('Subida interrumpida')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
});

it('muestra el error de una subida fallida', () => {
  render(
    <TarjetaArchivo
      asset={subiendo}
      estado="interrumpido"
      progreso={{ ...progreso, estado: 'error', error: 'La subida falló. Revisa tu conexión e inténtalo de nuevo.' }}
      {...acciones()}
    />,
  );
  expect(screen.getByText('Error en la subida')).toBeInTheDocument();
  expect(screen.getByText('La subida falló. Revisa tu conexión e inténtalo de nuevo.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
});
