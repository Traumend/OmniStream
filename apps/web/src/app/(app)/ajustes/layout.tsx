import type { ReactNode } from 'react';
import { PestanasAjustes } from '@/components/ajustes/PestanasAjustes';

export default function LayoutAjustes({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto w-full max-w-5xl">
        <PestanasAjustes />
      </div>
      {children}
    </div>
  );
}
