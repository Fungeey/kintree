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

// Everyone a person's own family leads to: the person, their spouse, and those children's families
// in turn. Not the spouse's own parents or siblings.
function branch(tree: Tree, id: string, show: (id: string) => boolean): string[] {
  const out = [id];
  const fam = tree.families.find(f => f.parents.includes(id));
  for (const p of fam?.parents ?? []) if (p !== id && show(p)) out.push(p);
  for (const c of fam?.children ?? []) if (show(c)) out.push(...branch(tree, c, show));
  return out;
}

// The demo family drawn in every view of every "me": whoever is hidden is left out of the layout,
// and what is left must read right.
function checkViews(tree: Tree, name: string, rows: boolean) {
  const partners = (id: string) => new Set(tree.families.filter(f => f.parents.includes(id)).flatMap(f => f.parents));

  const check = (show: (id: string) => boolean, label: string) => {
    const L = layoutTree(tree, show);
    assert.equal(L.pos.size, tree.people.filter(p => show(p.id)).length, `${name} ${label}: hidden people are drawn`);
    for (const f of tree.families) {
      const parents = f.parents.filter(show), kids = f.children.filter(show);
      // Brothers and sisters stay together: between the outermost two, only their own husbands and wives.
      if (rows && kids.length > 1) {
        const xs = kids.map(c => L.pos.get(c)!.x);
        const y = L.pos.get(kids[0])!.y;
        const allowed = new Set(kids.flatMap(c => [...partners(c), c]));
        for (const [id, p] of L.pos) {
          if (p.y === y && p.x > Math.min(...xs) && p.x < Math.max(...xs)) assert.ok(allowed.has(id), `${name} ${label}: someone outside the family sits among the children of ${f.id}`);
        }
      }
      // Vertical slices: each child's branch (them, their spouse, their descendants) takes its own
      // stretch from side to side, so no other branch is drawn between two of its cards.
      if (kids.length > 1) {
        // Row by row: in any one row, a branch's cards form a stretch no other branch's card is inside.
        const cards = kids.map(c => branch(tree, c, show).map(i => L.pos.get(i)!));
        const rowsOf = new Set(cards.flat().map(p => p.y));
        for (const y of rowsOf) {
          const spans = cards.map(ps => { const xs = ps.filter(p => p.y === y).map(p => p.x); return xs.length ? [Math.min(...xs), Math.max(...xs)] : null; });
          for (let i = 0; i < spans.length; i++) for (let j = i + 1; j < spans.length; j++) {
            const a = spans[i], b = spans[j];
            if (!a || !b) continue;
            assert.ok(a[1] < b[0] || b[1] < a[0], `${name} ${label}: the branches of ${kids[i]} and ${kids[j]} overlap`);
          }
        }
      }
      // A couple sits side by side.
      if (parents.length === 2) {
        const [a, b] = parents.map(p => L.pos.get(p)!);
        assert.equal(a.y, b.y);
        assert.ok(Math.abs(a.x - b.x) <= CARD_W + COUPLE_GAP + 1, `${name} ${label}: couple of ${f.id} is apart`);
      }
      // Parents sit over their children, so the rail does not run off past other families. A married
      // only child may be pulled next to a spouse instead.
      if (parents.length && kids.length && !(kids.length === 1 && partners(kids[0]).size > 1)) {
        const ps = parents.map(p => L.pos.get(p)!.x), ks = kids.map(c => L.pos.get(c)!.x);
        assert.ok(Math.max(...ps) + CARD_W > Math.min(...ks) && Math.min(...ps) < Math.max(...ks) + CARD_W, `${name} ${label}: parents of ${f.id} are not over their children`);
      }
    }
    // No two families' rails run along the same line.
    const rails = linkSegments(L).filter(s => s.y1 === s.y2 && s.x1 !== s.x2 && ![...L.pos.values()].some(p => p.y + FACE_CY === s.y1));
    for (let i = 0; i < rails.length; i++) for (let j = i + 1; j < rails.length; j++) {
      assert.ok(!(rails[i].y1 === rails[j].y1 && rails[i].x1 < rails[j].x2 && rails[j].x1 < rails[i].x2), `${name} ${label}: two rails overlap`);
    }
  };

  // Not drawn all at once: the app only ever shows one hop from "me" (decision 20), and when both a son's
  // and his wife's families are drawn no order can keep each of them in one piece.
  for (const p of tree.people) {
    const s = sides(tree, p.id);
    if (!s.married) { check(id => visible(s, id, 'mine'), `me = ${p.id}`); continue; }
    for (const view of ['mine', 'spouse'] as const) check(id => visible(s, id, view), `me = ${p.id}, ${view}`);
  }
}

test('layout: the demo family reads right in every view', async () => {
  const { demoTree } = await import('../src/demo.ts');
  checkViews(demoTree().tree, 'demo', true);
});

// The demo already has the paternal grandmother's brother and sister. Add the other grandparents'
// siblings, with their husbands, wives and children.
test('layout: grandparents\' siblings each get a branch of their own', async () => {
  const { demoTree } = await import('../src/demo.ts');
  let { tree } = demoTree();
  const add = (e: { tree: Tree; id: string }) => { tree = e.tree; return e.id; };
  const gpaSis = add(addSibling(tree, 'p5', 'f'));   // paternal grandfather's sister
  add(addSpouse(tree, gpaSis, 'm'));
  add(addChild(tree, gpaSis, 'f'));
  add(addChild(tree, gpaSis, 'm'));
  const mgmaBro = add(addSibling(tree, 'p16', 'm')); // maternal grandmother's brother
  add(addSpouse(tree, mgmaBro, 'f'));
  add(addChild(tree, mgmaBro, 'f'));
  const mgpaSis = add(addSibling(tree, 'p15', 'f')); // maternal grandfather's sister
  add(addSpouse(tree, mgpaSis, 'm'));
  add(addChild(tree, mgpaSis, 'm'));
  // A grandparent's brothers and sisters can sit on the far side of the other side of the family, so
  // only the branches (not the row of siblings) are held to stay together here.
  checkViews(tree, 'extended', false);

  // A husband's brothers and sisters are drawn left of his couple and a wife's right of it, so the
  // paternal grandmother's brother and sister are right of the paternal grandparents, and the
  // mother's parents are right of the father.
  const s = sides(tree, 'p1');
  const L = layoutTree(tree, id => visible(s, id, 'mine'));
  const x = (id: string) => L.pos.get(id)!.x;
  assert.ok(x('p39') > x('p6') && x('p43') > x('p6'), "grandma's brother and sister are right of the paternal grandparents");
  assert.ok(x('p15') > x('p2') && x('p53') > x('p2'), "mother's parents and their siblings are right of the father");
});

test('layout: a couple whose siblings have grandchildren has its own children start lower', () => {
  let t: Tree = emptyTree();
  const id: Record<string, string> = {};
  const add = (k: string, e: { tree: Tree; id: string }) => { t = e.tree; id[k] = e.id; };
  add('me', addPerson(t, 'm', 'Me'));
  add('dad', addParent(t, id.me, 'm', 'Dad'));
  add('gma', addParent(t, id.dad, 'f', 'Gma'));
  add('gpa', addParent(t, id.dad, 'm', 'Gpa'));
  add('sis', addSibling(t, id.gma, 'f', 'GreatAunt'));
  add('cous', addChild(t, id.sis, 'f', 'Cousin'));
  add('cousKid', addChild(t, id.cous, 'm', 'CousinKid'));
  const L = layoutTree(t);
  const y = (k: string) => L.pos.get(id[k])!.y;
  assert.equal(y('sis'), y('gma'));
  assert.ok(y('dad') > y('cousKid'), "dad's row is below the cousin's child");
  // With no brothers or sisters there is no lift.
  const u = sample();
  const U = layoutTree(u.t);
  assert.equal(U.pos.get(u.id.dad)!.y - U.pos.get(u.id.gpa)!.y, CARD_H + 28);
});

test('layout: names only (no titles) packs the rows a little closer, with couple lines still through the faces', async () => {
  const { demoTree } = await import('../src/demo.ts');
  const { BARE_CARD_H, BARE_FACE_CY } = await import('../src/layout.ts');
  const { tree } = demoTree();
  const full = layoutTree(tree), bare = layoutTree(tree, undefined, true);
  assert.ok(bare.height < full.height);
  assert.equal(bare.cardH, BARE_CARD_H);
  assert.equal(bare.faceCy, BARE_FACE_CY);
  for (const [id, p] of bare.pos) assert.equal(p.x, full.pos.get(id)!.x);
  const ys = new Set([...bare.pos.values()].map(p => p.y));
  for (const h of coupleHearts(bare)) assert.ok(ys.has(h.y - BARE_FACE_CY));
  for (const p of bare.pos.values()) assert.ok(p.y + BARE_CARD_H <= bare.height);
});
