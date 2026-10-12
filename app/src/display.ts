// What a person card shows: the title from "me" to that person.
import { loadTable, resolve } from '../../engine/src/index.ts';
import type { Tree, TitleEntry, Generic, Spoken, Forms, Title } from '../../engine/src/index.ts';
import titles from '../../engine/data/titles.json' with { type: 'json' };
import generic from '../../engine/data/generic.json' with { type: 'json' };

const table = loadTable(titles as unknown as TitleEntry[]);

export interface Line { label?: string; chars: string; jyutping?: string; byName?: boolean }
export interface Shown {
  kind: 'self' | 'title' | 'byAge' | 'fallback' | 'unrelated';
  lines: Line[];          // spoken titles, large; one line, or two for older/younger
  formal?: Title;         // formal term underneath (single-line cases)
  gloss?: string;         // English
  describe?: string;      // fallback: the relationship in words
}

const BY_NAME = 'by name';

function line(s: Spoken, label?: string): Line {
  return s === 'by-name' ? { label, chars: BY_NAME, byName: true } : { label, chars: s.chars, jyutping: s.jyutping };
}

function forms(f: Forms, label: string): Line {
  // Younger relatives are called by name; the formal term is still worth showing.
  return f.spoken === 'by-name' ? { label, chars: f.formal.chars, jyutping: f.formal.jyutping, byName: true } : line(f.spoken, label);
}

export function showFor(tree: Tree, me: string, target: string): Shown {
  const r = resolve(tree, table, generic as unknown as Generic, me, target);
  switch (r.kind) {
    case 'self': return { kind: 'self', lines: [{ chars: '我', jyutping: 'ngo5' }], gloss: 'me' };
    case 'unrelated': return { kind: 'unrelated', lines: [] };
    case 'title': {
      const { spoken, formal } = r.forms;
      return {
        kind: 'title', gloss: r.en,
        lines: [spoken === 'by-name' ? { chars: formal.chars, jyutping: formal.jyutping, byName: true } : line(spoken)],
        formal: spoken === 'by-name' || spoken.chars === formal.chars ? undefined : formal,
      };
    }
    case 'byAge':
      return { kind: 'byAge', gloss: r.en, lines: [forms(r.older, 'older'), forms(r.younger, 'younger')] };
    case 'fallback': {
      const g = r.generic;
      const lines = typeof g === 'object' && 'older' in g
        ? [line(g.older, 'older'), line(g.younger, 'younger')]
        : [line(g as Spoken)];
      return { kind: 'fallback', lines, gloss: r.describe.en, describe: r.describe.yue };
    }
  }
}
