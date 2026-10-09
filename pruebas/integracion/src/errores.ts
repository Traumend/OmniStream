// Extrae código y mensaje del rechazo de una llamada: el message de un Error no es enumerable y toMatchObject lo omite.
// El SDK cliente agrega el estado HTTP al final del mensaje (" [400]"); se quita, como hace la web.
export async function rechazoDe(promesa: Promise<unknown>): Promise<{ code: string; message: string } | null> {
  try {
    await promesa;
    return null;
  } catch (error) {
    const { code, message } = error as { code: string; message: string };
    return { code, message: message.replace(/ \[\d{3}\]$/, '') };
  }
}
