import { redirect } from 'next/navigation';

// En la fase 2 la página de inicio pasa a ser el calendario.
export default function Inicio() {
  redirect('/biblioteca');
}
