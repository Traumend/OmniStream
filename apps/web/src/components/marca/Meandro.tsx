import { useId } from 'react';

// Franja de greca griega repetible.
export function Meandro({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg className={className} height="14" width="100%" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="20" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M0 13 H20 M2 13 V1 H16 V10 H7 V5 H12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="square"
          />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill={`url(#${id})`} />
    </svg>
  );
}
