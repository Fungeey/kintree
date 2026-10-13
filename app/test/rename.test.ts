import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addParent, addPerson, addSibling, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { applyEdit, applyRename, siblingsOf, cleanName, MAX_NAME, nameRequired } from '../src/rename.ts';
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

test('edit: name and birth order change together; captions and share link follow', async () => {
  let { t, me } = sample();
  const s1 = addSibling(t, me, 'm', 'Kai'); t = s1.tree;
  const s2 = addSibling(t, me, 'f'); t = s2.tree;
  assert.deepEqual(siblingsOf(t, me), [me, s1.id, s2.id]);
  // Everyone can move, not just the person being edited: here Kai and me swap as well as Ling moving up.
  const next = applyEdit(t, s2.id, ' Ling ', [s2.id, s1.id, me])!;
  assert.deepEqual(siblingsOf(next, me), [s2.id, s1.id, me]);
  assert.equal(next.people.find(p => p.id === s2.id)!.name, 'Ling');
  const back = await decodeFragment(await encodeFragment({ tree: next, me }));
  assert.deepEqual(siblingsOf(back.tree, me), [s2.id, s1.id, me]);
});

test('edit: an empty root name is refused even when the order changes', () => {
  const { t, me } = sample();
  assert.equal(applyEdit(t, me, '', siblingsOf(t, me)), null);
});

test('edit: someone with no siblings is a group of one', () => {
  const { t, mum } = sample();
  assert.deepEqual(siblingsOf(t, mum), [mum]);
  assert.equal(applyEdit(t, mum, 'Lai', [mum])!.people.find(p => p.id === mum)!.name, 'Lai');
  assert.throws(() => applyEdit(t, mum, 'Lai', [mum, 'x']));
});

test('display: an aunt shows her usual title and her rank title; audio says only the usual one', async () => {
  const { showFor } = await import('../src/display.ts');
  const { spokenText } = await import('../src/audio/speech.ts');
  let t: Tree = emptyTree();
  const me = addPerson(t, 'f', 'Mei'); t = me.tree;
  const mum = addParent(t, me.id, 'f'); t = mum.tree;
  const a = addSibling(t, mum.id, 'f', undefined, 0); t = a.tree;
  const b = addSibling(t, mum.id, 'f', undefined, 1); t = b.tree;
  const shown = showFor(t, me.id, a.id);
  assert.deepEqual(shown.lines.map(l => l.chars), ['姨媽', '大姨媽']);
  assert.equal(spokenText(shown), '姨媽');
  assert.deepEqual(showFor(t, me.id, mum.id).lines.length, 1);
});

test('caption: shows the person\'s own name, and is blank when they have none', async () => {
  const { captionFor } = await import('../src/display.ts');
  const { t, me, dad, mum } = sample();
  assert.equal(captionFor(t, dad), 'Wing');
  assert.equal(captionFor(t, me), 'Mei');
  assert.equal(captionFor(t, mum), null);
  const named = applyRename(t, mum, 'Lai')!;
  assert.equal(captionFor(named, mum), 'Lai');
  const cleared = applyRename(named, mum, '')!;
  assert.equal(captionFor(cleared, mum), null);
});
