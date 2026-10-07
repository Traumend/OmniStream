import { expect, it } from 'vitest';
import { interpretarErrorEntrada } from './erroresEntrada';

it('traduce el rechazo de la función de bloqueo', () => {
  expect(
    interpretarErrorEntrada({
      code: 'auth/internal-error',
      message: 'BLOCKING_FUNCTION_ERROR_RESPONSE : {"error":{"status":"PERMISSION_DENIED"}}',
    }),
  ).toBe('Esta cuenta no tiene acceso a OmniStream.');
});

it('ignora el cierre de la ventana emergente', () => {
  expect(interpretarErrorEntrada({ code: 'auth/popup-closed-by-user' })).toBeNull();
});

it('usa un mensaje genérico en otros casos', () => {
  expect(interpretarErrorEntrada(new Error('red'))).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.');
});
