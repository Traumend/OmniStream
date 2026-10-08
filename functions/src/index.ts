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
export { comentarReferencia } from './publicacion/comentarReferencia';
export { publicarDestino } from './publicacion/publicarDestino';
export { borradoDatosMeta } from './conexiones/borradoDatosMeta';
export { conexiones, retornoConexion } from './conexiones/conexiones';
export { media } from './conexiones/media';
export { renovarSesiones } from './conexiones/sesiones';
