// Relatives of a shown person that the view leaves out: everyone you would reach from their card
// by going through people who are not drawn. A card with a count is a way in: switch to them to
// see that family.
import type { Tree } from '../../engine/src/index.ts';

export function hiddenRelatives(tree: Tree, id: string, show: (id: string) => boolean): number {
  const linked = (x: string) => tree.families
    .filter(f => f.parents.includes(x) || f.children.includes(x))
    .flatMap(f => [...f.parents, ...f.children])
    .filter(p => p !== x);
  const seen = new Set<string>([id]);
  const queue = linked(id).filter(p => !show(p));
  for (const p of queue) seen.add(p);
  for (let i = 0; i < queue.length; i++) {
    for (const n of linked(queue[i])) {
      if (seen.has(n) || show(n)) continue; // drawn people are not counted, and not passed through
      seen.add(n);
      queue.push(n);
    }
  }
  return seen.size - 1;
}
