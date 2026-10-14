// Tree validation and the four moves from a person (spec section 1 and 2).
import { PET_KINDS } from './model.ts';
import type { Family, Person, Tree } from './model.ts';
import type { Token } from './tokens.ts';

export function validateTree(tree: Tree): void {
  const people = new Set<string>();
  for (const p of tree.people) {
    if (people.has(p.id)) throw new Error(`duplicate person id: ${p.id}`);
    if (p.sex !== 'm' && p.sex !== 'f') throw new Error(`bad sex for ${p.id}`);
    people.add(p.id);
  }

  if (tree.root !== undefined && !people.has(tree.root)) throw new Error(`unknown root person id: ${tree.root}`);

  const familyIds = new Set<string>();
  const isChild = new Set<string>();   // each person is a child in at most one family
  const isParent = new Set<string>();  // each person is a parent in at most one family
  for (const f of tree.families) {
    if (familyIds.has(f.id)) throw new Error(`duplicate family id: ${f.id}`);
    familyIds.add(f.id);
    if (f.parents.length > 2) throw new Error(`family ${f.id} has more than 2 parents`);
    for (const id of [...f.parents, ...f.children]) {
      if (!people.has(id)) throw new Error(`unknown person id in family ${f.id}: ${id}`);
    }
    if (new Set(f.parents).size !== f.parents.length) throw new Error(`family ${f.id} lists a parent twice`);
    if (new Set(f.children).size !== f.children.length) throw new Error(`family ${f.id} lists a child twice`);
    for (const id of f.parents) {
      if (f.children.includes(id)) throw new Error(`${id} is both parent and child in family ${f.id}`);
      if (isParent.has(id)) throw new Error(`${id} is a parent in two families`);
      isParent.add(id);
    }
    for (const id of f.children) {
      if (isChild.has(id)) throw new Error(`${id} is a child in two families`);
      isChild.add(id);
    }
  }

  const pets = new Set<string>();
  for (const a of tree.pets ?? []) {
    if (pets.has(a.id) || people.has(a.id)) throw new Error(`duplicate pet id: ${a.id}`);
    if (!PET_KINDS.includes(a.kind)) throw new Error(`bad kind for pet ${a.id}`);
    if (!people.has(a.owner)) throw new Error(`unknown owner of pet ${a.id}: ${a.owner}`);
    pets.add(a.id);
  }
}

export interface Index {
  people: Map<string, Person>;
  birth: Map<string, Family>; // the family a person is a child in (birth family)
  own: Map<string, Family>;   // the family a person is a parent in (own family)
}

// Validates the tree, then builds lookups. Validation runs first, so each person
// has at most one birth family and one own family below.
export function buildIndex(tree: Tree): Index {
  validateTree(tree);
  const index: Index = { people: new Map(), birth: new Map(), own: new Map() };
  for (const p of tree.people) index.people.set(p.id, p);
  for (const f of tree.families) {
    for (const c of f.children) index.birth.set(c, f);
    for (const p of f.parents) index.own.set(p, f);
  }
  return index;
}

export interface Move { to: string; token: Token }

// Every one-step move from a person (spec section 2). There is no
// "parent's child" move: a sibling is always one token.
export function movesFrom(index: Index, id: string): Move[] {
  const people = index.people;
  const moves: Move[] = [];
  const birth = index.birth.get(id);
  if (birth) {
    // Up: a parent in the birth family.
    for (const pid of birth.parents) {
      const male = people.get(pid)!.sex === 'm';
      moves.push({ to: pid, token: { letter: male ? 'F' : 'M', age: null } });
    }
    // Across: another child of the birth family. Age 'e' if that child comes
    // earlier in birth order than me, otherwise 'y'.
    const myPos = birth.children.indexOf(id);
    birth.children.forEach((cid, pos) => {
      if (cid === id) return;
      const male = people.get(cid)!.sex === 'm';
      moves.push({ to: cid, token: { letter: male ? 'B' : 'Z', age: pos < myPos ? 'e' : 'y' } });
    });
  }
  const own = index.own.get(id);
  if (own) {
    // Down: a child in my own family.
    for (const cid of own.children) {
      const male = people.get(cid)!.sex === 'm';
      moves.push({ to: cid, token: { letter: male ? 'S' : 'D', age: null } });
    }
    // Across by marriage: the other parent in my own family.
    for (const sid of own.parents) {
      if (sid === id) continue;
      const male = people.get(sid)!.sex === 'm';
      moves.push({ to: sid, token: { letter: male ? 'H' : 'W', age: null } });
    }
  }
  return moves;
}
