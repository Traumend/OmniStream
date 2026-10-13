export const pausa = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export async function esperarHasta<T>(
  leer: () => Promise<T>,
  cumple: (valor: T) => boolean,
  { timeoutMs = 30_000 }: { timeoutMs?: number } = {},
): Promise<T> {
  const limite = Date.now() + timeoutMs;
  let ultimo: T | undefined;
  while (Date.now() < limite) {
    ultimo = await leer();
    if (cumple(ultimo)) return ultimo;
    await pausa(250);
  }
  throw new Error(`La condición no se cumplió en ${timeoutMs} ms. Último valor: ${JSON.stringify(ultimo)}`);
}
