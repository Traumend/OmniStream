import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DetalleArchivo } from './DetalleArchivo';
import { imagenLista, videoListo } from './fixtures';

const fila = (nombre: string) => {
  const termino = screen.getByText(nombre, { selector: 'dt' });
  return termino.nextElementSibling as HTMLElement;
};

it('muestra los 3 fotogramas y los datos técnicos de un video', () => {
  render(<DetalleArchivo asset={videoListo} urls={{ start: 'a', middle: 'b', end: 'c' }} abierto alCerrar={vi.fn()} />);
  for (const alt of ['Fotograma de inicio', 'Fotograma de la mitad', 'Fotograma del final']) {
    expect(screen.getByAltText(alt)).toBeInTheDocument();
  }
  expect(fila('Proporción')).toHaveTextContent('9:16');
  expect(fila('Duración')).toHaveTextContent('0:04');
  expect(fila('Audio')).toHaveTextContent('Sí');
});

it('muestra una sola vista para imágenes', () => {
  render(<DetalleArchivo asset={imagenLista} urls={{ start: 'a' }} abierto alCerrar={vi.fn()} />);
  const dialogo = screen.getByRole('dialog');
  expect(within(dialogo).getAllByRole('img')).toHaveLength(1);
  expect(screen.getByAltText('Vista de la imagen')).toBeInTheDocument();
});

it('muestra el error de un archivo fallido', () => {
  render(
    <DetalleArchivo
      asset={{
        ...videoListo,
        status: 'fallido',
        error: 'No se pudo leer el archivo. Puede estar dañado o en un formato no soportado.',
      }}
      urls={{}}
      abierto
      alCerrar={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer el archivo');
});

it('muestra la fecha de purga y permite posponerla', async () => {
  const alPosponer = vi.fn();
  render(
    <DetalleArchivo
      asset={{ ...videoListo, purgeAt: new Date('2026-10-20T12:00:00Z') }}
      urls={{}}
      abierto
      alCerrar={() => {}}
      zonaHoraria="UTC"
      alPosponer={alPosponer}
    />,
  );
  expect(screen.getByText(/Se purgará el/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Posponer 7 días' }));
  expect(alPosponer).toHaveBeenCalled();
});
it('ofrece crear una publicación con el archivo listo', () => {
  render(
    <DetalleArchivo asset={videoListo} urls={{}} abierto alCerrar={() => {}} zonaHoraria="UTC" alPosponer={() => {}} />,
  );
  expect(screen.getByRole('link', { name: 'Crear publicación' })).toHaveAttribute(
    'href',
    `/crear?archivo=${videoListo.id}`,
  );
});
