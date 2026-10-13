import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTable, matchPattern, resolve } from '../src/index.ts';
import type { Generic, Resolution, TitleEntry } from '../src/index.ts';
import { tree } from './fixture.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const yue: TitleEntry[] = load('../data/yue/titles.json');
const vie: TitleEntry[] = load('../data/vie/titles.json');
const generic: Generic = load('../data/vie/generic.json');
const table = loadTable(vie);
const r = (me: string, target: string): Resolution => resolve(tree, table, generic, me, target, ' của ', true);

// Every concrete path a pattern covers: wildcard ages expand to elder and younger.
const expand = (p: string): string[] => p.split(' ').reduce<string[]>((acc, t) => {
  const opts = t[1] === '*' ? [t[0] + 'e', t[0] + 'y'] : [t];
  return acc.flatMap(a => opts.map(o => (a ? a + ' ' : '') + o));
}, ['']);

test('Vietnamese table answers every path the Cantonese table does, with the same kind of answer', () => {
  for (const e of yue) {
    for (const path of expand(e.pattern)) {
      const m = matchPattern(table, path);
      assert.ok(m, `no Vietnamese title for ${path}`);
    }
  }
});

test('Vietnamese table has no reading field and no Chinese characters', () => {
  const all = JSON.stringify(vie);
  assert.ok(!all.includes('"rom"'));
  assert.ok(!/[一-鿿]/.test(all));
});

test('Vietnamese: parents\' elder siblings are bác (northern), younger ones depend on side', () => {
  const spoken = (path: string) => {
    const m = matchPattern(table, path)!;
    return m.spoken === undefined || m.spoken === 'by-name' ? '' : m.spoken.chars;
  };
  assert.equal(spoken('F Be'), 'bác'); assert.equal(spoken('F By'), 'chú'); assert.equal(spoken('F Zy'), 'cô');
  assert.equal(spoken('M Be'), 'bác'); assert.equal(spoken('M By'), 'cậu'); assert.equal(spoken('M Zy'), 'dì');
  assert.equal(spoken('F F'), 'ông nội'); assert.equal(spoken('M M'), 'bà ngoại');
});

test('Vietnamese: cousins follow the parents\' order, not their own age', () => {
  const f = (path: string) => { const m = matchPattern(table, path)!; return m.formal.chars; };
  assert.equal(f('F Be S'), 'anh họ'); assert.equal(f('F Be D'), 'chị họ');
  assert.equal(f('F By S'), 'em họ'); assert.equal(f('M Zy D'), 'em họ');
  assert.equal(matchPattern(table, 'F Be S')!.older, undefined);   // a plain title, not both ages
});

test('Vietnamese: a fallback description puts the nearest relative last', () => {
  const x = r('me', 'dadCousin');   // F F Be S
  assert.ok(x.kind === 'fallback');
  assert.deepEqual(x.generic, { chars: 'chú' });
  assert.match(x.describe.text, / của /);
  assert.ok(x.describe.text.endsWith('cha'), x.describe.text);
});
