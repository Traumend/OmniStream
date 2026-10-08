import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
getFirestore().settings({ ignoreUndefinedProperties: true });

export { antesDeCrearUsuario, antesDeIniciarSesion } from './acceso/bloqueos';
export { alCambiarDestino } from './publicacion/alCambiarDestino';
export { encolarPendientes } from './publicacion/encolarPendientes';
export { limpiarRetencion } from './publicacion/limpiarRetencion';
export { procesarArchivo } from './archivos/procesarArchivo';
export { publicaciones } from './publicacion/publicaciones';
export { publicarDestino } from './publicacion/publicarDestino';
export { conexiones, retornoConexion } from './conexiones/conexiones';
export { renovarSesiones } from './conexiones/sesiones';
