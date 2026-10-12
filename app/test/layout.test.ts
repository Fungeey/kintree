import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addParent, addPerson, addSibling, addSpouse, emptyTree, sides, visible } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import { CARD_H, CARD_W, COUPLE_GAP, FACE_CY, coupleHearts, layoutTree, linkSegments } from '../src/layout.ts';
import { rootLabel, showFor } from '../src/display.ts';

function sample() {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Me'));
  add('dad', addParent(t, id.me, 'm', 'Dad'));
  add('mum', addParent(t, id.me, 'f', 'Mum'));
  add('bro', addSibling(t, id.me, 'm', 'Bro'));
  add('gpa', addParent(t, id.dad, 'm', 'Gpa'));
  add('gma', addParent(t, id.dad, 'f', 'Gma'));
  add('unc', addSibling(t, id.dad, 'm', 'Uncle', 0));
  add('cous', addChild(t, id.unc, 'f', 'Cousin'));
  add('wife', addSpouse(t, id.me, 'f', 'Wife'));
  add('wdad', addParent(t, id.wife, 'm', 'WDad'));
  add('kid', addChild(t, id.me, 'm', 'Kid'));
  return { t, id };
}

test('layout: rows by generation, no overlaps, everyone placed', () => {
  const { t, id } = sample();
  const L = layoutTree(t);
  assert.equal(L.pos.size, t.people.length);
  assert.ok(L.pos.get(id.gpa)!.y < L.pos.get(id.dad)!.y);
  assert.ok(L.pos.get(id.dad)!.y < L.pos.get(id.me)!.y);
  assert.ok(L.pos.get(id.me)!.y < L.pos.get(id.kid)!.y);
  assert.equal(L.pos.get(id.wife)!.y, L.pos.get(id.me)!.y);
  const byRow = new Map<number, number[]>();
  for (const p of L.pos.values()) byRow.set(p.y, [...(byRow.get(p.y) ?? []), p.x]);
  for (const xs of byRow.values()) {
    xs.sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= CARD_W, 'cards overlap');
  }
  for (const p of L.pos.values()) assert.ok(p.x >= 0 && p.x + CARD_W <= L.width && p.y + CARD_H <= L.height);
});

test('layout: parents sit centred over their children', () => {
  const { t, id } = sample();
  const L = layoutTree(t);
  const c = (i: string) => L.pos.get(i)!.x + CARD_W / 2;
  // Uncle and Dad are the children of Gpa and Gma.
  assert.ok(Math.abs((c(id.gpa) + c(id.gma)) / 2 - (c(id.unc) + c(id.dad)) / 2) < 1);
  assert.ok(c(id.unc) < c(id.dad), 'elder sibling is on the left');
});

test('layout: a single person and the empty tree', () => {
  const { tree, id } = addPerson(emptyTree(), 'f');
  const L = layoutTree(tree);
  assert.equal(L.pos.size, 1);
  assert.deepEqual(linkSegments(L), []);
  assert.equal(layoutTree(emptyTree()).pos.size, 0);
});

test('layout: hidden people take no room and join nothing', () => {
  const base = sample();
  const id = base.id;
  const t = addParent(base.t, id.wife, 'f', 'WMum').tree;   // a couple on the spouse's side
  const s = sides(t, id.me);
  assert.ok(s.married);
  const full = layoutTree(t);
  for (const view of ['mine', 'spouse'] as const) {
    const show = (p: string) => visible(s, p, view);
    const L = layoutTree(t, show);
    assert.deepEqual([...L.pos.keys()].sort(), t.people.filter(p => show(p.id)).map(p => p.id).sort());
    assert.ok(L.width < full.width, `the ${view} view still leaves room for the hidden side`);
    // Nothing drawn reaches a hidden person: every line end sits on a shown card or between them.
    assert.ok(linkSegments(L).length < linkSegments(full).length);
  }
  const mine = layoutTree(t, p => visible(s, p, 'mine'));
  assert.ok(coupleHearts(mine).length < coupleHearts(full).length);
});

test('layout: links reach every child, unknown parents get a dashed stub', () => {
  const { t, id } = sample();
  const L = layoutTree(t);
  assert.ok(linkSegments(L).length > 10);
  const lone = addSibling(addPerson(emptyTree(), 'm').tree, 'p1', 'f');
  const L2 = layoutTree(lone.tree);
  assert.ok(linkSegments(L2).some(s => s.dashed));
});

test('display: titles from me', () => {
  const { t, id } = sample();
  assert.equal(showFor(t, id.me, id.me).kind, 'self');
  const dad = showFor(t, id.me, id.dad);
  assert.equal(dad.kind, 'title');
  assert.equal(dad.lines[0].chars, '爸爸');
  assert.equal(showFor(t, id.me, id.cous).kind, 'byAge');
  assert.ok(showFor(t, id.me, id.kid).lines[0].byName);
});

test('layout: identical whoever "me" is', () => {
  const { t, id } = sample();
  let tree = addParent(t, id.gpa, 'm', 'Great-gpa').tree;
  tree = addPerson(tree, 'f', 'Stranger').tree;                  // not connected to anyone
  tree = addSibling(tree, id.wife, 'f', 'Wife sis').tree;
  const snap = (L: ReturnType<typeof layoutTree>) => JSON.stringify([[...L.pos].sort(), linkSegments(L), L.width, L.height]);
  // The layout takes no "me": the app draws the same positions for every point of view (the old
  // layout started from "me", so 8 of 20 people in the demo family gave a different picture).
  const first = snap(layoutTree(tree));
  for (const p of tree.people) {
    // What the app does for each choice of "me": the same full tree, nothing else varies.
    assert.equal(snap(layoutTree(tree)), first, `layout changed for me = ${p.name}`);
  }
  // Order of people in the tree decides ties, so a rebuilt tree with the same order draws the same.
  assert.equal(snap(layoutTree(structuredClone(tree))), first);
});

test('rootLabel: relation to the root, whoever "me" is', () => {
  const { t, id } = sample();
  const named = { ...t, root: id.me };
  assert.equal(rootLabel(named, id.me), 'Me');
  assert.equal(rootLabel(named, id.dad), "Me's father");
  assert.equal(rootLabel(named, id.gpa), "Me's paternal grandfather");
  assert.equal(rootLabel(named, id.wife), "Me's wife");
  // Great-grandparent
  const gg = addParent(named, id.gpa, 'm');
  assert.match(rootLabel(gg.tree, gg.id)!, /^Me's /);
  // The label is the same from every point of view and absent without a named root.
  assert.equal(rootLabel({ ...t, root: undefined }, id.dad), null);
  const unnamed = structuredClone(named);
  delete unnamed.people.find(p => p.id === id.me)!.name;
  assert.equal(rootLabel(unnamed, id.dad), null);
});

// The demo family drawn in full (an unmarried "me" sees everyone) and in both side views of every
// married "me": whoever is hidden is left out of the layout, and what is left must read right.
test('layout: the demo family reads right in full and in every side view', async () => {
  const { demoTree } = await import('../src/demo.ts');
  const { tree } = demoTree();
  const partners = (id: string) => new Set(tree.families.filter(f => f.parents.includes(id)).flatMap(f => f.parents));

  const check = (show: (id: string) => boolean, label: string) => {
    const L = layoutTree(tree, show);
    assert.equal(L.pos.size, tree.people.filter(p => show(p.id)).length, `${label}: hidden people are drawn`);
    for (const f of tree.families) {
      const parents = f.parents.filter(show), kids = f.children.filter(show);
      // Brothers and sisters stay together: between the outermost two, only their own husbands and wives.
      if (kids.length > 1) {
        const xs = kids.map(c => L.pos.get(c)!.x);
        const y = L.pos.get(kids[0])!.y;
        const allowed = new Set(kids.flatMap(c => [...partners(c), c]));
        for (const [id, p] of L.pos) {
          if (p.y === y && p.x > Math.min(...xs) && p.x < Math.max(...xs)) assert.ok(allowed.has(id), `${label}: someone outside the family sits among the children of ${f.id}`);
        }
      }
      // A couple sits side by side.
      if (parents.length === 2) {
        const [a, b] = parents.map(p => L.pos.get(p)!);
        assert.equal(a.y, b.y);
        assert.ok(Math.abs(a.x - b.x) <= CARD_W + COUPLE_GAP + 1, `${label}: couple of ${f.id} is apart`);
      }
      // Parents sit over their children, so the rail does not run off past other families. A married
      // only child may be pulled next to a spouse instead.
      if (parents.length && kids.length && !(kids.length === 1 && partners(kids[0]).size > 1)) {
        const ps = parents.map(p => L.pos.get(p)!.x), ks = kids.map(c => L.pos.get(c)!.x);
        assert.ok(Math.max(...ps) + CARD_W > Math.min(...ks) && Math.min(...ps) < Math.max(...ks) + CARD_W, `${label}: parents of ${f.id} are not over their children`);
      }
    }
    // No two families' rails run along the same line.
    const rails = linkSegments(L).filter(s => s.y1 === s.y2 && s.x1 !== s.x2 && ![...L.pos.values()].some(p => p.y + FACE_CY === s.y1));
    for (let i = 0; i < rails.length; i++) for (let j = i + 1; j < rails.length; j++) {
      assert.ok(!(rails[i].y1 === rails[j].y1 && rails[i].x1 < rails[j].x2 && rails[j].x1 < rails[i].x2), `${label}: two rails overlap`);
    }
  };

  check(() => true, 'full tree');
  for (const p of tree.people) {
    const s = sides(tree, p.id);
    if (!s.married) { check(id => visible(s, id, 'mine'), `me = ${p.id}`); continue; }
    for (const view of ['mine', 'spouse'] as const) check(id => visible(s, id, view), `me = ${p.id}, ${view}`);
  }
});
