import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree, sides, visible } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { hiddenRelatives } from '../src/hidden.ts';

test('hidden relatives: a spouse and a great-aunt carry a count for the family left out', () => {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm'));
  add('dad', addParent(t, id.me, 'm'));
  add('gma', addParent(t, id.dad, 'f'));
  add('gmaSis', addSibling(t, id.gma, 'f'));      // great-aunt
  add('gmaSisS', addChild(t, id.gmaSis, 'm'));
  add('gmaSisD', addChild(t, id.gmaSis, 'f'));
  add('wife', addSpouse(t, id.me, 'f'));
  add('wifeMum', addParent(t, id.wife, 'f'));
  add('wifeSis', addSibling(t, id.wife, 'f'));
  const s = sides(t, id.me);
  const show = (p: string) => visible(s, p, 'mine');
  assert.equal(hiddenRelatives(t, id.gmaSis, show), 2, 'her two children');
  assert.equal(hiddenRelatives(t, id.wife, show), 2, "the wife's mother and sister");
  assert.equal(hiddenRelatives(t, id.me, show), 0);
  assert.equal(hiddenRelatives(t, id.dad, show), 0);
  // Switch to the great-aunt: her children show and the count goes.
  const s2 = sides(t, id.gmaSis);
  assert.equal(hiddenRelatives(t, id.gmaSis, p => visible(s2, p, 'mine')), 0);
});
