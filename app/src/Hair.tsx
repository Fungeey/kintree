// Simple line-art hair drawn around the face circle (centre 64,62, radius 40 in a 128x128 box).
// One generic style per sex. Back hair sits behind the face; the fringe is drawn over it.
const INK = 'var(--ink)';

export function HairBack({ sex }: { sex: string }) {
  const common = { fill: INK, stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="hair back" viewBox="0 0 128 128" aria-hidden="true">
      {sex === 'm' ? (
        <>
          <path {...common} d="M20 66 C12 30 36 12 64 13 C92 12 116 30 108 66 C100 44 92 38 64 38 C36 38 28 44 20 66Z" />
          <path fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" d="M48 17 L43 7 M64 13 L64 3 M80 17 L85 7" />
        </>
      ) : (
        <path {...common} d="M17 70 C6 26 36 8 64 9 C92 8 122 26 111 70 C110 96 114 112 104 122 C94 124 86 116 84 104 L44 104 C42 116 34 124 24 122 C14 112 18 96 17 70Z" />
      )}
    </svg>
  );
}

export function HairFront({ sex }: { sex: string }) {
  const solid = { fill: INK, stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const };
  return (
    <svg className="hair front" viewBox="0 0 128 128" aria-hidden="true">
      <defs><clipPath id={`face-${sex}`}><circle cx="64" cy="62" r="40" /></clipPath></defs>
      <g clipPath={`url(#face-${sex})`}>
        {sex === 'm'
          ? <path {...solid} d="M16 10 H112 V54 C96 50 84 44 76 32 C66 46 44 50 20 56 Z" />
          : <path {...solid} d="M16 10 H112 V68 C106 48 86 32 64 26 C42 32 22 48 16 68 Z" />}
      </g>

    </svg>
  );
}
