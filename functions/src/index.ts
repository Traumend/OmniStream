import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
getFirestore().settings({ ignoreUndefinedProperties: true });

export { antesDeCrearUsuario, antesDeIniciarSesion } from './acceso/bloqueos';
export { procesarArchivo } from './archivos/procesarArchivo';
export { publicaciones } from './publicacion/publicaciones';
export { publicarDestino } from './publicacion/publicarDestino';
