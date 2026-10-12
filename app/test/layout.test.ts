import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree, sides, visible } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { CARD_H, CARD_W, layoutTree, linkSegments } from '../src/layout.ts';
import { rootLabel, showFor } from '../src/display.ts';

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
  const L = layoutTree(t);
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
  const L = layoutTree(t);
  const c = (i: string) => L.pos.get(i)!.x + CARD_W / 2;
  // Uncle and Dad are the children of Gpa and Gma.
  assert.ok(Math.abs((c(id.gpa) + c(id.gma)) / 2 - (c(id.unc) + c(id.dad)) / 2) < 1);
  assert.ok(c(id.unc) < c(id.dad), 'elder sibling is on the left');
});

test('layout: a single person and the empty tree', () => {
  const { tree, id } = addPerson(emptyTree(), 'f');
  const L = layoutTree(tree);
  assert.equal(L.pos.size, 1);
  assert.deepEqual(linkSegments(L), []);
  assert.equal(layoutTree(emptyTree()).pos.size, 0);
});

test('layout: side filter hides links to the other side without moving anyone', () => {
  const { t, id } = sample();
  const s = sides(t, id.me);
  assert.ok(s.married);
  const L = layoutTree(t);
  const mine = (p: string) => visible(s, p, 'mine');
  const spouse = (p: string) => visible(s, p, 'spouse');
  assert.ok(mine(id.gpa) && !mine(id.wdad));
  assert.ok(spouse(id.wdad) && !spouse(id.gpa));
  assert.ok(mine(id.kid) && spouse(id.kid));
  const all = linkSegments(L).length;
  assert.ok(linkSegments(L, mine).length < all && linkSegments(L, spouse).length < all);
});

test('layout: links reach every child, unknown parents get a dashed stub', () => {
  const { t, id } = sample();
  const L = layoutTree(t);
  assert.ok(linkSegments(L).length > 10);
  const lone = addSibling(addPerson(emptyTree(), 'm').tree, 'p1', 'f');
  const L2 = layoutTree(lone.tree);
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

test('layout: identical whoever "me" is', () => {
  const { t, id } = sample();
  let tree = addParent(t, id.gpa, 'm', 'Great-gpa').tree;
  tree = addPerson(tree, 'f', 'Stranger').tree;                  // not connected to anyone
  tree = addSibling(tree, id.wife, 'f', 'Wife sis').tree;
  const snap = (L: ReturnType<typeof layoutTree>) => JSON.stringify([[...L.pos].sort(), linkSegments(L), L.width, L.height]);
  // The layout takes no "me": the app draws the same positions for every point of view (the old
  // layout started from "me", so 8 of 20 people in the demo family gave a different picture).
  const first = snap(layoutTree(tree));
  for (const p of tree.people) {
    // What the app does for each choice of "me": the same full tree, nothing else varies.
    assert.equal(snap(layoutTree(tree)), first, `layout changed for me = ${p.name}`);
  }
  // Order of people in the tree decides ties, so a rebuilt tree with the same order draws the same.
  assert.equal(snap(layoutTree(structuredClone(tree))), first);
});

test('rootLabel: relation to the root, whoever "me" is', () => {
  const { t, id } = sample();
  const named = { ...t, root: id.me };
  assert.equal(rootLabel(named, id.me), 'Me');
  assert.equal(rootLabel(named, id.dad), "Me's father");
  assert.equal(rootLabel(named, id.gpa), "Me's paternal grandfather");
  assert.equal(rootLabel(named, id.wife), "Me's wife");
  // Great-grandparent
  const gg = addParent(named, id.gpa, 'm');
  assert.match(rootLabel(gg.tree, gg.id)!, /^Me's /);
  // The label is the same from every point of view and absent without a named root.
  assert.equal(rootLabel({ ...t, root: undefined }, id.dad), null);
  const unnamed = structuredClone(named);
  delete unnamed.people.find(p => p.id === id.me)!.name;
  assert.equal(rootLabel(unnamed, id.dad), null);
});
