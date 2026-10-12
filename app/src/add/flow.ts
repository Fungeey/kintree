// Add-person flow logic (slice 4b). Pure functions over the engine's edit functions; no UI.
import { addPerson, addParent, addChild, addSpouse, addSibling, emptyTree } from '../../../engine/src/index.ts';
import type { Edited, Person, Sex, Tree } from '../../../engine/src/index.ts';

export type Relation = 'parent' | 'child' | 'spouse' | 'sibling';

export const RELATIONS: Relation[] = ['parent', 'child', 'spouse', 'sibling'];

const birthOf = (t: Tree, id: string) => t.families.find(f => f.children.includes(id));
const ownOf = (t: Tree, id: string) => t.families.find(f => f.parents.includes(id));

// Which relations can still be added to this person (a person has at most two parents and one spouse).
export function availableRelations(tree: Tree, personId: string): Relation[] {
  return RELATIONS.filter(r => {
    if (r === 'parent') return (birthOf(tree, personId)?.parents.length ?? 0) < 2;
    if (r === 'spouse') return (ownOf(tree, personId)?.parents.length ?? 0) < 2;
    return true;
  });
}

// The sibling group the new person joins, in birth order, when a slot must be chosen.
// Returns null when no question is needed (parent, spouse, or the first child of a person).
// `slots` run 0..members.length: slot i means "becomes the i-th in birth order" (0 = eldest).
export function slotQuestion(tree: Tree, personId: string, relation: Relation): { members: Person[] } | null {
  let ids: string[];
  if (relation === 'sibling') ids = birthOf(tree, personId)?.children ?? [personId];
  else if (relation === 'child') ids = ownOf(tree, personId)?.children ?? [];
  else return null;
  if (ids.length === 0) return null;
  return { members: ids.map(id => tree.people.find(p => p.id === id)!) };
}

// Wording for each slot: "older than X" at the ends, "between X and Y" in the middle.
export function slotLabels(members: Person[], label: (p: Person) => string): string[] {
  const n = members.length;
  return Array.from({ length: n + 1 }, (_, i) => {
    if (n === 1) return i === 0 ? `older than ${label(members[0])}` : `younger than ${label(members[0])}`;
    if (i === 0) return `eldest, before ${label(members[0])}`;
    if (i === n) return `youngest, after ${label(members[n - 1])}`;
    return `between ${label(members[i - 1])} and ${label(members[i])}`;
  });
}

export interface AddRequest { from: string; relation: Relation; sex: Sex; name?: string; slot?: number }

export function applyAdd(tree: Tree, r: AddRequest): Edited {
  const name = r.name?.trim() || undefined;
  switch (r.relation) {
    case 'parent': return addParent(tree, r.from, r.sex, name);
    case 'spouse': return addSpouse(tree, r.from, r.sex, name);
    case 'child': return addChild(tree, r.from, r.sex, name, r.slot);
    case 'sibling': return addSibling(tree, r.from, r.sex, name, r.slot);
  }
}

// Start of the flow on an empty tree (decision 17): the first person is "me".
// The first person is the tree's root and must have a name: cards read "<name>'s father".
export function startTree(sex: Sex, name: string): Edited {
  const n = name.trim();
  if (!n) throw new Error('the first person needs a name');
  return addPerson(emptyTree(), sex, n);
}

// Suggested sex for the new person: the opposite of the existing spouse/parent, otherwise none.
export function suggestSex(tree: Tree, personId: string, relation: Relation): Sex | null {
  const other = relation === 'spouse' ? personId : relation === 'parent' ? birthOf(tree, personId)?.parents[0] : undefined;
  const p = other && tree.people.find(x => x.id === other);
  return p ? (p.sex === 'm' ? 'f' : 'm') : null;
}
