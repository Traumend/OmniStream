import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { GuardiaSesion } from './GuardiaSesion';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const usuario = { uid: 'u1', email: 'propietario@omnistream.test', nombre: 'Valtrax', foto: null };

beforeEach(() => {
  replace.mockClear();
});

it('redirige a /entrar si no hay sesión', () => {
  render(
    <GuardiaSesion sesion={{ estado: 'anonimo' }}>
      <p>app</p>
    </GuardiaSesion>,
  );
  expect(replace).toHaveBeenCalledWith('/entrar');
  expect(screen.queryByText('app')).toBeNull();
});

it('muestra el contenido con sesión', () => {
  render(
    <GuardiaSesion sesion={{ estado: 'autenticado', usuario }}>
      <p>app</p>
    </GuardiaSesion>,
  );
  expect(screen.getByText('app')).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

it('muestra un indicador mientras carga', () => {
  render(
    <GuardiaSesion sesion={{ estado: 'cargando' }}>
      <p>app</p>
    </GuardiaSesion>,
  );
  expect(screen.getByText('Cargando…')).toBeInTheDocument();
});
