import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree, sides, visible } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { CARD_H, CARD_W, layoutTree, linkSegments } from '../src/layout.ts';
import { showFor } from '../src/display.ts';

function sample() {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Me'));
  add('dad', addParent(t, id.me, 'm', 'Dad'));
  add('mum', addParent(t, id.me, 'f', 'Mum'));
  add('bro', addSibling(t, id.me, 'm', 'Bro'));
  add('gpa', addParent(t, id.dad, 'm', 'Gpa'));
  add('gma', addParent(t, id.dad, 'f', 'Gma'));
  add('unc', addSibling(t, id.dad, 'm', 'Uncle', 0));
  add('cous', addChild(t, id.unc, 'f', 'Cousin'));
  add('wife', addSpouse(t, id.me, 'f', 'Wife'));
  add('wdad', addParent(t, id.wife, 'm', 'WDad'));
  add('kid', addChild(t, id.me, 'm', 'Kid'));
  return { t, id };
}

test('layout: rows by generation, no overlaps, everyone placed', () => {
  const { t, id } = sample();
  const L = layoutTree(t, id.me);
  assert.equal(L.pos.size, t.people.length);
  assert.ok(L.pos.get(id.gpa)!.y < L.pos.get(id.dad)!.y);
  assert.ok(L.pos.get(id.dad)!.y < L.pos.get(id.me)!.y);
  assert.ok(L.pos.get(id.me)!.y < L.pos.get(id.kid)!.y);
  assert.equal(L.pos.get(id.wife)!.y, L.pos.get(id.me)!.y);
  const byRow = new Map<number, number[]>();
  for (const p of L.pos.values()) byRow.set(p.y, [...(byRow.get(p.y) ?? []), p.x]);
  for (const xs of byRow.values()) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= CARD_W, 'cards overlap');
  }
  for (const p of L.pos.values()) assert.ok(p.x >= 0 && p.x + CARD_W <= L.width && p.y + CARD_H <= L.height);
});

test('layout: parents sit centred over their children', () => {
  const { t, id } = sample();
  const L = layoutTree(t, id.me);
  const c = (i: string) => L.pos.get(i)!.x + CARD_W / 2;
  // Uncle and Dad are the children of Gpa and Gma.
  assert.ok(Math.abs((c(id.gpa) + c(id.gma)) / 2 - (c(id.unc) + c(id.dad)) / 2) < 1);
  assert.ok(c(id.unc) < c(id.dad), 'elder sibling is on the left');
});

test('layout: a single person and the empty tree', () => {
  const { tree, id } = addPerson(emptyTree(), 'f');
  const L = layoutTree(tree, id);
  assert.equal(L.pos.size, 1);
  assert.deepEqual(linkSegments(L), []);
  assert.equal(layoutTree(emptyTree(), 'x').pos.size, 0);
});

test('layout: side filter hides the other side', () => {
  const { t, id } = sample();
  const s = sides(t, id.me);
  assert.ok(s.married);
  const mine = layoutTree(t, id.me, p => visible(s, p, 'mine'));
  const spouse = layoutTree(t, id.me, p => visible(s, p, 'spouse'));
  assert.ok(mine.pos.has(id.gpa) && !mine.pos.has(id.wdad));
  assert.ok(spouse.pos.has(id.wdad) && !spouse.pos.has(id.gpa));
  assert.ok(mine.pos.has(id.kid) && spouse.pos.has(id.kid));
});

test('layout: links reach every child, unknown parents get a dashed stub', () => {
  const { t, id } = sample();
  const L = layoutTree(t, id.me);
  assert.ok(linkSegments(L).length > 10);
  const lone = addSibling(addPerson(emptyTree(), 'm').tree, 'p1', 'f');
  const L2 = layoutTree(lone.tree, 'p1');
  assert.ok(linkSegments(L2).some(s => s.dashed));
});

test('display: titles from me', () => {
  const { t, id } = sample();
  assert.equal(showFor(t, id.me, id.me).kind, 'self');
  const dad = showFor(t, id.me, id.dad);
  assert.equal(dad.kind, 'title');
  assert.equal(dad.lines[0].chars, '爸爸');
  assert.equal(showFor(t, id.me, id.cous).kind, 'byAge');
  assert.ok(showFor(t, id.me, id.kid).lines[0].byName);
});
