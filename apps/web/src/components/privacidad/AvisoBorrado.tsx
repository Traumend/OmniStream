export function AvisoBorrado({ codigo }: { codigo: string }) {
  return (
    <p role="status" className="rounded-md border border-oro-claro bg-superficie p-4 text-texto">
      {`Tu solicitud de borrado ${codigo} se completó: OmniStream eliminó los accesos y los datos de tu cuenta de Meta.`}
    </p>
  );
}
