const EMULADOR = 'http://127.0.0.1:5001/demo-omnistream/us-central1';

// Rutas públicas de la app que atienden las funciones: el retorno de OAuth, el borrado de datos de Meta y los
// enlaces de media. Así las redes ven un solo dominio, el de la app.
export function reescrituras(base: string | undefined, desarrollo: boolean): { source: string; destination: string }[] {
  const destino = base ?? (desarrollo ? EMULADOR : undefined);
  if (!destino) return [];
  return [
    { source: '/api/conexiones/retorno', destination: `${destino}/retornoConexion` },
    { source: '/api/meta/borrado-datos', destination: `${destino}/borradoDatosMeta` },
    { source: '/api/media/:token', destination: `${destino}/media/:token` },
  ];
}
