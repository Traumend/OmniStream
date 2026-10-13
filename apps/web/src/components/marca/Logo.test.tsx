import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Logo } from './Logo';

it('Logo expone el nombre y el lema', () => {
  render(<Logo />);
  expect(screen.getByRole('img', { name: 'OmniStream' })).toBeInTheDocument();
  expect(screen.getByText('UNA VISIÓN. CADA PLATAFORMA.')).toBeInTheDocument();
});

it('la variante compacta omite el lema', () => {
  render(<Logo variante="compacto" />);
  expect(screen.getByRole('img', { name: 'OmniStream' })).toBeInTheDocument();
  expect(screen.queryByText('UNA VISIÓN. CADA PLATAFORMA.')).toBeNull();
});
