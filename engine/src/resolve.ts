// resolve: the title (or fallback) for a target seen from me (spec section 5 and 6).
import type { Generic, Resolution, Sex, Spoken, Tree, TitleEntry } from './model.ts';
import { kinPath } from './path.ts';
import { matchPattern } from './table.ts';
import type { Table } from './table.ts';
import { parseTokens } from './tokens.ts';

export function resolve(
  tree: Tree,
  table: Table,
  generic: Generic,
  me: string,
  target: string,
  joiner = '嘅',
): Resolution {
  const path = kinPath(tree, me, target);
  if (path === null) return { kind: 'unrelated' };
  if (path === '') return { kind: 'self' };

  const entry = matchPattern(table, path);
  // Entries with older and younger always show both (decision 9).
  if (entry && entry.older && entry.younger) {
    return { kind: 'byAge', path, pattern: entry.pattern, en: entry.en, older: entry.older, younger: entry.younger };
  }
  if (entry && entry.spoken !== undefined) {
    return {
      kind: 'title',
      path,
      pattern: entry.pattern,
      en: entry.en,
      forms: { formal: entry.formal, spoken: entry.spoken },
    };
  }

  const sex = tree.people.find(p => p.id === target)!.sex;
  return {
    kind: 'fallback',
    path,
    generic: genericFor(generic, path, sex),
    describe: describe(table, path, joiner),
  };
}

// Generation g = (count of F/M) - (count of S/D). Marriage and sibling moves do not count.
function genericFor(
  generic: Generic,
  path: string,
  sex: Sex,
): Spoken | { older: Spoken; younger: Spoken } {
  let g = 0;
  for (const t of parseTokens(path, false)) {
    if (t.letter === 'F' || t.letter === 'M') g++;
    else if (t.letter === 'S' || t.letter === 'D') g--;
  }
  if (g >= 2) return generic.above2[sex];
  if (g === 1) return generic.above1[sex];
  if (g === 0) return generic.same[sex];
  return generic.below;
}

interface Segment { len: number; entry: TitleEntry }

// Orders two splits of the same path. Fewest segments first (count is checked
// first). Then shortest first segment, then the next, from left to right.
function compareSplits(a: Segment[], b: Segment[]): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i].len !== b[i].len) return a[i].len - b[i].len;
  }
  return 0;
}

// `joiner` links the segments in the language's own possessive (Cantonese 嘅, Mandarin 的).
// Split the path into segments that each match a table entry. Each segment is
// named from the view of the person where it starts, which the entry's wording
// already does. Single tokens always match, so a split always exists.
function describe(table: Table, path: string, joiner: string): { text: string; en: string } {
  const words = path.split(' ');
  const n = words.length;
  // best[i] is the best split of words[i..n).
  const best: (Segment[] | null)[] = new Array(n + 1).fill(null);
  best[n] = [];
  for (let i = n - 1; i >= 0; i--) {
    let choice: Segment[] | null = null;
    for (let end = i + 1; end <= n; end++) {
      const rest = best[end];
      const entry = matchPattern(table, words.slice(i, end).join(' '));
      if (rest === null || entry === null) continue;
      const candidate = [{ len: end - i, entry }, ...rest];
      if (choice === null || compareSplits(candidate, choice) < 0) choice = candidate;
    }
    best[i] = choice;
  }
  const segments = best[0];
  if (segments === null) throw new Error(`no description for path "${path}"`);
  return {
    text: segments.map(s => s.entry.formal.chars).join(joiner),
    en: segments.map(s => s.entry.en).join("'s "),
  };
}
