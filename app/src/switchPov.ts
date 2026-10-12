// Switching "me" (point of view) asks first: "New family tree as {who}?".
import type { Tree } from '../../engine/src/index.ts';
import { rootLabel, showFor } from './display.ts';

// Who the confirmation names: their name, else their relation to the tree's root ("your father"),
// else their relation to the current "me" (whose cards read as "your ..."). Null when there is nothing to switch to.
export function switchTarget(tree: Tree, me: string | null, target: string): string | null {
  if (target === me) return null;
  const p = tree.people.find(x => x.id === target);
  if (!p) return null;
  const name = p.name?.trim();
  if (name) return name;
  const label = rootLabel(tree, target);
  if (label) return label.replace(/^Your /, 'your ');
  const gloss = me ? showFor(tree, me, target).gloss : undefined;
  if (gloss && gloss !== 'me') return `your ${gloss}`;
  return p.sex === 'm' ? 'this man' : 'this woman';
}
