// Shared by the language tests: load a language's data and ask what "me" calls "target".
import { readFileSync } from 'node:fs';
import { loadTable, resolve } from '../src/index.ts';
import type { Generic, Resolution, Spoken, TitleEntry } from '../src/index.ts';
import { tree } from './fixture.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
export const titles = (lang: string): TitleEntry[] => load(`../data/${lang}/titles.json`);
export const generic = (lang: string): Generic => load(`../data/${lang}/generic.json`);

export function setup(lang: string, joiner: string, reverse = false) {
  const table = loadTable(titles(lang));
  const g = generic(lang);
  const r = (me: string, target: string): Resolution => resolve(tree, table, g, me, target, joiner, reverse);
  const name = (s: Spoken) => (s === 'by-name' ? 'by-name' : s.chars);
  // The spoken title for a plain title, or "formal/older+younger" style text for other kinds, for short assertions.
  const spoken = (me: string, target: string): string => {
    const x = r(me, target);
    if (x.kind !== 'title') throw new Error(`${me}->${target} is ${x.kind}`);
    return name(x.forms.spoken);
  };
  const formal = (me: string, target: string): string => {
    const x = r(me, target);
    if (x.kind !== 'title') throw new Error(`${me}->${target} is ${x.kind}`);
    return x.forms.formal.chars;
  };
  return { table, g, r, spoken, formal, name };
}

// Every concrete path a pattern covers: wildcard ages expand to elder and younger.
export const expand = (p: string): string[] => p.split(' ').reduce<string[]>((acc, t) => {
  const opts = t[1] === '*' ? [t[0] + 'e', t[0] + 'y'] : [t];
  return acc.flatMap(a => opts.map(o => (a ? a + ' ' : '') + o));
}, ['']);
