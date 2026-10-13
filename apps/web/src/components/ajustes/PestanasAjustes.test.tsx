import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { PestanasAjustes } from './PestanasAjustes';

vi.mock('next/navigation', () => ({ usePathname: () => '/ajustes/conexiones' }));

it('marca la pestaña activa con aria-current', () => {
  render(<PestanasAjustes />);
  const nav = screen.getByRole('navigation', { name: 'Ajustes' });
  expect(nav).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Conexiones' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute('href', '/ajustes/general');
  expect(screen.getByRole('link', { name: 'General' })).not.toHaveAttribute('aria-current');
});
