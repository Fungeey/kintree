import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kinPath } from '../../../engine/src/index.ts';
import { availableRelations, slotQuestion, applyAdd, startTree, suggestSex } from './flow.ts';

test('empty tree starts with me', () => {
  const { tree, id } = startTree('f', ' Mei ');
  assert.equal(tree.people[0].name, 'Mei');
  assert.equal(kinPath(tree, id, id), '');
});

test('parent and spouse are offered only while there is room', () => {
  let { tree, id: me } = startTree('m', 'Me');
  assert.deepEqual(availableRelations(tree, me), ['parent', 'child', 'spouse', 'sibling']);
  tree = applyAdd(tree, { from: me, relation: 'parent', sex: 'm' }).tree;
  tree = applyAdd(tree, { from: me, relation: 'parent', sex: 'f' }).tree;
  tree = applyAdd(tree, { from: me, relation: 'spouse', sex: 'f' }).tree;
  assert.deepEqual(availableRelations(tree, me), ['child', 'sibling']);
});

test('unknown parents: a sibling or aunt can be added with no parents', () => {
  let { tree, id: me } = startTree('m', 'Me');
  const q = slotQuestion(tree, me, 'sibling');
  assert.deepEqual(q?.members.map(p => p.id), [me]);
  const sis = applyAdd(tree, { from: me, relation: 'sibling', sex: 'f', slot: 0 });
  assert.equal(kinPath(sis.tree, me, sis.id), 'Ze');
  assert.equal(sis.tree.families[0].parents.length, 0);
});

test('slot asked once per sibling group; none for first child, parent, spouse', () => {
  let { tree, id: me } = startTree('m', 'Me');
  assert.equal(slotQuestion(tree, me, 'child'), null);
  assert.equal(slotQuestion(tree, me, 'parent'), null);
  assert.equal(slotQuestion(tree, me, 'spouse'), null);
  const c1 = applyAdd(tree, { from: me, relation: 'child', sex: 'm' });
  const q = slotQuestion(c1.tree, me, 'child')!;
  assert.equal(q.members.length, 1);
  const c2 = applyAdd(c1.tree, { from: me, relation: 'child', sex: 'f', slot: 0 });
  assert.equal(kinPath(c2.tree, c1.id, c2.id), 'Ze');
  const q2 = slotQuestion(c2.tree, me, 'child')!;
  assert.equal(q2.members.length, 2);
  // The same group is found from a child's side.
  assert.equal(slotQuestion(c2.tree, c1.id, 'sibling')!.members.length, 2);
});

test('blank name is dropped; suggestSex proposes the opposite', () => {
  const { tree, id: me } = startTree('m', 'Me');
  const w = applyAdd(tree, { from: me, relation: 'spouse', sex: 'f', name: '  ' });
  assert.equal(w.tree.people.find(p => p.id === w.id)!.name, undefined);
  assert.equal(suggestSex(tree, me, 'spouse'), 'f');
  assert.equal(suggestSex(tree, me, 'child'), null);
  const dad = applyAdd(tree, { from: me, relation: 'parent', sex: 'm' });
  assert.equal(suggestSex(dad.tree, me, 'parent'), 'f');
});

test('input tree is untouched', () => {
  const { tree, id } = startTree('m', 'Me');
  const before = structuredClone(tree);
  applyAdd(tree, { from: id, relation: 'child', sex: 'm' });
  assert.deepEqual(tree, before);
});

test('the first person must have a name and becomes the root', () => {
  assert.throws(() => startTree('m', '   '));
  const { tree, id } = startTree('f', 'Mei');
  assert.equal(tree.root, id);
});

test('adding with an order places the new person and moves the others too', () => {
  const { tree, id: me } = startTree('m', 'Me');
  const a = applyAdd(tree, { from: me, relation: 'sibling', sex: 'f', name: 'A' });
  const b = applyAdd(a.tree, { from: me, relation: 'sibling', sex: 'm', name: 'B' });
  const group = (t: typeof tree) => t.families.find(f => f.children.includes(me))!.children;
  assert.deepEqual(group(b.tree), [me, a.id, b.id]);
  // New person goes in the middle and A and Me swap.
  const c = applyAdd(b.tree, { from: me, relation: 'sibling', sex: 'f', name: 'C', order: [a.id, null, me, b.id] });
  assert.deepEqual(group(c.tree), [a.id, c.id, me, b.id]);
  assert.equal(c.tree.people.find(p => p.id === c.id)!.name, 'C');
  // The same for children, from the parent's side.
  const k1 = applyAdd(c.tree, { from: me, relation: 'child', sex: 'm', name: 'K1' });
  const k2 = applyAdd(k1.tree, { from: me, relation: 'child', sex: 'f', name: 'K2', order: [null, k1.id] });
  assert.deepEqual(k2.tree.families.find(f => f.parents.includes(me))!.children, [k2.id, k1.id]);
});
