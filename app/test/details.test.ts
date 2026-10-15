import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPerson, addSibling, emptyTree, setBorn, setBirthOrder } from '../../engine/src/index.ts';
import type { Shown } from '../src/display.ts';
import { ageOf, aboutLines, bornLine, maxYear, orderByYear, orderConflict, parseYear, relationText } from '../src/details.ts';

const NOW = 2026;

test('year field: empty clears, four digits within range are accepted, everything else says why', () => {
  assert.deepEqual(parseYear('', NOW), { year: undefined });
  assert.deepEqual(parseYear('  ', NOW), { year: undefined });
  assert.deepEqual(parseYear('1952', NOW), { year: 1952 });
  assert.deepEqual(parseYear(' 2026 ', NOW), { year: 2026 });
  for (const bad of ['2027', '999', '0999', '19', '52', '19x2', '1952.5', '-1952', 'abc']) assert.ok('error' in parseYear(bad, NOW), bad);
  assert.match((parseYear('2027', NOW) as { error: string }).error, /1000 to 2026/);
  assert.equal(maxYear(2026), 2026);
});

test('age comes from the year alone and is never negative', () => {
  assert.equal(ageOf(1952, NOW), 74);
  assert.equal(ageOf(2026, NOW), 0);
  assert.equal(ageOf(2030, NOW), 0);
  assert.equal(bornLine(1952, NOW), 'b. 1952 · age 74');
});

const shown = (s: Partial<Shown>): Shown => ({ kind: 'title', lines: [], ...s });

test('About: the relation, then the birth year when there is one', () => {
  assert.equal(relationText(shown({ gloss: "father's older sister" }), false), "Your father's older sister");
  assert.equal(relationText(shown({ kind: 'self' }), true), 'You');
  assert.equal(relationText(shown({ kind: 'fallback', describe: "your wife's cousin" }), false), "your wife's cousin");
  assert.equal(relationText(shown({ kind: 'unrelated' }), false), null);
  assert.deepEqual(aboutLines(shown({ gloss: 'mother' }), false, undefined, NOW), ['Your mother']);
  assert.deepEqual(aboutLines(shown({ gloss: 'mother' }), false, 1952, NOW), ['Your mother', 'b. 1952 · age 74']);
  assert.deepEqual(aboutLines(shown({ kind: 'unrelated' }), false, undefined, NOW), []);
});

function sibs() {
  const a = addPerson(emptyTree(), 'f', 'Kam');
  const b = addSibling(a.tree, a.id, 'f', 'Wai Lan');
  const c = addSibling(b.tree, b.id, 'm', 'Ho');
  const t = c.tree;
  const ids = t.families[0].children;
  return { t, ids, by: (name: string) => t.people.find(p => p.name === name)!.id };
}

test('birth order check: years must not run backwards; people without a year are ignored', () => {
  const { t, ids, by } = sibs();
  assert.equal(orderConflict(t, ids), false);                                  // no years at all
  let u = setBorn(t, by('Kam'), 1950);
  u = setBorn(u, by('Ho'), 1960);
  assert.equal(orderConflict(u, ids), false);                                  // Kam, (Wai Lan unknown), Ho: fine
  const swapped = setBirthOrder(u, by('Ho'), [by('Ho'), by('Wai Lan'), by('Kam')]);
  assert.equal(orderConflict(swapped, swapped.families[0].children), true);
  assert.equal(orderConflict(setBorn(u, by('Ho'), 1950), ids), false);          // equal years are fine
});

test('reorder by year: dated people sorted among their own places, undated stay where they are', () => {
  const { t, by } = sibs();
  const [kam, wai, ho] = [by('Kam'), by('Wai Lan'), by('Ho')];
  let u = setBorn(t, kam, 1970);
  u = setBorn(u, ho, 1950);
  assert.deepEqual(orderByYear(u, [kam, wai, ho]), [ho, wai, kam]);
  assert.deepEqual(orderByYear(u, [ho, wai, kam]), [ho, wai, kam]);             // already right: unchanged
  assert.deepEqual(orderByYear(t, [kam, wai, ho]), [kam, wai, ho]);             // no years: unchanged
  const v = setBorn(setBorn(u, wai, 1950), kam, 1950);                           // ties keep their order
  assert.deepEqual(orderByYear(v, [kam, wai, ho]), [kam, wai, ho]);
});
