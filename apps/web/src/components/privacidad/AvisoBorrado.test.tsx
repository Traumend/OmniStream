import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { AvisoBorrado } from './AvisoBorrado';

it('muestra el texto con el código', () => {
  render(<AvisoBorrado codigo="0123456789abcdef" />);
  expect(
    screen.getByText(
      'Tu solicitud de borrado 0123456789abcdef se completó: OmniStream eliminó los accesos y los datos de tu cuenta de Meta.',
    ),
  ).toBeInTheDocument();
});
