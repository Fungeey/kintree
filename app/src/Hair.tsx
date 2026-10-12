// Simple line-art hair drawn around the face circle (centre 64,62, radius 40 in a 128x128 box).
// One generic style per sex. Back hair sits behind the face; the fringe is drawn over it.
const INK = 'var(--ink)';

export function HairBack({ sex }: { sex: string }) {
  const common = { fill: 'var(--paper)', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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
  const line = { fill: 'none', stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg className="hair front" viewBox="0 0 128 128" aria-hidden="true">
      <defs><clipPath id={`face-${sex}`}><circle cx="64" cy="62" r="40" /></clipPath></defs>
      <g clipPath={`url(#face-${sex})`}>
        {sex === 'm'
          ? <path {...line} d="M22 52 C38 44 52 48 60 34 C66 46 84 46 106 52" />
          : <path {...line} d="M64 20 C50 28 34 40 24 60 M64 20 C78 28 94 40 104 60" />}
      </g>
      {sex === 'f' && <path {...line} d="M24 72 C24 88 26 100 31 108 M104 72 C104 88 102 100 97 108" />}
    </svg>
  );
}
