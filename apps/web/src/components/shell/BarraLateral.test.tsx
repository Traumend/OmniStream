import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BarraLateral } from './BarraLateral';

vi.mock('next/navigation', () => ({ usePathname: () => '/calendario' }));

it('muestra el número de pendientes', () => {
  render(<BarraLateral contadores={{ '/pendientes': 3 }} />);
  expect(screen.getByLabelText('3 pendientes')).toHaveTextContent('3');
});

it('sin pendientes no muestra insignia', () => {
  render(<BarraLateral contadores={{ '/pendientes': 0 }} />);
  expect(screen.queryByLabelText(/pendientes$/)).not.toBeInTheDocument();
});
