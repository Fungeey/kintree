// The married view (decisions 15 and 16). Sides are computed from "me", never stored.
import type { Family, Tree } from './model.ts';
import { validateTree } from './tree.ts';

export type Side = 'shared' | 'mine' | 'spouse';
export type View = 'mine' | 'spouse';

export interface Sides {
  married: boolean;                // the side toggle appears only when true
  labels: Map<string, Side[]>;     // people reached from me; anyone missing is not in the connected tree
}

export function sides(tree: Tree, me: string): Sides {
  validateTree(tree);
  if (!tree.people.some(p => p.id === me)) throw new Error(`unknown person id: ${me}`);

  const own = new Map<string, Family>();
  const birth = new Map<string, Family>();
  const members = new Map<string, Set<string>>(); // person -> everyone sharing a family with them
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!members.has(a)) members.set(a, new Set());
    members.get(a)!.add(b);
  };
  for (const f of tree.families) {
    const all = [...f.parents, ...f.children];
    for (const a of all) for (const b of all) link(a, b);
    for (const p of f.parents) own.set(p, f);
    for (const c of f.children) birth.set(c, f);
  }

  const labels = new Map<string, Side[]>();
  const add = (id: string, s: Side) => {
    const cur = labels.get(id) ?? [];
    if (!cur.includes(s)) cur.push(s);
    labels.set(id, cur);
  };

  const spouse = (own.get(me)?.parents ?? []).find(p => p !== me);
  if (spouse === undefined) {
    // Unmarried: one side, everyone connected to me, no toggle.
    for (const id of reach([me], new Set(), members)) add(id, 'mine');
    return { married: false, labels };
  }

  // Shared: me, the spouse, their descendants and those descendants' spouses.
  const shared = new Set<string>([me, spouse]);
  const queue = [me];
  while (queue.length) {
    const person = queue.pop()!;
    for (const c of own.get(person)?.children ?? []) {
      if (shared.has(c)) continue;
      shared.add(c);
      queue.push(c);
    }
  }
  for (const d of [...shared]) for (const p of own.get(d)?.parents ?? []) shared.add(p);
  for (const id of shared) add(id, 'shared');

  // Each side: everyone reached from that person's birth family without passing through
  // that person. Both partners are blocked, so children never become part of a side by
  // way of a marriage between relatives.
  const side = (start: string, other: string, s: Side) => {
    const bf = birth.get(start);
    const seeds = bf ? [...bf.parents, ...bf.children].filter(x => x !== start) : [];
    for (const id of reach(seeds, new Set([start, other]), members)) add(id, s);
  };
  side(me, spouse, 'mine');
  side(spouse, me, 'spouse');

  return { married: true, labels };
}

// Breadth-first search over shared-family links. `blocked` people are not entered.
function reach(seeds: string[], blocked: Set<string>, members: Map<string, Set<string>>): Set<string> {
  const seen = new Set<string>();
  const queue = seeds.filter(s => !blocked.has(s));
  for (const s of queue) seen.add(s);
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of members.get(cur) ?? []) {
      if (seen.has(n) || blocked.has(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

// Display filter: under a side toggle, hide the other side's people. Shared people always show.
export function visible(s: Sides, id: string, view: View): boolean {
  const l = s.labels.get(id);
  if (!l) return false;
  if (!s.married) return true;
  return l.includes('shared') || l.includes(view);
}
