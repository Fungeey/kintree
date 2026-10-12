// kinPath: the shortest path between two people, with the spec's tie-breaks (spec section 3).
import type { Tree } from './model.ts';
import { buildIndex, movesFrom } from './tree.ts';
import { formatTokens, isMarriage, TOKEN_ORDER } from './tokens.ts';
import type { Token } from './tokens.ts';

interface Walk { tokens: Token[]; marriages: number }

// Orders two walks of the same length. The spec rules come first:
//   2. fewer marriage tokens (H/W);
//   3. letter order F < M < B < Z < S < D < H < W, ages ignored.
// Not in the spec: if the letters match too, the ages decide (e before y) so
// the result is always deterministic.
function compareWalks(a: Walk, b: Walk): number {
  if (a.marriages !== b.marriages) return a.marriages - b.marriages;
  for (let i = 0; i < a.tokens.length; i++) {
    const d = TOKEN_ORDER.indexOf(a.tokens[i].letter) - TOKEN_ORDER.indexOf(b.tokens[i].letter);
    if (d !== 0) return d;
  }
  for (let i = 0; i < a.tokens.length; i++) {
    const x = a.tokens[i].age ?? '';
    const y = b.tokens[i].age ?? '';
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function kinPath(tree: Tree, me: string, target: string): string | null {
  const index = buildIndex(tree);
  if (!index.people.has(me)) throw new Error(`unknown person id: ${me}`);
  if (!index.people.has(target)) throw new Error(`unknown person id: ${target}`);
  if (me === target) return '';

  // Search one walk length at a time. Rule 1 (fewest tokens) is the first
  // length that reaches the target. For each person I keep only the best walk
  // of that exact length. This is safe because the later rules are stable under
  // extension: a worse prefix never becomes a better full path.
  let layer = new Map<string, Walk>([[me, { tokens: [], marriages: 0 }]]);
  // A shortest walk never repeats a person (the loop could be cut out), so
  // walks longer than the number of people are not needed.
  for (let length = 1; length <= index.people.size; length++) {
    const next = new Map<string, Walk>();
    for (const [id, walk] of layer) {
      for (const move of movesFrom(index, id)) {
        const candidate: Walk = {
          tokens: [...walk.tokens, move.token],
          marriages: walk.marriages + (isMarriage(move.token.letter) ? 1 : 0),
        };
        const current = next.get(move.to);
        if (!current || compareWalks(candidate, current) < 0) next.set(move.to, candidate);
      }
    }
    const hit = next.get(target);
    if (hit) return formatTokens(hit.tokens);
    layer = next;
  }
  return null;
}
