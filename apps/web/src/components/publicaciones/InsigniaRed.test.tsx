import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InsigniaRed } from './InsigniaRed';

it('muestra la abreviatura con la etiqueta accesible del estado', () => {
  render(<InsigniaRed platform="instagram" estado="pendiente_manual" />);
  expect(screen.getByLabelText('Instagram: Pendiente manual')).toHaveTextContent('IG');
});

it('sin estado solo nombra la red', () => {
  render(<InsigniaRed platform="youtube" />);
  expect(screen.getByLabelText('YouTube')).toHaveTextContent('YT');
});
