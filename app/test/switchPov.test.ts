import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addParent, addPerson, addSibling, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { switchTarget, viewingAs } from '../src/switchPov.ts';
import { demoTree } from '../src/demo.ts';

function sample() {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Mei'));
  add('dad', addParent(t, id.me, 'm', 'Wing'));
  add('mum', addParent(t, id.me, 'f'));
  add('gpa', addParent(t, id.dad, 'm'));
  return { t, id };
}

test('switch: tapping "me" asks nothing', () => {
  const { t, id } = sample();
  assert.equal(switchTarget(t, id.me, id.me), null);
});

test('switch: unknown person asks nothing', () => {
  const { t, id } = sample();
  assert.equal(switchTarget(t, id.me, 'nobody'), null);
});

test('switch: a named person is asked about by name', () => {
  const { t, id } = sample();
  assert.equal(switchTarget(t, id.me, id.dad), 'Wing');
});

test('switch: an unnamed person is named by their relation to the root', () => {
  const { t, id } = sample();
  assert.equal(switchTarget(t, id.me, id.mum), "Mei's mother");
  // Same label whoever "me" is.
  assert.equal(switchTarget(t, id.dad, id.mum), "Mei's mother");
});

test('switch: in the demo family (root "You") the label reads "your ..."', () => {
  const { tree, me } = demoTree();
  const other = tree.people.find(p => p.id !== me && !p.name)!;
  const who = switchTarget(tree, me, other.id)!;
  assert.match(who, /^your /);
});

test('switch: with no named root, an unnamed person is named by relation to "me"', () => {
  let t: Tree = emptyTree();
  const a = addPerson(t, 'f'); t = a.tree;
  const b = addSibling(t, a.id, 'm', undefined, 0); t = b.tree;
  const who = switchTarget(t, a.id, b.id)!;
  assert.match(who, /^your /);
});

test('viewing as: a named "me" shows their name', () => {
  const { t, id } = sample();
  assert.equal(viewingAs(t, id.me), 'Mei');
  assert.equal(viewingAs(t, id.dad), 'Wing');
});

test('viewing as: an unnamed "me" shows their relation to the root', () => {
  const { t, id } = sample();
  assert.equal(viewingAs(t, id.mum), "Mei's mother");
  assert.equal(viewingAs(t, id.gpa), "Mei's paternal grandfather");
});
