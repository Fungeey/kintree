// What a person card shows: the title from "me" to that person.
import { rankTitle, resolve } from '../../engine/src/index.ts';
import type { Tree, Spoken, Forms, Title } from '../../engine/src/index.ts';
import { DEFAULT_LANG, langFor } from './lang.ts';
import type { LangId } from './lang.ts';

export interface Line { label?: string; chars: string; rom?: string; kana?: string; byName?: boolean; bare?: boolean; rank?: boolean }
export interface Shown {
  kind: 'self' | 'title' | 'byAge' | 'fallback' | 'unrelated';
  lines: Line[];          // spoken titles, large; one line, or two for older/younger
  formal?: Title;         // formal term underneath (single-line cases)
  gloss?: string;         // English
  describe?: string;      // fallback: the relationship in words
}

const BY_NAME = 'by name';

function line(s: Spoken, label?: string): Line {
  return s === 'by-name' ? { label, chars: BY_NAME, byName: true, bare: true } : { label, chars: s.chars, rom: s.rom, kana: s.kana };
}

function forms(f: Forms, label: string): Line {
  // Younger relatives are called by name; the formal term is still worth showing.
  return f.spoken === 'by-name' ? { label, chars: f.formal.chars, rom: f.formal.rom, kana: f.formal.kana, byName: true } : line(f.spoken, label);
}

// "Mei's", or "Your" for a root named "You" (the ?demo family), so captions read "Your father".
const possessive = (name: string) => (name.toLowerCase() === 'you' ? 'Your' : `${name}'s`);

// The relation to the tree's root (its creator), e.g. "Mei's father". Independent of who "me" is.
// Null when the tree has no named root or the person is not related to the root.
export function rootLabel(tree: Tree, target: string, lang: LangId = DEFAULT_LANG): string | null {
  const L = langFor(lang);
  const root = tree.root && tree.people.find(p => p.id === tree.root);
  const name = root && root.name?.trim();
  if (!root || !name) return null;
  const r = resolve(tree, L.table, L.generic, root.id, target, L.joiner, L.reverse);
  switch (r.kind) {
    case 'self': return name;
    case 'unrelated': return null;
    case 'title': case 'byAge': return `${possessive(name)} ${r.en}`;
    case 'fallback': return `${possessive(name)} ${r.describe.en}`;
  }
}

// The small caption above a card: the person's own name, or blank when they have none.
export function captionFor(tree: Tree, id: string): string | null {
  return tree.people.find(p => p.id === id)?.name?.trim() || null;
}

export function showFor(tree: Tree, me: string, target: string, lang: LangId = DEFAULT_LANG): Shown {
  const L = langFor(lang);
  const r = resolve(tree, L.table, L.generic, me, target, L.joiner, L.reverse);
  switch (r.kind) {
    case 'self': return { kind: 'self', lines: [{ chars: L.me.chars, rom: L.me.rom, kana: L.me.kana }], gloss: 'me' };
    case 'unrelated': return { kind: 'unrelated', lines: [] };
    case 'title': {
      const { spoken, formal } = r.forms;
      const first = spoken === 'by-name' ? { chars: formal.chars, rom: formal.rom, kana: formal.kana, byName: true } : line(spoken);
      // Aunts and uncles can also be called by rank (大姨媽, 二姨媽): shown beside the usual title, not instead of it.
      const rank = L.rank ? rankTitle(tree, me, target, L.rank) : null;
      return {
        kind: 'title', gloss: r.en,
        lines: rank ? [first, { chars: rank.chars, rom: rank.rom, kana: rank.kana, rank: true }] : [first],
        formal: rank || spoken === 'by-name' || spoken.chars === formal.chars ? undefined : formal,
      };
    }
    case 'byAge':
      return { kind: 'byAge', gloss: r.en, lines: [forms(r.older, 'older'), forms(r.younger, 'younger')] };
    case 'fallback': {
      const g = r.generic;
      const lines = typeof g === 'object' && 'older' in g
        ? [line(g.older, 'older'), line(g.younger, 'younger')]
        : [line(g as Spoken)];
      return { kind: 'fallback', lines, gloss: r.describe.en, describe: r.describe.text };
    }
  }
}
