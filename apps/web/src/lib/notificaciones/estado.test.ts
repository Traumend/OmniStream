import { expect, it } from 'vitest';
import { estadoNotificaciones } from './estado';

it.each([
  [{ soportado: false, vapid: 'k', permiso: 'default', tokenRegistrado: false }, 'no_soportado'],
  [{ soportado: true, vapid: undefined, permiso: 'default', tokenRegistrado: false }, 'sin_configurar'],
  [{ soportado: true, vapid: 'k', permiso: 'denied', tokenRegistrado: false }, 'bloqueadas'],
  [{ soportado: true, vapid: 'k', permiso: 'default', tokenRegistrado: false }, 'desactivadas'],
  [{ soportado: true, vapid: 'k', permiso: 'granted', tokenRegistrado: false }, 'desactivadas'],
  [{ soportado: true, vapid: 'k', permiso: 'default', tokenRegistrado: true }, 'desactivadas'],
  [{ soportado: true, vapid: 'k', permiso: 'granted', tokenRegistrado: true }, 'activadas'],
] as const)('%j → %s', (entorno, esperado) => {
  expect(estadoNotificaciones(entorno)).toBe(esperado);
});
