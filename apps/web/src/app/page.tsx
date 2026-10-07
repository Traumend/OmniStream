import { Logo } from '@/components/marca/Logo';
import { Meandro } from '@/components/marca/Meandro';

export default function Inicio() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="neu-elevado flex flex-col items-center gap-6 px-12 py-10">
        <Logo />
        <Meandro className="w-64 text-oro-claro" />
      </div>
    </main>
  );
}
