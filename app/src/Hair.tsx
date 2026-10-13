// Simple line-art hair drawn around the face circle (centre 64,62, radius 40 in a 128x128 box).
// Styles per sex and generation: adults, parents (tidier / bobbed) and elders (white hair,
// outlined not filled: a bald-topped grandpa, a bun for grandma). Back hair sits behind the
// face; the fringe is drawn over it.
const INK = 'var(--ink)';
export type Age = 'adult' | 'parent' | 'elder';

// Generation relative to "me" -> hair style.
export const ageFor = (gen: number): Age => (gen <= -2 ? 'elder' : gen === -1 ? 'parent' : 'adult');

const stroke = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const dark = { ...stroke, fill: INK };
const white = { ...stroke, fill: 'var(--paper)' };

export function HairBack({ sex, age }: { sex: string; age: Age }) {
  return (
    <svg className="hair back" viewBox="0 0 128 128" aria-hidden="true">
      {sex === 'm' ? (
        age === 'elder' ? (
          <>
            <path {...white} d="M21 66 C15 48 21 36 33 30 C31 44 33 56 37 66 Z" />
            <path {...white} d="M107 66 C113 48 107 36 95 30 C97 44 95 56 91 66 Z" />
          </>
        ) : age === 'parent' ? (
          <path {...dark} d="M21 66 C15 34 38 17 64 17 C90 17 113 34 107 66 C102 46 92 41 64 41 C36 41 26 46 21 66Z" />
        ) : (
          <path {...dark} d="M20 66 C12 30 36 12 64 13 C92 12 116 30 108 66 C100 44 92 38 64 38 C36 38 28 44 20 66Z" />
        )
      ) : age === 'elder' ? (
        <>
          <circle cx="64" cy="14" r="8" {...white} />
          <path {...white} d="M18 68 C10 30 36 16 64 16 C92 16 118 30 110 68 C112 84 106 92 98 94 C96 84 92 78 88 74 L40 74 C36 78 32 84 30 94 C22 92 16 84 18 68Z" />
        </>
      ) : age === 'parent' ? (
        <path {...dark} d="M17 70 C8 28 38 10 64 11 C90 10 120 28 111 70 C112 90 108 100 98 104 C90 100 88 92 86 86 L42 86 C40 92 38 100 30 104 C20 100 16 90 17 70Z" />
      ) : (
        <path {...dark} d="M17 70 C6 26 36 8 64 9 C92 8 122 26 111 70 C110 96 114 112 104 122 C94 124 86 116 84 104 L44 104 C42 116 34 124 24 122 C14 112 18 96 17 70Z" />
      )}
    </svg>
  );
}

export function HairFront({ sex, age }: { sex: string; age: Age }) {
  const fill = age === 'elder' ? white : dark;
  return (
    <svg className="hair front" viewBox="0 0 128 128" aria-hidden="true">
      <defs><clipPath id="face-clip"><circle cx="64" cy="62" r="40" /></clipPath></defs>
      <g clipPath="url(#face-clip)">
        {sex === 'm'
          ? age === 'elder' ? null
          : age === 'parent' ? <path {...fill} d="M16 10 H112 V46 C96 44 80 40 70 30 C58 40 36 44 20 48 Z" />
          : <path {...fill} d="M16 10 H112 V54 C96 50 84 44 76 32 C66 46 44 50 20 56 Z" />
          : age === 'elder' ? <path {...fill} d="M16 10 H112 V58 C104 42 86 32 64 26 C42 32 24 42 16 58 Z" />
          : age === 'parent' ? <path {...fill} d="M16 10 H112 V62 C106 44 86 30 64 24 C42 30 22 44 16 62 Z" />
          : <path {...fill} d="M16 10 H112 V68 C106 48 86 32 64 26 C42 32 22 48 16 68 Z" />}
      </g>
    </svg>
  );
}
