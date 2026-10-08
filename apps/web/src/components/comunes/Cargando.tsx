export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="py-10 text-center text-texto-secundario" role="status">
      {texto}
    </p>
  );
}
