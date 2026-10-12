// A sample family, loaded with ?demo in the address bar. For trying the drawing.
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

export function demoTree(): { tree: Tree; me: string } {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Aaron'));
  add('dad', addParent(t, id.me, 'm', 'David'));
  add('mum', addParent(t, id.me, 'f', 'Mary'));
  add('sis', addSibling(t, id.me, 'f', 'Sarah'));

  // Dad's side: two older sisters, both married.
  add('gpa', addParent(t, id.dad, 'm', 'George'));
  add('gma', addParent(t, id.dad, 'f', 'Grace'));
  add('dAunt2', addSibling(t, id.dad, 'f', 'Julia', 0));
  add('dAunt1', addSibling(t, id.dad, 'f', 'Helen', 0));
  add('dAunt1h', addSpouse(t, id.dAunt1, 'm', 'Henry'));
  add('dAunt1s', addChild(t, id.dAunt1, 'm', 'Ivan'));
  add('dAunt1d', addChild(t, id.dAunt1, 'f', 'Iris'));
  add('dAunt2h', addSpouse(t, id.dAunt2, 'm', 'James'));
  add('dAunt2d', addChild(t, id.dAunt2, 'f', 'Jade'));
  add('dAunt2s', addChild(t, id.dAunt2, 'm', 'Jack'));

  // Mum's side: two older sisters; the eldest has no spouse.
  add('mgpa', addParent(t, id.mum, 'm', 'Kenneth'));
  add('mgma', addParent(t, id.mum, 'f', 'Karen'));
  add('mAunt2', addSibling(t, id.mum, 'f', 'Nancy', 0));
  add('mAunt1', addSibling(t, id.mum, 'f', 'Linda', 0));
  add('mAunt1s', addChild(t, id.mAunt1, 'm', 'Leo'));
  add('mAunt2h', addSpouse(t, id.mAunt2, 'm', 'Neil'));
  add('mAunt2d', addChild(t, id.mAunt2, 'f', 'Nora'));
  add('mAunt2s1', addChild(t, id.mAunt2, 'm', 'Noah'));
  add('mAunt2s2', addChild(t, id.mAunt2, 'm', 'Nick'));

  // Wife's side: her dad is an only child; her mum has an older and a younger brother.
  add('wife', addSpouse(t, id.me, 'f', 'Wendy'));
  add('wdad', addParent(t, id.wife, 'm', 'Walter'));
  add('wmum', addParent(t, id.wife, 'f', 'Rose'));
  add('wpgpa', addParent(t, id.wdad, 'm', 'Peter'));
  add('wpgma', addParent(t, id.wdad, 'f', 'Pearl'));
  add('wmgpa', addParent(t, id.wmum, 'm', 'Robert'));
  add('wmgma', addParent(t, id.wmum, 'f', 'Ruth'));
  add('wUnc1', addSibling(t, id.wmum, 'm', 'Tom', 0));
  add('wUnc2', addSibling(t, id.wmum, 'm', 'Victor'));
  add('wUnc1w', addSpouse(t, id.wUnc1, 'f', 'Tina'));
  add('wUnc1s1', addChild(t, id.wUnc1, 'm', 'Tim'));
  add('wUnc1s2', addChild(t, id.wUnc1, 'm', 'Ted'));
  add('wUnc2w', addSpouse(t, id.wUnc2, 'f', 'Vera'));
  add('wUnc2d', addChild(t, id.wUnc2, 'f', 'Violet'));
  add('wUnc2s', addChild(t, id.wUnc2, 'm', 'Vince'));
  return { tree: t, me: id.me };
}
