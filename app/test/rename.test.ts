import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addParent, addPerson, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { applyRename, cleanName, MAX_NAME, nameRequired } from '../src/rename.ts';
import { rootLabel } from '../src/display.ts';
import { decodeFragment, encodeFragment } from '../../storage/src/index.ts';

function sample() {
  let t: Tree = emptyTree();
  const me = addPerson(t, 'f', 'Mei'); t = me.tree;
  const dad = addParent(t, me.id, 'm', 'Wing'); t = dad.tree;
  const mum = addParent(t, me.id, 'f'); t = mum.tree;
  return { t, me: me.id, dad: dad.id, mum: mum.id };
}

test('rename: cleanName trims, collapses spaces and caps the length', () => {
  assert.equal(cleanName('  Auntie   May \n'), 'Auntie May');
  assert.equal(cleanName('   '), '');
  assert.equal([...cleanName('x'.repeat(100))].length, MAX_NAME);
  // Capped by characters, so a long Chinese name is not cut mid-character.
  assert.equal(cleanName('陳'.repeat(MAX_NAME + 5)), '陳'.repeat(MAX_NAME));
});

test('rename: sets a name on an unnamed person', () => {
  const { t, mum } = sample();
  const next = applyRename(t, mum, ' Lai ')!;
  assert.equal(next.people.find(p => p.id === mum)!.name, 'Lai');
  assert.equal(t.people.find(p => p.id === mum)!.name, undefined, 'input tree untouched');
});

test('rename: an empty name clears it', () => {
  const { t, dad } = sample();
  const next = applyRename(t, dad, '  ')!;
  assert.equal('name' in next.people.find(p => p.id === dad)!, false);
});

test('rename: no change returns the same tree', () => {
  const { t, dad, mum } = sample();
  assert.equal(applyRename(t, dad, 'Wing '), t);
  assert.equal(applyRename(t, mum, ''), t);
});

test('rename: the root can be renamed but not cleared, and captions follow', () => {
  const { t, me, dad } = sample();
  assert.equal(nameRequired(t, me), true);
  assert.equal(nameRequired(t, dad), false);
  assert.equal(applyRename(t, me, ' '), null);
  const next = applyRename(t, me, 'May')!;
  assert.equal(rootLabel(next, dad), "May's father");
  assert.equal(rootLabel(next, me), 'May');
});

test('rename: unknown person throws', () => {
  const { t } = sample();
  assert.throws(() => applyRename(t, 'nobody', 'X'));
});

test('rename: the new name survives the share-link encoding', async () => {
  const { t, me, mum } = sample();
  const next = applyRename(t, mum, 'Lai')!;
  const back = await decodeFragment(await encodeFragment({ tree: next, me }));
  assert.equal(back.tree.people.find(p => p.id === mum)!.name, 'Lai');
});
