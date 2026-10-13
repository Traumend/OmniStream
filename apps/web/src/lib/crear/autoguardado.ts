import type { EntradaPublicacion } from '@omnistream/core';

export type EstadoGuardado = 'sin_cambios' | 'pendiente' | 'guardando' | 'guardado' | 'error';

export interface Autoguardado {
  programar(entrada: EntradaPublicacion): void;
  vaciar(): Promise<string | undefined>;
  cancelar(): void;
}

// Cola de guardados con retardo: cada cambio reinicia el temporizador y nunca hay dos guardados en curso.
// Si llega un cambio mientras se guarda, el siguiente guardado espera y usa la última entrada. El id que devuelve
// el primer guardado se agrega a los siguientes para no crear la publicación dos veces.
export function crearAutoguardado({
  guardar,
  alEstado,
  retardoMs = 1_000,
}: {
  guardar(entrada: EntradaPublicacion): Promise<{ postId: string }>;
  alEstado(estado: EstadoGuardado): void;
  retardoMs?: number;
}): Autoguardado {
  let pendiente: EntradaPublicacion | null = null;
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let enCurso: Promise<void> | null = null;
  let postId: string | undefined;
  let ultimoError: unknown = null;

  const detenerTemporizador = () => {
    clearTimeout(temporizador);
    temporizador = undefined;
  };

  function ejecutar(): Promise<void> {
    detenerTemporizador();
    if (enCurso) return enCurso;
    if (!pendiente) return Promise.resolve();
    const entrada = postId && !pendiente.postId ? { ...pendiente, postId } : pendiente;
    pendiente = null;
    ultimoError = null;
    alEstado('guardando');
    enCurso = guardar(entrada)
      .then((resultado) => {
        postId = resultado.postId;
        alEstado(pendiente ? 'pendiente' : 'guardado');
      })
      .catch((error: unknown) => {
        ultimoError = error;
        alEstado('error');
      })
      .finally(() => {
        enCurso = null;
        // Un cambio que llegó durante el guardado y cuyo retardo ya venció se guarda ahora.
        if (pendiente && !temporizador) void ejecutar();
      });
    return enCurso;
  }

  return {
    programar(entrada) {
      pendiente = entrada;
      alEstado('pendiente');
      detenerTemporizador();
      temporizador = setTimeout(() => void ejecutar(), retardoMs);
    },
    async vaciar() {
      detenerTemporizador();
      while (enCurso || pendiente) {
        await (enCurso ?? ejecutar());
        if (ultimoError) throw ultimoError;
      }
      return postId;
    },
    cancelar() {
      detenerTemporizador();
      pendiente = null;
    },
  };
}
