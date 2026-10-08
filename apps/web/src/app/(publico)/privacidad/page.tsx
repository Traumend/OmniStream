import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Logo } from '@/components/marca/Logo';
import { Meandro } from '@/components/marca/Meandro';

export const metadata: Metadata = { title: 'Política de privacidad · OmniStream' };

const CONTACTO = process.env.NEXT_PUBLIC_CORREO_CONTACTO;

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-3">
      <h2 className="font-heading text-2xl text-texto">{titulo}</h2>
      <div className="flex flex-col gap-3 leading-relaxed text-texto-secundario">{children}</div>
    </section>
  );
}

function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-oro-profundo underline underline-offset-2">
      {children}
    </a>
  );
}

export default function Privacidad() {
  const contacto = CONTACTO ? (
    <a href={`mailto:${CONTACTO}`} className="text-oro-profundo underline underline-offset-2">
      {CONTACTO}
    </a>
  ) : (
    'el correo de contacto indicado en la ficha de la app'
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        <Logo />
        <Meandro className="w-56 text-oro-claro" />
        <h1 className="text-4xl text-texto">Política de privacidad</h1>
        <p className="text-texto-secundario">Última actualización: octubre de 2026.</p>
      </header>

      <Seccion titulo="Responsable">
        <p>
          OmniStream es una herramienta personal de programación y publicación de contenido. La usa una sola persona, su
          titular, que es la responsable del tratamiento de los datos descritos aquí.
        </p>
      </Seccion>

      <Seccion titulo="Datos que se tratan">
        <p>
          Los archivos que el titular sube (videos e imágenes), los textos y la programación de sus publicaciones, los
          datos básicos de las cuentas conectadas de Facebook, Instagram, YouTube y TikTok (identificador, nombre y
          avatar), los permisos de acceso que esas redes entregan al conectar la cuenta y las métricas públicas de las
          publicaciones.
        </p>
        <p>OmniStream no recopila datos de otras personas ni de los seguidores de las cuentas.</p>
      </Seccion>

      <Seccion titulo="Para qué se usan">
        <p>
          Únicamente para publicar el contenido que el titular programa en sus propias cuentas, recordarle las
          publicaciones pendientes y mostrarle el rendimiento de lo publicado. Los datos no se venden, no se usan para
          publicidad y no se comparten con terceros fuera de los servicios que se indican abajo.
        </p>
      </Seccion>

      <Seccion titulo="Servicios de terceros">
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Google Firebase y Google Cloud alojan los datos y los archivos. Se aplica la{' '}
            <Enlace href="https://policies.google.com/privacy">Política de Privacidad de Google</Enlace>.
          </li>
          <li>
            YouTube: al conectar el canal se aceptan los{' '}
            <Enlace href="https://www.youtube.com/t/terms">Términos del Servicio de YouTube</Enlace>. El acceso se puede
            revocar en cualquier momento desde la{' '}
            <Enlace href="https://myaccount.google.com/permissions">configuración de seguridad de Google</Enlace>.
          </li>
          <li>Meta (Facebook e Instagram), según la política de privacidad de Meta.</li>
          <li>
            TikTok, según su <Enlace href="https://www.tiktok.com/legal/privacy-policy">Política de Privacidad</Enlace>.
          </li>
          <li>Vercel sirve la interfaz web.</li>
          <li>Anthropic y OpenAI, solo cuando el titular usa las funciones de IA con sus propias llaves.</li>
        </ul>
      </Seccion>

      <Seccion titulo="Conservación">
        <p>
          Los archivos originales se eliminan automáticamente unos días después de que todas sus publicaciones terminan
          (7 días por defecto). Los datos de las publicaciones y las métricas se conservan mientras el titular use la
          herramienta.
        </p>
      </Seccion>

      <Seccion titulo="Seguridad">
        <p>
          Solo la cuenta autorizada puede entrar. Los permisos de acceso a las redes se guardan cifrados y nunca se
          envían al navegador. Los archivos son privados y se comparten mediante enlaces temporales.
        </p>
      </Seccion>

      <Seccion id="borrado-de-datos" titulo="Borrado de datos">
        <p>Para borrar los datos obtenidos de una red social:</p>
        <ul className="list-disc space-y-2 pl-6">
          <li>
            Facebook e Instagram: quita la app en{' '}
            <Enlace href="https://www.facebook.com/settings?tab=applications">
              Configuración de Facebook &gt; Apps y sitios web
            </Enlace>
            .
          </li>
          <li>
            Google y YouTube: revoca el acceso en la{' '}
            <Enlace href="https://myaccount.google.com/permissions">configuración de seguridad de Google</Enlace>.
          </li>
          <li>Cualquier red: desconéctala en Ajustes &gt; Conexiones de OmniStream.</li>
          <li>
            Para pedir el borrado de todos los datos, escribe a {contacto}. La solicitud se atiende en un máximo de 30
            días.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="Contacto">
        <p>Para cualquier pregunta sobre esta política, escribe a {contacto}.</p>
      </Seccion>
    </main>
  );
}
