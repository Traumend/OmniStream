import type { TipoError } from '@omnistream/core';

// Error de una red con su tipo (spec 7.6): decide si se reintenta, se falla o se pide reconectar.
export class PlatformError extends Error {
  constructor(
    readonly kind: TipoError,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PlatformError';
  }
}

export const esPlatformError = (error: unknown): error is PlatformError => error instanceof PlatformError;
