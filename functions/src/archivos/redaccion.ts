// Quita los parámetros de consulta de las URL (firmas de acceso temporal) antes de escribir en los logs.
export const redactarUrls = (texto: string) => texto.replace(/(https?:\/\/[^\s?'"]+)\?[^\s'"]*/g, '$1?[redactado]');
