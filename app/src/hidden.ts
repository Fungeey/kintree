// Relatives of a shown person that the view leaves out: their parents, brothers and sisters and
// children who are not drawn. A card with a count is a way in: switch to them to see that family.
import type { Tree } from '../../engine/src/index.ts';

export function hiddenRelatives(tree: Tree, id: string, show: (id: string) => boolean): number {
  const hidden = new Set<string>();
  for (const f of tree.families) {
    const mine = f.children.includes(id) ? [...f.parents, ...f.children] : f.parents.includes(id) ? f.children : [];
    for (const p of mine) if (p !== id && !show(p)) hidden.add(p);
  }
  return hidden.size;
}
