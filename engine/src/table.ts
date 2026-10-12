// Title table: loading with validation, and pattern matching (spec section 4).
import type { TitleEntry } from './model.ts';
import { parseTokens } from './tokens.ts';
import type { Token } from './tokens.ts';

interface Rule { entry: TitleEntry; tokens: Token[]; specificity: number }

export interface Table { readonly rules: readonly Rule[] }

// Every single-token path must match some pattern, so a description can always be built.
const BASE_PATHS = ['F', 'M', 'S', 'D', 'H', 'W', 'Be', 'By', 'Ze', 'Zy'];

// A pattern matches a path when the length and letters are equal and each age is
// equal or the pattern's age is '*'.
function matchesTokens(pattern: Token[], path: Token[]): boolean {
  if (pattern.length !== path.length) return false;
  return pattern.every((p, i) => p.letter === path[i].letter && (p.age === '*' || p.age === path[i].age));
}

// Two patterns of the same length can both match some path when their letters are
// equal and their ages agree wherever both are concrete.
function compatible(a: Token[], b: Token[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    if (x.letter !== y.letter) return false;
    return x.age === '*' || y.age === '*' || x.age === y.age;
  });
}

// Entry must have a title (spoken) or both older and younger forms.
function checkEntry(entry: TitleEntry): void {
  const hasOlder = entry.older !== undefined;
  const hasYounger = entry.younger !== undefined;
  if (hasOlder !== hasYounger) throw new Error(`"${entry.pattern}": older and younger must be given together`);
  if (!hasOlder && entry.spoken === undefined) {
    throw new Error(`"${entry.pattern}": needs spoken, or both older and younger`);
  }
}

export function loadTable(entries: TitleEntry[]): Table {
  const rules: Rule[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const tokens = parseTokens(entry.pattern, true);
    if (tokens.length === 0) throw new Error('empty pattern');
    if (seen.has(entry.pattern)) throw new Error(`duplicate pattern "${entry.pattern}"`);
    seen.add(entry.pattern);
    checkEntry(entry);
    const specificity = tokens.filter(t => t.age === 'e' || t.age === 'y').length;
    rules.push({ entry, tokens, specificity });
  }

  // Equal specificity plus a common path means the most specific match is undefined.
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (a.specificity === b.specificity && compatible(a.tokens, b.tokens)) {
        throw new Error(`"${a.entry.pattern}" and "${b.entry.pattern}" are ambiguous`);
      }
    }
  }

  for (const base of BASE_PATHS) {
    const path = parseTokens(base, false);
    if (!rules.some(r => matchesTokens(r.tokens, path))) {
      throw new Error(`no pattern covers the single-token path "${base}"`);
    }
  }
  return { rules };
}

// The most specific matching entry, or null. Path is a path string (spec 2).
export function matchPattern(table: Table, path: string): TitleEntry | null {
  const tokens = parseTokens(path, false);
  let best: Rule | null = null;
  for (const rule of table.rules) {
    if (!matchesTokens(rule.tokens, tokens)) continue;
    // loadTable guarantees two matches never tie on specificity.
    if (best === null || rule.specificity > best.specificity) best = rule;
  }
  return best ? best.entry : null;
}
