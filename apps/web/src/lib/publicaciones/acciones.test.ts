import { FirebaseError } from 'firebase/app';
import { expect, it } from 'vitest';
import { MENSAJE_ERROR_GENERICO, mensajeDeError } from './acciones';

it('usa el mensaje del servidor en errores esperados', () => {
  expect(mensajeDeError(new FirebaseError('functions/failed-precondition', 'Elige un archivo.'))).toBe(
    'Elige un archivo.',
  );
});
it('usa el mensaje genérico en errores internos o desconocidos', () => {
  expect(mensajeDeError(new FirebaseError('functions/internal', 'INTERNAL'))).toBe(MENSAJE_ERROR_GENERICO);
  expect(mensajeDeError(new Error('x'))).toBe(MENSAJE_ERROR_GENERICO);
});
it('quita el estado HTTP que el SDK agrega al final del mensaje', () => {
  expect(mensajeDeError(new FirebaseError('functions/failed-precondition', 'Elige un archivo. [400]'))).toBe(
    'Elige un archivo.',
  );
});
