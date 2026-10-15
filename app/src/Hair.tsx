// Simple line-art hair drawn around the face circle (centre 64,62, radius 40 in a 128x128 box).
// Shape comes from the generation's tier (elders: bald-topped grandpa, bun for grandma; parents:
// tidier / bobbed; adults; kids with a shorter cut; babies), and colour from the generation's tone.
// Back hair sits behind the face; the fringe is drawn over it.
const INK = 'var(--ink)';
export type Age = 'elder' | 'parent' | 'adult' | 'child' | 'baby';
export type Tone = 'white' | 'grey' | 'black' | 'brown' | 'honey' | 'ink';

// Generation (layout row relative to the tree's first person, so it does not change with the viewpoint).
// Shape: great-grandparents and up get the elder shape, grandparents the parent shape, your generation
// the adult shape, kids a shorter variant of it, then babies.
export const ageFor = (gen: number): Age =>
  gen <= -3 ? 'elder' : gen === -2 ? 'parent' : gen <= 0 ? 'adult' : gen === 1 ? 'child' : 'baby';
// Colour, one step per generation: white, grey, black (parents), brown (you), honey (kids), black (babies).
export const toneFor = (gen: number): Tone =>
  gen <= -3 ? 'white' : gen === -2 ? 'grey' : gen === -1 ? 'black' : gen === 0 ? 'brown' : gen === 1 ? 'honey' : 'ink';

const FILL: Record<Tone, string> = {
  white: 'var(--paper)', grey: '#9a948a', black: INK, brown: '#5c3a1e', honey: '#b9803f', ink: INK,
};

const stroke = { stroke: INK, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const fillFor = (tone: Tone) => ({ ...stroke, fill: FILL[tone] });

// Girls in your and your parents' generations wear the grandparents' bob.
const shapeFor = (sex: string, age: Age): Age => (age === 'adult' && sex === 'f' ? 'parent' : age);

export function HairBack({ sex, age: tier, tone }: { sex: string; age: Age; tone: Tone }) {
  const age = shapeFor(sex, tier);
  const hair = fillFor(tone);
  if (age === 'baby') {
    // A single curl for boys; a small bow for girls.
    return (
      <svg className="hair back" viewBox="0 0 128 128" aria-hidden="true">
        {sex === 'm'
          ? <path {...stroke} strokeWidth={2.5} fill="none" d="M64 24 C60 12 64 2 72 4 C80 6 80 16 72 18 C68 19 67 14 70 13" />
          : <g {...stroke} fill="var(--f)">
              <path d="M64 18 L50 8 L50 28 Z" />
              <path d="M64 18 L78 8 L78 28 Z" />
              <circle cx="64" cy="18" r="3.5" fill="var(--ink)" />
            </g>}
      </svg>
    );
  }
  return (
    <svg className="hair back" viewBox="0 0 128 128" aria-hidden="true">
      {sex === 'm' ? (
        age === 'child' ? null : age === 'elder' ? (
          <>
            <path {...hair} d="M21 66 C15 48 21 36 33 30 C31 44 33 56 37 66 Z" />
            <path {...hair} d="M107 66 C113 48 107 36 95 30 C97 44 95 56 91 66 Z" />
          </>
        ) : age === 'parent' ? (
          <path {...hair} d="M21 66 C15 34 38 17 64 17 C90 17 113 34 107 66 C102 46 92 41 64 41 C36 41 26 46 21 66Z" />
        ) : (
          <path {...hair} d="M20 66 C12 30 36 12 64 13 C92 12 116 30 108 66 C100 44 92 38 64 38 C36 38 28 44 20 66Z" />
        )
      ) : age === 'elder' ? (
        <>
          <circle cx="64" cy="14" r="8" {...hair} />
          <path {...hair} d="M18 68 C10 30 36 16 64 16 C92 16 118 30 110 68 C112 84 106 92 98 94 C96 84 92 78 88 74 L40 74 C36 78 32 84 30 94 C22 92 16 84 18 68Z" />
        </>
      ) : age === 'parent' ? (
        <path {...hair} d="M17 70 C8 28 38 10 64 11 C90 10 120 28 111 70 C112 90 108 100 98 104 C90 100 88 92 86 86 L42 86 C40 92 38 100 30 104 C20 100 16 90 17 70Z" />
      ) : age === 'child' ? (
        <path {...hair} d="M18 66 C10 30 36 14 64 14 C92 14 118 30 110 66 C110 80 106 86 100 86 C98 78 94 72 88 70 L40 70 C34 72 30 78 28 86 C22 86 18 80 18 66Z" />
      ) : (
        <path {...hair} d="M17 70 C6 26 36 8 64 9 C92 8 122 26 111 70 C110 96 114 112 104 122 C94 124 86 116 84 104 L44 104 C42 116 34 124 24 122 C14 112 18 96 17 70Z" />
      )}
    </svg>
  );
}

export function HairFront({ sex, age: tier, tone }: { sex: string; age: Age; tone: Tone }) {
  const age = shapeFor(sex, tier);
  const hair = fillFor(tone);
  if (age === 'baby') return null;
  const shape = age === 'child' && sex === 'm'
    // Spiky bangs, cut short at the sides.
    ? <path {...hair} d="M16 10 H112 V40 L106 36 L98 52 L88 40 L78 54 L68 40 L58 52 L48 40 L38 54 L28 38 L22 46 L16 42 Z" />
    : age === 'child'
      ? <path {...hair} d="M16 10 H112 V56 C100 42 84 36 64 36 C44 36 28 42 16 56 Z" />
    : sex === 'm'
      ? age === 'elder' ? null
      : age === 'parent' ? <path {...hair} d="M16 10 H112 V46 C96 44 80 40 70 30 C58 40 36 44 20 48 Z" />
      : <path {...hair} d="M16 10 H112 V54 C96 50 84 44 76 32 C66 46 44 50 20 56 Z" />
      : age === 'elder' ? <path {...hair} d="M16 10 H112 V58 C104 42 86 32 64 26 C42 32 24 42 16 58 Z" />
      : age === 'parent' ? <path {...hair} d="M16 10 H112 V62 C106 44 86 30 64 24 C42 30 22 44 16 62 Z" />
      : <path {...hair} d="M16 10 H112 V68 C106 48 86 32 64 26 C42 32 22 48 16 68 Z" />;
  return (
    <svg className="hair front" viewBox="0 0 128 128" aria-hidden="true">
      <defs><clipPath id="face-clip"><circle cx="64" cy="62" r="40" /></clipPath></defs>
      <g clipPath="url(#face-clip)">{shape}</g>
    </svg>
  );
}
