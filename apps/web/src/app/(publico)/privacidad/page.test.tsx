import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Privacidad from './page';

it('incluye las secciones y enlaces que exigen las redes', () => {
  render(<Privacidad />);
  for (const t of [
    'Responsable',
    'Datos que se tratan',
    'Para qué se usan',
    'Servicios de terceros',
    'Conservación',
    'Seguridad',
    'Borrado de datos',
    'Contacto',
  ]) {
    expect(screen.getByRole('heading', { name: t })).toBeInTheDocument();
  }
  expect(screen.getByRole('heading', { name: 'Borrado de datos' }).closest('section')).toHaveAttribute(
    'id',
    'borrado-de-datos',
  );
  for (const href of [
    'https://policies.google.com/privacy',
    'https://www.youtube.com/t/terms',
    'https://myaccount.google.com/permissions',
    'https://www.facebook.com/settings?tab=applications',
    'https://www.tiktok.com/legal/privacy-policy',
  ]) {
    expect(document.querySelector(`a[href="${href}"]`)).not.toBeNull();
  }
});
