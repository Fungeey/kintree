// A sample family, loaded with ?demo in the address bar. For trying the drawing.
import { addChild, addParent, addPerson, addPet, addSibling, addSpouse, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

export function demoTree(): { tree: Tree; me: string } {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'You'));
  add('dad', addParent(t, id.me, 'm'));
  add('mum', addParent(t, id.me, 'f'));
  add('sis', addSibling(t, id.me, 'f'));

  // Dad's side: two older sisters, both married.
  add('gpa', addParent(t, id.dad, 'm'));
  add('gma', addParent(t, id.dad, 'f'));
  add('dAunt2', addSibling(t, id.dad, 'f', undefined, 0));
  add('dAunt1', addSibling(t, id.dad, 'f', undefined, 0));
  add('dAunt1h', addSpouse(t, id.dAunt1, 'm'));
  add('dAunt1s', addChild(t, id.dAunt1, 'm'));
  add('dAunt1d', addChild(t, id.dAunt1, 'f'));
  add('dAunt2h', addSpouse(t, id.dAunt2, 'm'));
  add('dAunt2d', addChild(t, id.dAunt2, 'f'));
  add('dAunt2s', addChild(t, id.dAunt2, 'm'));

  // Mum's side: two older sisters; the eldest has no spouse.
  add('mgpa', addParent(t, id.mum, 'm'));
  add('mgma', addParent(t, id.mum, 'f'));
  add('mAunt2', addSibling(t, id.mum, 'f', undefined, 0));
  add('mAunt1', addSibling(t, id.mum, 'f', undefined, 0));
  add('mAunt1s', addChild(t, id.mAunt1, 'm'));
  add('mAunt2h', addSpouse(t, id.mAunt2, 'm'));
  add('mAunt2d', addChild(t, id.mAunt2, 'f'));
  add('mAunt2s1', addChild(t, id.mAunt2, 'm'));
  add('mAunt2s2', addChild(t, id.mAunt2, 'm'));

  // Wife's side: her dad is an only child; her mum has an older and a younger brother.
  add('wife', addSpouse(t, id.me, 'f'));
  add('wdad', addParent(t, id.wife, 'm'));
  add('wmum', addParent(t, id.wife, 'f'));
  add('wpgpa', addParent(t, id.wdad, 'm'));
  add('wpgma', addParent(t, id.wdad, 'f'));
  add('wmgpa', addParent(t, id.wmum, 'm'));
  add('wmgma', addParent(t, id.wmum, 'f'));
  add('wUnc1', addSibling(t, id.wmum, 'm', undefined, 0));
  add('wUnc2', addSibling(t, id.wmum, 'm'));
  add('wUnc1w', addSpouse(t, id.wUnc1, 'f'));
  add('wUnc1s1', addChild(t, id.wUnc1, 'm'));
  add('wUnc1s2', addChild(t, id.wUnc1, 'm'));
  add('wUnc2w', addSpouse(t, id.wUnc2, 'f'));
  add('wUnc2d', addChild(t, id.wUnc2, 'f'));
  add('wUnc2s', addChild(t, id.wUnc2, 'm'));

  // Dad's mother's own family: an older sister and a younger brother, both married with children.
  add('gmaSis', addSibling(t, id.gma, 'f', undefined, 0));
  add('gmaSisH', addSpouse(t, id.gmaSis, 'm'));
  add('gmaSisS', addChild(t, id.gmaSis, 'm'));
  add('gmaSisD', addChild(t, id.gmaSis, 'f'));
  add('gmaBro', addSibling(t, id.gma, 'm'));
  add('gmaBroW', addSpouse(t, id.gmaBro, 'f'));
  add('gmaBroS', addChild(t, id.gmaBro, 'm'));

  // Pets: a dog for you, a cat for your sister and a guinea pig for a cousin.
  add('dog', addPet(t, id.me, 'dog', 'Biscuit'));
  add('cat', addPet(t, id.sis, 'cat', 'Me-Me-Me'));
  add('gp', addPet(t, id.mAunt1s, 'guinea-pig'));
  return { tree: t, me: id.me };
}
