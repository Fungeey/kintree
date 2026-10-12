// A sample family, loaded with ?demo in the address bar. For trying the drawing.
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

export function demoTree(): { tree: Tree; me: string } {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Aaron'));
  add('dad', addParent(t, id.me, 'm', 'Dad'));
  add('mum', addParent(t, id.me, 'f', 'Mum'));
  add('sis', addSibling(t, id.me, 'f', 'Sis', 0));
  add('bro', addSibling(t, id.me, 'm', 'Bro'));
  add('gpa', addParent(t, id.dad, 'm', 'Grandpa'));
  add('gma', addParent(t, id.dad, 'f', 'Grandma'));
  add('ggpa', addParent(t, id.gpa, 'm', 'Great-grandpa'));
  add('ggma', addParent(t, id.gpa, 'f', 'Great-grandma'));
  add('unc', addSibling(t, id.dad, 'm', 'Uncle', 0));
  add('aunt', addSibling(t, id.dad, 'f', 'Aunt'));
  add('cous', addChild(t, id.unc, 'f', 'Cousin'));
  add('mgpa', addParent(t, id.mum, 'm', 'Mum’s dad'));
  add('mgma', addParent(t, id.mum, 'f', 'Mum’s mum'));
  add('mun', addSibling(t, id.mum, 'm', 'Mum’s brother'));
  add('wife', addSpouse(t, id.me, 'f', 'Wife'));
  add('wdad', addParent(t, id.wife, 'm', 'Wife’s dad'));
  add('wmum', addParent(t, id.wife, 'f', 'Wife’s mum'));
  add('wsis', addSibling(t, id.wife, 'f', 'Wife’s sister'));
  add('son', addChild(t, id.me, 'm', 'Son'));
  add('dau', addChild(t, id.me, 'f', 'Daughter'));
  return { tree: t, me: id.me };
}
