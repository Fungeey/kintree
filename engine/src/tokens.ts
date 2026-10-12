// Tokens and the path/pattern text format (spec section 2 and 4).

// Sex-specific move letters: F/M, B/Z, S/D, H/W.
export type Letter = 'F' | 'M' | 'B' | 'Z' | 'S' | 'D' | 'H' | 'W';

// Sibling tokens carry an age: 'e' (elder) or 'y' (younger).
// '*' only appears in table patterns, never in a path.
export interface Token { letter: Letter; age: 'e' | 'y' | '*' | null }

// Rank used by the path tie-break (spec 3): F < M < B < Z < S < D < H < W.
export const TOKEN_ORDER = 'FMBZSDHW';

export function isSibling(letter: Letter): boolean {
  return letter === 'B' || letter === 'Z';
}

export function isMarriage(letter: Letter): boolean {
  return letter === 'H' || letter === 'W';
}

// Parse a space-separated pattern or path. Throws on malformed input.
// B/Z need an age (e, y, or * when wildcards are allowed); other letters take none.
export function parseTokens(text: string, allowWildcard: boolean): Token[] {
  if (text === '') return [];
  return text.split(' ').map(word => {
    const m = /^([FMBZSDHW])(.*)$/.exec(word);
    if (!m) throw new Error(`bad token "${word}" in "${text}"`);
    const letter = m[1] as Letter;
    const age = m[2];
    if (isSibling(letter)) {
      const ok = age === 'e' || age === 'y' || (allowWildcard && age === '*');
      if (!ok) throw new Error(`sibling token "${word}" needs an age in "${text}"`);
      return { letter, age: age as 'e' | 'y' | '*' };
    }
    if (age !== '') throw new Error(`token "${word}" must not have an age in "${text}"`);
    return { letter, age: null };
  });
}

export function formatTokens(tokens: Token[]): string {
  return tokens.map(t => t.letter + (t.age ?? '')).join(' ');
}
