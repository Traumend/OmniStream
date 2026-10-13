import { toast } from 'sonner';

export async function copiar(texto: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('Copiado');
  } catch {
    toast.error('No se pudo copiar.');
  }
}
