import { collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { obtenerFirebase } from '@/lib/firebase/cliente';
import type { DependenciasSubida } from './gestorSubidas';
import { leerMetadatosLocales } from './metadatosLocales';

export function crearDependenciasFirebase(): DependenciasSubida {
  return {
    generarId: () => doc(collection(obtenerFirebase().db, 'assets')).id,
    async crearDocumento(datos) {
      await setDoc(doc(obtenerFirebase().db, 'assets', datos.id), { ...datos, createdAt: serverTimestamp() });
    },
    subir(ruta, archivo, mime) {
      const tarea = uploadBytesResumable(ref(obtenerFirebase().storage, ruta), archivo, { contentType: mime });
      return {
        alProgresar: (cb) => {
          tarea.on('state_changed', (instantanea) => cb(instantanea.bytesTransferred, instantanea.totalBytes), () => {});
        },
        pausar: () => tarea.pause(),
        reanudar: () => tarea.resume(),
        cancelar: () => tarea.cancel(),
        terminado: new Promise<void>((resolver, rechazar) => {
          tarea.then(() => resolver(), rechazar);
        }),
      };
    },
    async eliminarDocumento(id) {
      await deleteDoc(doc(obtenerFirebase().db, 'assets', id));
    },
    leerMetadatosLocales,
  };
}
