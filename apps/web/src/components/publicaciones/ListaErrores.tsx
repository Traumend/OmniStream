export function ListaErrores({ errores }: { errores: readonly string[] }) {
  if (errores.length === 0) return null;
  return (
    <div
      role="alert"
      aria-label="Errores"
      className="rounded-[12px] border border-peligro/40 bg-peligro/5 px-4 py-3 text-sm text-peligro"
    >
      <ul className="list-disc space-y-1 pl-5">
        {errores.map((mensaje) => (
          <li key={mensaje}>{mensaje}</li>
        ))}
      </ul>
    </div>
  );
}
