import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyTree, addPerson, addParent, addChild, addSpouse, addSibling, removePerson, renamePerson, setBirthOrder, addPet, renamePet, removePet,
  validateTree, kinPath, loadTable, resolve, sides, visible,
} from '../src/index.ts';
import type { Tree, TitleEntry, Generic, View } from '../src/index.ts';
import { tree } from './fixture.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const table = loadTable(load('../data/yue/titles.json') as TitleEntry[]);
const generic: Generic = load('../data/yue/generic.json');

test('empty tree starts with me', () => {
  const { tree: t, id } = addPerson(emptyTree(), 'm', 'Me');
  assert.equal(t.people.length, 1);
  assert.equal(kinPath(t, id, id), '');
});

test('editing does not change the input tree', () => {
  const before = structuredClone(tree);
  addChild(tree, 'me', 'm');
  removePerson(tree, 'son');
  assert.deepEqual(tree, before);
});

test('addParent creates a family, then fills in the second parent', () => {
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const dad = addParent(t, me, 'm'); t = dad.tree;
  assert.equal(kinPath(t, me, dad.id), 'F');
  const mum = addParent(t, me, 'f'); t = mum.tree;
  assert.equal(kinPath(t, me, mum.id), 'M');
  assert.equal(t.families.length, 1);
  assert.throws(() => addParent(t, me, 'f'));
});

test('addParent fills in unknown parents (decision 19)', () => {
  // mumYoungerSis is in f_mum, which has no parents
  const r = addParent(tree, 'mumYoungerSis', 'm');
  assert.equal(r.tree.families.length, tree.families.length);
  assert.equal(kinPath(r.tree, 'mumYoungerSis', r.id), 'F');
  assert.equal(kinPath(r.tree, 'mum', r.id), 'F');
});

test('addSpouse and addChild build a couple with children in slot order', () => {
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const w = addSpouse(t, me, 'f'); t = w.tree;
  assert.equal(kinPath(t, me, w.id), 'W');
  assert.throws(() => addSpouse(t, me, 'f'));
  assert.throws(() => addSpouse(t, w.id, 'm'));
  const a = addChild(t, me, 'm'); t = a.tree;
  const b = addChild(t, w.id, 'f'); t = b.tree;          // youngest by default
  const c = addChild(t, me, 'f', undefined, 1); t = c.tree; // between a and b
  assert.deepEqual(t.families[0].children, [a.id, c.id, b.id]);
  assert.equal(kinPath(t, b.id, a.id), 'Be');
  assert.equal(kinPath(t, a.id, c.id), 'Zy');
  assert.throws(() => addChild(t, me, 'm', undefined, 9));
});

test('addChild to a lone parent makes a one-parent family', () => {
  const { tree: t, id: me } = addPerson(emptyTree(), 'f');
  const k = addChild(t, me, 'm');
  assert.deepEqual(k.tree.families[0].parents, [me]);
  assert.equal(kinPath(k.tree, me, k.id), 'S');
});

test('addSibling uses the slot and creates an unknown-parent family (decision 19)', () => {
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const aunt = addSibling(t, me, 'f', undefined, 0); t = aunt.tree;
  assert.deepEqual(t.families[0].parents, []);
  assert.deepEqual(t.families[0].children, [aunt.id, me]);
  assert.equal(kinPath(t, me, aunt.id), 'Ze');
  const younger = addSibling(t, me, 'm'); t = younger.tree;
  assert.equal(kinPath(t, me, younger.id), 'By');
  assert.throws(() => addSibling(t, me, 'm', undefined, -1));
});

test('an aunt with no grandparents resolves to a title', () => {
  // me -> dad (add), then dad's elder sister with unknown parents
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const dad = addParent(t, me, 'm'); t = dad.tree;
  const aunt = addSibling(t, dad.id, 'f', undefined, 0); t = aunt.tree;
  assert.equal(kinPath(t, me, aunt.id), 'F Ze');
  assert.equal(resolve(t, table, generic, me, aunt.id).kind, 'title');
});

test('unknown ids throw', () => {
  assert.throws(() => addChild(tree, 'nobody', 'm'));
  assert.throws(() => removePerson(tree, 'nobody'));
  assert.throws(() => sides(tree, 'nobody'));
});

test('removePerson takes the person out and drops empty families', () => {
  const t1 = removePerson(tree, 'son');
  validateTree(t1);
  assert.ok(!t1.people.some(p => p.id === 'son'));
  assert.ok(t1.families.every(f => !f.parents.includes('son') && !f.children.includes('son')));
  assert.deepEqual(t1.families.find(f => f.id === 'f_us')!.children, ['daughter']);
  // f_son had son + sonWife and grandson, so it survives with one parent
  assert.deepEqual(t1.families.find(f => f.id === 'f_son')!.parents, ['sonWife']);

  // a lone parent with no children, and a childless family with no parents, are dropped
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const kid = addChild(t, me, 'f'); t = kid.tree;
  t = removePerson(t, kid.id);
  assert.equal(t.families.length, 0);
  const sib = addSibling(t, me, 'f'); t = sib.tree;
  t = removePerson(t, sib.id);
  assert.equal(t.families.length, 0);
  // a childless couple is kept
  const sp = addSpouse(t, me, 'f'); t = sp.tree;
  assert.equal(removePerson(t, me).families.length, 0);
  assert.equal(t.families.length, 1);
});

const labels = (t: Tree, me: string, id: string) => [...(sides(t, me).labels.get(id) ?? [])].sort();

test('sides: unmarried me has one side and no toggle', () => {
  const { tree: t, id } = addPerson(emptyTree(), 'm');
  const dad = addParent(t, id, 'm');
  const s2 = sides(dad.tree, id);
  assert.equal(s2.married, false);
  assert.deepEqual(s2.labels.get(dad.id), ['mine']);
  assert.ok(visible(s2, dad.id, 'spouse'));
});

// The fixture marries my brother to my wife's sister (f_yb), which links the two families.
// `apart` is the same tree without that marriage, so each side is separate.
const apart: Tree = { ...tree, families: tree.families.filter(f => f.id !== 'f_yb') };

test('sides: married me', () => {
  assert.equal(sides(apart, 'me').married, true);
  for (const id of ['me', 'wife', 'son', 'daughter', 'sonWife', 'grandson', 'greatGrandson', 'dauHusband', 'dauSon'])
    assert.deepEqual(labels(apart, 'me', id), ['shared'], id);
  for (const id of ['dad', 'mum', 'elderSis', 'youngerBro', 'yeye', 'cousinA', 'guzheung', 'mumYoungerSis', 'esHusband', 'dadCousin'])
    assert.deepEqual(labels(apart, 'me', id), ['mine'], id);
  for (const id of ['wifeDad', 'wifeMum', 'wifeElderBro', 'wifeYoungerSis', 'webWife', 'wifeGrandma'])
    assert.deepEqual(labels(apart, 'me', id), ['spouse'], id);
  assert.deepEqual(labels(apart, 'me', 'stranger'), []);
});

test('sides: families joined by a marriage are on both sides', () => {
  // my brother married my wife's sister: everyone reached from both parents' families is both
  for (const id of ['youngerBro', 'wifeYoungerSis', 'dad', 'wifeDad'])
    assert.deepEqual(labels(tree, 'me', id), ['mine', 'spouse'], id);
  for (const id of ['me', 'wife', 'son', 'grandson'])
    assert.deepEqual(labels(tree, 'me', id), ['shared'], id);
});

test('sides: the toggle only hides the other side', () => {
  const s = sides(apart, 'me');
  assert.ok(visible(s, 'dad', 'mine'));
  assert.ok(!visible(s, 'dad', 'spouse'));
  assert.ok(visible(s, 'wifeDad', 'spouse'));
  assert.ok(!visible(s, 'wifeDad', 'mine'));
  assert.ok(visible(s, 'grandson', 'mine') && visible(s, 'grandson', 'spouse'));
  assert.ok(!visible(s, 'stranger', 'mine'));
  const j = sides(tree, 'me');
  assert.ok(visible(j, 'wifeYoungerSis', 'mine') && visible(j, 'wifeYoungerSis', 'spouse'));
});

test('sides: switching to a married child makes the upper tree one side', () => {
  assert.equal(sides(apart, 'son').married, true);
  for (const id of ['me', 'wife', 'daughter', 'elderSis', 'dad', 'wifeDad', 'wifeElderBro', 'yeye'])
    assert.deepEqual(labels(apart, 'son', id), ['mine'], id);
  for (const id of ['son', 'sonWife', 'grandson', 'greatGrandson'])
    assert.deepEqual(labels(apart, 'son', id), ['shared'], id);
  assert.deepEqual(labels(apart, 'son', 'dauHusband'), ['mine']); // sister's husband, reached from the parents
});

test('sides: married with unknown parents and a relative marriage', () => {
  // me and spouse are cousins: spouse's mother is my mother's sister
  let { tree: t, id: me } = addPerson(emptyTree(), 'm');
  const mum = addParent(t, me, 'f'); t = mum.tree;
  const aunt = addSibling(t, mum.id, 'f'); t = aunt.tree;
  const cousin = addChild(t, aunt.id, 'f'); t = cousin.tree;
  const m = addSpouse(t, me, 'f'); // new person, then add the cousin as my spouse instead:
  t = structuredClone(m.tree);
  t.families = t.families.filter(f => !f.parents.includes(me));
  t.people = t.people.filter(p => p.id !== m.id);
  t.families.push({ id: 'fx', parents: [me, cousin.id], children: [] });
  validateTree(t);
  const s = sides(t, me);
  assert.equal(s.married, true);
  assert.deepEqual(s.labels.get(aunt.id)!.slice().sort(), ['mine', 'spouse']);
  assert.deepEqual(s.labels.get(mum.id)!.slice().sort(), ['mine', 'spouse']);
  assert.deepEqual(s.labels.get(cousin.id), ['shared']);
});

// A small family: my dad's sister married a man whose own mother and brother are in the tree;
// my sister married a man whose parents are in the tree; my wife's parents are in the tree.
function oneHop() {
  let t = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm'));
  add('dad', addParent(t, id.me, 'm'));
  add('aunt', addSibling(t, id.dad, 'f'));
  add('auntH', addSpouse(t, id.aunt, 'm'));
  add('cousin', addChild(t, id.aunt, 'f'));
  add('auntHMum', addParent(t, id.auntH, 'f'));
  add('auntHBro', addSibling(t, id.auntH, 'm'));
  add('sis', addSibling(t, id.me, 'f'));
  add('sisH', addSpouse(t, id.sis, 'm'));
  add('sisHDad', addParent(t, id.sisH, 'm'));
  add('wife', addSpouse(t, id.me, 'f'));
  add('wifeMum', addParent(t, id.wife, 'f'));
  add('wifeSis', addSibling(t, id.wife, 'f'));
  add('son', addChild(t, id.me, 'm'));
  return { t, id };
}

test('one hop: a relative\'s spouse shows, the spouse\'s own family does not', () => {
  const { t, id } = oneHop();
  const shown = (me: string, view: View) => { const s = sides(t, id[me]); return Object.keys(id).filter(k => visible(s, id[k], view)).sort(); };
  assert.deepEqual(shown('me', 'mine'), ['aunt', 'auntH', 'cousin', 'dad', 'me', 'sis', 'sisH', 'son', 'wife']);
  assert.deepEqual(shown('me', 'spouse'), ['me', 'son', 'wife', 'wifeMum', 'wifeSis']);
  // Unmarried cousin: my wife shows as my spouse, her family does not; the cousin's own father's family does.
  assert.equal(sides(t, id.cousin).married, false);
  assert.deepEqual(shown('cousin', 'mine'), ['aunt', 'auntH', 'auntHBro', 'auntHMum', 'cousin', 'dad', 'me', 'sis', 'sisH', 'son', 'wife']);
  // Switching to the aunt's husband: his own family is his side, and the aunt's family is the spouse's side.
  assert.deepEqual(shown('auntH', 'mine'), ['aunt', 'auntH', 'auntHBro', 'auntHMum', 'cousin']);
  assert.deepEqual(shown('auntH', 'spouse'), ['aunt', 'auntH', 'cousin', 'dad', 'me', 'sis', 'sisH', 'son', 'wife']);
  // My son: both parents' families are blood, and their spouses show.
  assert.deepEqual(shown('son', 'mine'), ['aunt', 'auntH', 'cousin', 'dad', 'me', 'sis', 'sisH', 'son', 'wife', 'wifeMum', 'wifeSis']);
});

test('the first person is the root; rename and remove keep it consistent', () => {
  const a = addPerson(emptyTree(), 'm', 'Aaron');
  assert.equal(a.tree.root, a.id);
  const b = addParent(a.tree, a.id, 'm');
  assert.equal(b.tree.root, a.id, 'later people do not take over the root');
  const renamed = renamePerson(b.tree, b.id, '  Dad ');
  assert.equal(renamed.people.find(p => p.id === b.id)!.name, 'Dad');
  assert.equal(renamePerson(renamed, b.id, '').people.find(p => p.id === b.id)!.name, undefined);
  assert.equal(removePerson(b.tree, a.id).root, undefined);
  assert.throws(() => validateTree({ ...b.tree, root: 'nobody' }));
});

test('setBirthOrder sets the whole sibling order and leaves the input alone', () => {
  let { tree: t, id: a } = addPerson(emptyTree(), 'm', 'A');
  const b = addSibling(t, a, 'f', 'B'); t = b.tree;
  const c = addSibling(t, a, 'm', 'C'); t = c.tree;
  const order = (x: Tree) => x.families.find(f => f.children.includes(a))!.children;
  assert.deepEqual(order(t), [a, b.id, c.id]);
  const before = structuredClone(t);
  // Any member of the group names the group, and everyone can move at once.
  assert.deepEqual(order(setBirthOrder(t, c.id, [c.id, a, b.id])), [c.id, a, b.id]);
  assert.deepEqual(order(setBirthOrder(t, a, [b.id, c.id, a])), [b.id, c.id, a]);
  assert.equal(setBirthOrder(t, b.id, [a, b.id, c.id]), t);
  assert.deepEqual(t, before);
});

test('setBirthOrder rejects a list that is not exactly the sibling group; an only child is a group of one', () => {
  let { tree: t, id: a } = addPerson(emptyTree(), 'm', 'A');
  assert.equal(setBirthOrder(t, a, [a]), t);
  assert.throws(() => setBirthOrder(t, a, []));
  assert.throws(() => setBirthOrder(t, a, [a, a]));
  const b = addSibling(t, a, 'f'); t = b.tree;
  assert.throws(() => setBirthOrder(t, a, [a]));
  assert.throws(() => setBirthOrder(t, a, [a, 'nobody']));
  assert.throws(() => setBirthOrder(t, 'nobody', [a, b.id]));
});

test('pets: add, rename, remove, and they leave with their owner', () => {
  let { tree: t, id: me } = addPerson(emptyTree(), 'm', 'A');
  const sis = addSibling(t, me, 'f'); t = sis.tree;
  const dog = addPet(t, me, 'dog', ' Rex '); t = dog.tree;
  const cat = addPet(t, sis.id, 'cat'); t = cat.tree;
  assert.deepEqual(t.pets, [{ id: 'a1', kind: 'dog', owner: me, name: 'Rex' }, { id: 'a2', kind: 'cat', owner: sis.id }]);
  assert.equal(renamePet(t, 'a2', 'Mo').pets![1].name, 'Mo');
  assert.equal(renamePet(t, 'a1', '').pets![0].name, undefined);
  assert.deepEqual(removePet(t, 'a1').pets!.map(a => a.id), ['a2']);
  assert.equal(removePet(removePet(t, 'a1'), 'a2').pets, undefined);
  assert.deepEqual(removePerson(t, sis.id).pets!.map(a => a.id), ['a1']);
  assert.throws(() => addPet(t, 'nobody', 'cat'));
  assert.throws(() => validateTree({ ...t, pets: [{ id: 'a9', kind: 'cow' as 'cat', owner: me }] }));
  assert.throws(() => validateTree({ ...t, pets: [{ id: me, kind: 'cat', owner: me }] }));
  // The engine never sees pets: titles are the same with or without them.
  assert.deepEqual(sides(t, me), sides(removePet(removePet(t, 'a1'), 'a2'), me));
});
