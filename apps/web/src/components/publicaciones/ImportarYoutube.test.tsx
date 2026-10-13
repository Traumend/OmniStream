import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ImportarYoutube } from './ImportarYoutube';

it('sin conexión pide conectar YouTube', () => {
  render(<ImportarYoutube conectado={false} alImportar={vi.fn()} />);
  const seccion = screen.getByRole('region', { name: 'Importar desde YouTube' });
  expect(seccion).toHaveTextContent('Conecta YouTube en Ajustes > Conexiones para importar videos.');
  expect(screen.getByRole('link', { name: 'Ajustes > Conexiones' })).toHaveAttribute('href', '/ajustes/conexiones');
  expect(screen.queryByLabelText('URL del video de YouTube')).not.toBeInTheDocument();
});

it('importa la URL', async () => {
  const alImportar = vi.fn().mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<ImportarYoutube conectado alImportar={alImportar} />);
  await user.type(screen.getByLabelText('URL del video de YouTube'), '  https://youtu.be/dQw4w9WgXcQ  ');
  await user.click(screen.getByRole('button', { name: 'Importar' }));
  expect(alImportar).toHaveBeenCalledWith('https://youtu.be/dQw4w9WgXcQ');
});

it('sin URL no importa', async () => {
  const alImportar = vi.fn();
  render(<ImportarYoutube conectado alImportar={alImportar} />);
  expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
});
