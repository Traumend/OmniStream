const CENTRO = { x: 32, y: 33 };
const RADIO = 20;
const HOJAS = 8;

// Hojas de una rama izquierda, distribuidas sobre un arco de 105° a 245°.
const hojas = Array.from({ length: HOJAS }, (_, i) => {
  const grados = 105 + (i * (245 - 105)) / (HOJAS - 1);
  const radianes = (grados * Math.PI) / 180;
  const x = CENTRO.x + RADIO * Math.cos(radianes);
  const y = CENTRO.y + RADIO * Math.sin(radianes);
  const giro = grados + 90 - 38;
  const escala = 1 - i * 0.05;
  return { x: x.toFixed(2), y: y.toFixed(2), giro: giro.toFixed(1), rx: (7.4 * escala).toFixed(2), ry: (2.9 * escala).toFixed(2) };
});

const tallo = (() => {
  const punto = (grados: number) => {
    const r = (grados * Math.PI) / 180;
    return `${(CENTRO.x + RADIO * Math.cos(r)).toFixed(2)} ${(CENTRO.y + RADIO * Math.sin(r)).toFixed(2)}`;
  };
  return `M ${punto(96)} A ${RADIO} ${RADIO} 0 0 1 ${punto(248)}`;
})();

function Rama() {
  return (
    <g>
      <path d={tallo} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {hojas.map((h) => (
        <ellipse
          key={`${h.x}-${h.y}`}
          cx={h.x}
          cy={h.y}
          rx={h.rx}
          ry={h.ry}
          transform={`rotate(${h.giro} ${h.x} ${h.y})`}
          fill="currentColor"
        />
      ))}
    </g>
  );
}

export function Laurel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      <Rama />
      <g transform="translate(64 0) scale(-1 1)">
        <Rama />
      </g>
    </svg>
  );
}
