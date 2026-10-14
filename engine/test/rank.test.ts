import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addParent, addPerson, addSibling, addSpouse, emptyTree, RANK_CMN, rankTitle, setBirthOrder } from '../src/index.ts';
import type { Tree } from '../src/index.ts';

// Me, my mother, and her siblings in birth order: sister A, sister B, mum, brother C, sister D.
function family() {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Me'));
  add('mum', addParent(t, id.me, 'f'));
  add('dad', addParent(t, id.me, 'm'));
  add('B', addSibling(t, id.mum, 'f', 'B', 0));
  add('A', addSibling(t, id.mum, 'f', 'A', 0));
  add('C', addSibling(t, id.mum, 'm', 'C'));
  add('D', addSibling(t, id.mum, 'f', 'D'));
  add('Ah', addSpouse(t, id.A, 'm'));
  return { t, id };
}

test('rank: mother\'s sisters are ranked among her sisters, eldest first', () => {
  const { t, id } = family();
  assert.deepEqual(rankTitle(t, id.me, id.A), { chars: '大姨媽', rom: 'daai6 ji4 maa1' });
  assert.deepEqual(rankTitle(t, id.me, id.B), { chars: '二姨媽', rom: 'ji6 ji4 maa1' });
  // The younger sister is the third sister; she is younger than mum so she takes the younger stem.
  assert.deepEqual(rankTitle(t, id.me, id.D), { chars: '三姨', rom: 'saam1 ji4' });
});

test('rank: brothers are ranked among brothers, so a lone brother has no rank', () => {
  const { t, id } = family();
  assert.equal(rankTitle(t, id.me, id.C), null);
});

test('rank: an aunt\'s husband takes her rank', () => {
  const { t, id } = family();
  assert.deepEqual(rankTitle(t, id.me, id.Ah), { chars: '大姨丈', rom: 'daai6 ji4 zoeng2' });
});

test('rank: follows birth order edits', () => {
  const { t, id } = family();
  const swapped = setBirthOrder(t, id.B, [id.B, id.A, id.mum, id.C, id.D]);
  assert.equal(rankTitle(swapped, id.me, id.B)!.chars, '大姨媽');
  assert.equal(rankTitle(swapped, id.me, id.A)!.chars, '二姨媽');
});

test('rank: not for parents, siblings, cousins or unrelated people', () => {
  const { t, id } = family();
  assert.equal(rankTitle(t, id.me, id.mum), null);
  assert.equal(rankTitle(t, id.me, id.me), null);
  assert.equal(rankTitle(t, id.me, id.dad), null);
  // Seen from an aunt, her sister is a sibling.
  assert.equal(rankTitle(t, id.A, id.B), null);
});

test('rank: father\'s side uses 伯 for elder brothers and 叔 for younger ones, counted together', () => {
  let t: Tree = emptyTree();
  const me = addPerson(t, 'f', 'Me'); t = me.tree;
  const dad = addParent(t, me.id, 'm'); t = dad.tree;
  const b1 = addSibling(t, dad.id, 'm', undefined, 0); t = b1.tree;
  const b2 = addSibling(t, dad.id, 'm'); t = b2.tree;
  const b3 = addSibling(t, dad.id, 'm'); t = b3.tree;
  assert.equal(rankTitle(t, me.id, b1.id)!.chars, '大伯');
  assert.equal(rankTitle(t, me.id, b2.id)!.chars, '二叔');
  assert.equal(rankTitle(t, me.id, b3.id)!.chars, '三叔');
});

test('rank: mother\'s brothers take the full 舅父', () => {
  const { t: base, id } = family();
  const e = addSibling(base, id.mum, 'm', 'E');
  assert.deepEqual(rankTitle(e.tree, id.me, id.C), { chars: '大舅父', rom: 'daai6 kau5 fu2' });
  assert.deepEqual(rankTitle(e.tree, id.me, e.id), { chars: '二舅父', rom: 'ji6 kau5 fu2' });
});

// Me, dad, and dad's father with his siblings in birth order: brother A, grandpa, brother B, sister C, sister D.
function grandFamily() {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Me'));
  add('dad', addParent(t, id.me, 'm'));
  add('mum', addParent(t, id.me, 'f'));
  add('gf', addParent(t, id.dad, 'm'));
  add('A', addSibling(t, id.gf, 'm', 'A', 0));
  add('B', addSibling(t, id.gf, 'm', 'B'));
  add('C', addSibling(t, id.gf, 'f', 'C'));
  add('D', addSibling(t, id.gf, 'f', 'D'));
  add('Aw', addSpouse(t, id.A, 'f'));
  add('Bw', addSpouse(t, id.B, 'f'));
  add('Ch', addSpouse(t, id.C, 'm'));
  add('mgm', addParent(t, id.mum, 'f'));
  add('E', addSibling(t, id.mgm, 'm', 'E'));
  add('G', addSibling(t, id.mgm, 'm', 'G'));
  add('Ew', addSpouse(t, id.E, 'f'));
  add('J', addSibling(t, id.mgm, 'f', 'J'));
  add('K', addSibling(t, id.mgm, 'f', 'K'));
  add('Jh', addSpouse(t, id.J, 'm'));
  return { t, id };
}

test('rank: grandfather\'s brothers use 伯公 and 叔公, counted together, and wives take their rank', () => {
  const { t, id } = grandFamily();
  assert.deepEqual(rankTitle(t, id.me, id.A), { chars: '大伯公', rom: 'daai6 baak3 gung1' });
  assert.deepEqual(rankTitle(t, id.me, id.B), { chars: '二叔公', rom: 'ji6 suk1 gung1' });
  assert.deepEqual(rankTitle(t, id.me, id.Aw), { chars: '大伯婆', rom: 'daai6 baak3 po4' });
  assert.deepEqual(rankTitle(t, id.me, id.Bw), { chars: '二叔婆', rom: 'ji6 suk1 po4' });
});

test('rank: grandfather\'s sisters are 姑婆 and their husbands 姑丈公', () => {
  const { t, id } = grandFamily();
  assert.equal(rankTitle(t, id.me, id.C)!.chars, '大姑婆');
  assert.equal(rankTitle(t, id.me, id.D)!.chars, '二姑婆');
  assert.deepEqual(rankTitle(t, id.me, id.Ch), { chars: '大姑丈公', rom: 'daai6 gu1 zoeng2 gung1' });
});

test('rank: mother\'s grandmother\'s side uses 舅公, 舅婆, 姨婆 and 姨丈公', () => {
  const { t, id } = grandFamily();
  assert.equal(rankTitle(t, id.me, id.E)!.chars, '大舅公');
  assert.equal(rankTitle(t, id.me, id.G)!.chars, '二舅公');
  assert.equal(rankTitle(t, id.me, id.Ew)!.chars, '大舅婆');
  assert.equal(rankTitle(t, id.me, id.J)!.chars, '大姨婆');
  assert.equal(rankTitle(t, id.me, id.K)!.chars, '二姨婆');
  assert.deepEqual(rankTitle(t, id.me, id.Jh), { chars: '大姨丈公', rom: 'daai6 ji4 zoeng2 gung1' });
});

test('rank: not for grandparents themselves, and Mandarin has no grand ranks yet', () => {
  const { t, id } = grandFamily();
  assert.equal(rankTitle(t, id.me, id.gf), null);
  assert.equal(rankTitle(t, id.me, id.A, RANK_CMN), null);
});
