// Pet drawings: thick black hand-drawn lines with round ends, faces only, in the spirit of the line-face avatars.
// Drawn in a 100 x 100 box; eyes and noses are filled, everything else is stroked.
import type { PetKind } from '../../engine/src/index.ts';

export const PET_LABEL: Record<PetKind, string> = { dog: 'Dog', cat: 'Cat', 'guinea-pig': 'Guinea pig' };

// dy: how far each drawing is moved down so it sits in the middle of the face circle (ears included).
const ART: Record<PetKind, { lines: string[]; dots: [number, number, number, number][]; dy: number }> = {
  // Pointed ears, round head, whiskers out to both sides and a small "w" mouth.
  cat: {
    lines: [
      'M28 50 C25 40 26 32 29 27 L27 10 C27 6 31 6 33 9 L43 23 C48 22 52 22 57 23 L67 9 C69 6 73 6 73 10 L71 27 C74 32 75 40 72 50 C69 63 60 71 50 71 C40 71 31 63 28 50',
      'M8 50 C18 48 26 49 36 51', 'M12 63 C20 59 28 57 36 57',
      'M92 50 C82 48 74 49 64 51', 'M88 63 C80 59 72 57 64 57',
      'M44 55 C45 59 49 59 50 55 C51 59 55 59 56 55',
    ],
    dots: [[41, 41, 4.5, 4.5], [59, 41, 4.5, 4.5]],
    dy: 12,
  },
  // Long floppy ears hanging beside a round head, a big nose and a smile under it.
  dog: {
    lines: [
      'M33 24 C40 18 60 18 67 24 C74 31 75 46 72 58 C68 70 60 76 50 76 C40 76 32 70 28 58 C25 46 26 31 33 24',
      'M34 23 C24 20 15 26 13 38 C11 50 14 60 20 62 C26 63 29 54 30 44',
      'M66 23 C76 20 85 26 87 38 C89 50 86 60 80 62 C74 63 71 54 70 44',
      'M50 57 L50 62 M41 61 C45 66 55 66 59 61',
    ],
    dots: [[41, 40, 4.5, 4.5], [59, 40, 4.5, 4.5], [50, 53, 6.5, 4.5]],
    dy: 3,
  },
  // A wide, low face with round petal ears drooping at the sides, a little nose and short whiskers.
  'guinea-pig': {
    lines: [
      'M18 50 C18 36 32 28 50 28 C68 28 82 36 82 50 C82 64 68 72 50 72 C32 72 18 64 18 50',
      'M24 38 C14 36 9 28 13 23 C17 18 27 22 31 31',
      'M76 38 C86 36 91 28 87 23 C83 18 73 22 69 31',
      'M50 57 L50 60 M45 61 C48 64 52 64 55 61',
      'M6 56 C14 55 22 56 30 58', 'M94 56 C86 55 78 56 70 58',
    ],
    dots: [[38, 46, 4.5, 4.5], [62, 46, 4.5, 4.5], [50, 54, 3.5, 2.5]],
    dy: 4,
  },
};

export function PetArt({ kind, className }: { kind: PetKind; className?: string }) {
  const a = ART[kind];
  return (
    <svg className={className ?? 'pet-art'} viewBox="0 0 100 100" aria-hidden="true">
      <g transform={`translate(0 ${a.dy})`}>
      <g fill="none" stroke="currentColor" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
        {a.lines.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g fill="currentColor">
        {a.dots.map(([cx, cy, rx, ry], i) => <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} />)}
      </g>
      </g>
    </svg>
  );
}
