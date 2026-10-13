import { PLANTILLA_PROMOCION_POR_DEFECTO, type PlantillaPromocion as Plantilla } from '@omnistream/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { PlantillaPromocion } from './PlantillaPromocion';

function Envoltura({ alCambiar }: { alCambiar(v: Plantilla[]): void }) {
  const [valores, setValores] = useState<Plantilla[]>(PLANTILLA_PROMOCION_POR_DEFECTO);
  return (
    <PlantillaPromocion
      valores={valores}
      alCambiar={(v) => {
        setValores(v);
        alCambiar(v);
      }}
    />
  );
}

it('edita la plantilla', async () => {
  const alCambiar = vi.fn();
  const user = userEvent.setup();
  render(<Envoltura alCambiar={alCambiar} />);
  expect(screen.getByLabelText('Título del pendiente 1')).toHaveValue('Short 1');
  fireEvent.change(screen.getByLabelText('Días del pendiente 1'), { target: { value: '2' } });
  await user.selectOptions(screen.getByLabelText('Tipo del pendiente 5'), 'comunidad');
  await user.click(screen.getByRole('button', { name: 'Quitar pendiente 3' }));
  await user.click(screen.getByRole('button', { name: 'Agregar a la plantilla' }));
  const ultimo = alCambiar.mock.lastCall?.[0] as Plantilla[];
  expect(ultimo).toEqual([
    { type: 'short', title: 'Short 1', offsetDays: 2 },
    { type: 'short', title: 'Short 2', offsetDays: 3 },
    { type: 'comunidad', title: 'Post en Comunidad', offsetDays: 2 },
    { type: 'comunidad', title: 'Exposición en medios propios', offsetDays: 0 },
    { type: 'short', title: 'Nuevo pendiente', offsetDays: 1 },
  ]);
});
