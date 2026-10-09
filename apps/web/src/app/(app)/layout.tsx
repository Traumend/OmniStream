import type { ReactNode } from 'react';
import { AreaPrivada } from '@/components/shell/AreaPrivada';

export default function LayoutApp({ children }: { children: ReactNode }) {
  return <AreaPrivada>{children}</AreaPrivada>;
}
