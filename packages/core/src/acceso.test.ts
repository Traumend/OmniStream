import { describe, expect, it } from 'vitest';
import { evaluarAcceso, MENSAJES_ACCESO } from './acceso';

const permitido = 'propietario@omnistream.test';

describe('evaluarAcceso', () => {
  it('permite el correo configurado y verificado', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: true }, permitido)).toEqual({ permitido: true });
  });
  it('ignora mayúsculas y espacios', () => {
    expect(evaluarAcceso({ email: '  Propietario@OmniStream.test ', emailVerified: true }, permitido)).toEqual({
      permitido: true,
    });
  });
  it('rechaza otro correo', () => {
    expect(evaluarAcceso({ email: 'intruso@ejemplo.com', emailVerified: true }, permitido)).toEqual({
      permitido: false,
      motivo: 'correo_no_permitido',
    });
  });
  it('rechaza el correo permitido sin verificar', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: false }, permitido)).toEqual({
      permitido: false,
      motivo: 'correo_no_verificado',
    });
  });
  it('rechaza cuentas sin correo', () => {
    expect(evaluarAcceso({ email: null, emailVerified: false }, permitido)).toEqual({
      permitido: false,
      motivo: 'sin_correo',
    });
  });
  it('rechaza todo si no hay correo configurado', () => {
    expect(evaluarAcceso({ email: permitido, emailVerified: true }, '')).toEqual({
      permitido: false,
      motivo: 'correo_no_permitido',
    });
  });
});

describe('MENSAJES_ACCESO', () => {
  it('tiene un mensaje por motivo', () => {
    expect(MENSAJES_ACCESO).toEqual({
      correo_no_permitido: 'Esta cuenta no tiene acceso a OmniStream.',
      correo_no_verificado: 'Verifica tu correo antes de entrar.',
      sin_correo: 'La cuenta no tiene un correo asociado.',
    });
  });
});
