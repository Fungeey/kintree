// Add-person flow logic (slice 4b). Pure functions over the engine's edit functions; no UI.
import { addPerson, addParent, addChild, addSpouse, addSibling, emptyTree, setBirthOrder } from '../../../engine/src/index.ts';
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

// `order`, when given, is the whole sibling group after the add, eldest first, with null standing for the new person.
export interface AddRequest { from: string; relation: Relation; sex: Sex; name?: string; slot?: number; order?: (string | null)[] }

export function applyAdd(tree: Tree, r: AddRequest): Edited {
  const name = r.name?.trim() || undefined;
  const slot = r.order ? r.order.indexOf(null) : r.slot;
  let added: Edited;
  switch (r.relation) {
    case 'parent': return addParent(tree, r.from, r.sex, name);
    case 'spouse': return addSpouse(tree, r.from, r.sex, name);
    case 'child': added = addChild(tree, r.from, r.sex, name, slot); break;
    case 'sibling': added = addSibling(tree, r.from, r.sex, name, slot); break;
  }
  if (!r.order) return added;
  // The rest of the group may have been moved too.
  return { tree: setBirthOrder(added.tree, added.id, r.order.map(k => k ?? added.id)), id: added.id };
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
