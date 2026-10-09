'use client';

import { GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { obtenerFirebase } from './cliente';
import { firebaseConfigurado, MENSAJE_SIN_CONFIGURACION } from './config';
import { interpretarErrorEntrada, MENSAJE_SIN_ACCESO } from './erroresEntrada';

export interface UsuarioSesion {
  uid: string;
  email: string;
  nombre: string | null;
  foto: string | null;
}

export type EstadoSesion =
  { estado: 'cargando' } | { estado: 'anonimo'; mensaje?: string } | { estado: 'autenticado'; usuario: UsuarioSesion };

type ValorSesion = EstadoSesion & { entrar(): Promise<void>; salir(): Promise<void> };

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  // La configuración se fija al compilar, así que servidor y navegador calculan el mismo estado inicial.
  const [sesion, setSesion] = useState<EstadoSesion>(() =>
    firebaseConfigurado() ? { estado: 'cargando' } : { estado: 'anonimo', mensaje: MENSAJE_SIN_CONFIGURACION },
  );

  useEffect(() => {
    if (!firebaseConfigurado()) return;
    const { auth } = obtenerFirebase();
    return onIdTokenChanged(auth, async (usuario) => {
      if (!usuario) {
        setSesion((previa) => ({
          estado: 'anonimo',
          mensaje: previa.estado === 'anonimo' ? previa.mensaje : undefined,
        }));
        return;
      }
      const token = await usuario.getIdTokenResult();
      if (token.claims.owner !== true) {
        setSesion({ estado: 'anonimo', mensaje: MENSAJE_SIN_ACCESO });
        await signOut(auth);
        return;
      }
      setSesion({
        estado: 'autenticado',
        usuario: { uid: usuario.uid, email: usuario.email ?? '', nombre: usuario.displayName, foto: usuario.photoURL },
      });
    });
  }, []);

  const entrar = useCallback(async () => {
    if (!firebaseConfigurado()) {
      setSesion({ estado: 'anonimo', mensaje: MENSAJE_SIN_CONFIGURACION });
      return;
    }
    try {
      await signInWithPopup(obtenerFirebase().auth, new GoogleAuthProvider());
    } catch (error) {
      const mensaje = interpretarErrorEntrada(error);
      if (mensaje) setSesion({ estado: 'anonimo', mensaje });
    }
  }, []);

  const salir = useCallback(async () => {
    if (firebaseConfigurado()) await signOut(obtenerFirebase().auth);
  }, []);

  const valor = useMemo(() => ({ ...sesion, entrar, salir }), [sesion, entrar, salir]);
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}
