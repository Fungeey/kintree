// Edit mode: renaming someone already on the tree.
import { renamePerson } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';

export const MAX_NAME = 40;

// Trimmed, inner runs of whitespace collapsed, capped at MAX_NAME characters (not UTF-16 units).
export function cleanName(name: string): string {
  return [...name.trim().replace(/\s+/g, ' ')].slice(0, MAX_NAME).join('').trim();
}

// The root's name labels everyone's card ("Mei's father"), so it can be changed but not cleared.
export const nameRequired = (tree: Tree, id: string): boolean => tree.root === id;

// The tree with `id` renamed; an empty name clears it. Returns the same tree when nothing changes,
// and null when the name is required but empty.
export function applyRename(tree: Tree, id: string, name: string): Tree | null {
  const n = cleanName(name);
  if (!n && nameRequired(tree, id)) return null;
  const p = tree.people.find(x => x.id === id);
  if (p && (p.name ?? '') === n) return tree;
  return renamePerson(tree, id, n);
}
