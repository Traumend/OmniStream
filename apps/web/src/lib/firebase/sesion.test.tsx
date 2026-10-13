import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProveedorSesion, useSesion } from './sesion';

function Estado() {
  const sesion = useSesion();
  return <p>{sesion.estado === 'anonimo' ? (sesion.mensaje ?? 'anonimo') : sesion.estado}</p>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

it('sin configuración de Firebase informa qué falta en lugar de fallar', async () => {
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG', '');
  render(
    <ProveedorSesion>
      <Estado />
    </ProveedorSesion>,
  );
  expect(
    await screen.findByText(
      'OmniStream aún no está conectado a Firebase. Configura NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG en el despliegue.',
    ),
  ).toBeInTheDocument();
});
