import { PLANTILLA_PROMOCION_POR_DEFECTO } from '@omnistream/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { FormularioAjustes } from './FormularioAjustes';

const valores = {
  timezone: 'America/Bogota',
  retentionDays: 7,
  maxUploadGb: 10,
  promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO,
};

it('muestra los valores actuales', () => {
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota', 'UTC']} alGuardar={vi.fn()} />);
  expect(screen.getByLabelText('Días de retención')).toHaveValue(7);
  expect(screen.getByLabelText('Tamaño máximo de subida (GB)')).toHaveValue(10);
  expect(screen.getByRole('combobox', { name: 'Zona horaria' })).toHaveTextContent('America/Bogota');
});

it('no guarda con una retención inválida y muestra el error', async () => {
  const user = userEvent.setup();
  const alGuardar = vi.fn();
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  await user.clear(screen.getByLabelText('Días de retención'));
  await user.type(screen.getByLabelText('Días de retención'), '91');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(await screen.findByText('La retención debe estar entre 0 y 90 días.')).toBeInTheDocument();
  expect(alGuardar).not.toHaveBeenCalled();
});

it('guarda valores válidos', async () => {
  const user = userEvent.setup();
  const alGuardar = vi.fn().mockResolvedValue(undefined);
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  await user.clear(screen.getByLabelText('Días de retención'));
  await user.type(screen.getByLabelText('Días de retención'), '14');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(alGuardar).toHaveBeenCalledWith({ ...valores, retentionDays: 14 });
});

it('acepta 0 días de retención', async () => {
  const user = userEvent.setup();
  const alGuardar = vi.fn().mockResolvedValue(undefined);
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  expect(screen.getByText('0 = borrar el video en cuanto se publica en todas sus redes.')).toBeInTheDocument();
  await user.clear(screen.getByLabelText('Días de retención'));
  await user.type(screen.getByLabelText('Días de retención'), '0');
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(alGuardar).toHaveBeenCalledWith({ ...valores, retentionDays: 0 });
});

it('guarda la plantilla de promoción editada', async () => {
  const user = userEvent.setup();
  const alGuardar = vi.fn().mockResolvedValue(undefined);
  render(<FormularioAjustes valores={valores} zonas={['America/Bogota']} alGuardar={alGuardar} />);
  await user.click(screen.getByRole('button', { name: 'Quitar pendiente 5' }));
  await user.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(alGuardar).toHaveBeenCalledWith({
    ...valores,
    promotionTemplate: PLANTILLA_PROMOCION_POR_DEFECTO.slice(0, 4),
  });
});
