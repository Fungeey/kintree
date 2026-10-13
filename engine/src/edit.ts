// Tree editing (slice 1). Every function returns a new tree and leaves the input alone.
// New people and families get ids p1, p2, ... and f1, f2, ...; the result is validated.
import type { Family, Sex, Tree } from './model.ts';
import { validateTree } from './tree.ts';

export interface Edited { tree: Tree; id: string }

function nextId(prefix: string, used: string[]): string {
  let n = 1;
  for (const id of used) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (m) n = Math.max(n, Number(m[1]) + 1);
  }
  return prefix + n;
}

function mustHave(t: Tree, id: string): void {
  if (!t.people.some(p => p.id === id)) throw new Error(`unknown person id: ${id}`);
}

const birthOf = (t: Tree, id: string): Family | undefined => t.families.find(f => f.children.includes(id));
const ownOf = (t: Tree, id: string): Family | undefined => t.families.find(f => f.parents.includes(id));

function newPerson(t: Tree, sex: Sex, name?: string): string {
  const id = nextId('p', t.people.map(p => p.id));
  t.people.push(name ? { id, sex, name } : { id, sex });
  return id;
}

function newFamily(t: Tree, parents: string[], children: string[]): Family {
  const f: Family = { id: nextId('f', t.families.map(x => x.id)), parents, children };
  t.families.push(f);
  return f;
}

function insertAt(list: string[], slot: number | undefined, id: string): void {
  const at = slot ?? list.length;
  if (!Number.isInteger(at) || at < 0 || at > list.length) throw new Error(`bad slot: ${slot}`);
  list.splice(at, 0, id);
}

function finish(t: Tree, id: string): Edited {
  validateTree(t);
  return { tree: t, id };
}

// An empty tree has no families and no people. Start it with addPerson ("me", decision 17).
export function emptyTree(): Tree { return { version: 1, people: [], families: [] }; }

// A person with no relatives yet.
// The first person added to an empty tree is its root (the creator).
export function addPerson(tree: Tree, sex: Sex, name?: string): Edited {
  const t = structuredClone(tree);
  const id = newPerson(t, sex, name);
  if (t.root === undefined && t.people.length === 1) t.root = id;
  return finish(t, id);
}

// Sets (or, with an empty name, clears) a person's name.
export function renamePerson(tree: Tree, id: string, name: string): Tree {
  mustHave(tree, id);
  const t = structuredClone(tree);
  const p = t.people.find(x => x.id === id)!;
  const n = name.trim();
  if (n) p.name = n; else delete p.name;
  return t;
}

// Sets the birth order of `id`'s sibling group (everyone in their birth family, eldest first). `order` must list
// exactly those people. A person with no birth family is a group of one.
export function setBirthOrder(tree: Tree, id: string, order: string[]): Tree {
  mustHave(tree, id);
  const t = structuredClone(tree);
  const fam = birthOf(t, id);
  const group = fam ? fam.children : [id];
  const same = order.length === group.length && new Set(order).size === order.length && order.every(x => group.includes(x));
  if (!same) throw new Error(`order must list exactly ${group.join(', ')}`);
  if (!fam || order.every((x, i) => x === fam.children[i])) return tree;
  fam.children = [...order];
  validateTree(t);
  return t;
}

// Adds a parent of `child`. If the child has no birth family one is created. If the birth
// family exists with unknown parents or one parent, the parent is filled in (decision 19).
export function addParent(tree: Tree, child: string, sex: Sex, name?: string): Edited {
  mustHave(tree, child);
  const t = structuredClone(tree);
  const fam = birthOf(t, child);
  if (fam && fam.parents.length >= 2) throw new Error(`${child} already has two parents`);
  const id = newPerson(t, sex, name);
  if (fam) fam.parents.push(id);
  else newFamily(t, [id], [child]);
  return finish(t, id);
}

// Adds a child of `parent` into the parent's own family (created if needed).
// `slot` is the position in birth order (0 = eldest); default is youngest.
export function addChild(tree: Tree, parent: string, sex: Sex, name?: string, slot?: number): Edited {
  mustHave(tree, parent);
  const t = structuredClone(tree);
  const id = newPerson(t, sex, name);
  const fam = ownOf(t, parent) ?? newFamily(t, [parent], []);
  insertAt(fam.children, slot, id);
  return finish(t, id);
}

// Adds the other parent of `person`'s own family (created if needed).
export function addSpouse(tree: Tree, person: string, sex: Sex, name?: string): Edited {
  mustHave(tree, person);
  const t = structuredClone(tree);
  const fam = ownOf(t, person);
  if (fam && fam.parents.length >= 2) throw new Error(`${person} already has a spouse`);
  const id = newPerson(t, sex, name);
  if (fam) fam.parents.push(id);
  else newFamily(t, [person, id], []);
  return finish(t, id);
}

// Adds a sibling of `person`. `slot` is where the new sibling goes in the final birth order
// (0 = eldest, children.length = youngest, the default). If `person` has no birth family, a
// family with unknown parents is created (decision 19).
export function addSibling(tree: Tree, person: string, sex: Sex, name?: string, slot?: number): Edited {
  mustHave(tree, person);
  const t = structuredClone(tree);
  const id = newPerson(t, sex, name);
  const fam = birthOf(t, person) ?? newFamily(t, [], [person]);
  insertAt(fam.children, slot, id);
  return finish(t, id);
}

// Removes a person from the tree and from their families. A family left with no parents and
// fewer than two children, or with one parent and no children, is dropped. Removing someone
// can leave relatives disconnected; the caller decides what to do with them.
export function removePerson(tree: Tree, id: string): Tree {
  mustHave(tree, id);
  const t = structuredClone(tree);
  t.people = t.people.filter(p => p.id !== id);
  if (t.root === id) delete t.root;
  for (const f of t.families) {
    f.parents = f.parents.filter(x => x !== id);
    f.children = f.children.filter(x => x !== id);
  }
  t.families = t.families.filter(f => {
    if (f.parents.length === 0) return f.children.length >= 2;
    if (f.parents.length === 1) return f.children.length >= 1;
    return true;
  });
  validateTree(t);
  return t;
}
