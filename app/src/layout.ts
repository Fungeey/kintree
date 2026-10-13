// Drawn-tree layout. Generations are rows; a family group is a couple joined
// by a line with its children under it. Positions are card top-left corners in tree pixels.
import type { Tree, Family } from '../../engine/src/index.ts';

export const CARD_W = 76;
export const CARD_H = 117;
// Centre of the face circle, from the node's top: couple lines run through it.
export const FACE_CY = 50;
export const GAP_X = 8;
export const COUPLE_GAP = 24;
export const ROW_GAP = 28;
const PAD = 24;

export interface Pos { x: number; y: number }
export interface Link { family: string; parents: string[]; children: string[] }
export interface Layout {
  pos: Map<string, Pos>;
  gens: Map<string, number>;
  links: Link[];
  width: number;
  height: number;
}

// The layout depends only on the tree and on which people are shown, never on who "me" is: anchors
// and ordering come from the order of tree.people. People who are hidden (the other side of a
// married view) are left out before anything is placed, so they take up no room and join nothing.
export function layoutTree(tree: Tree, show: (id: string) => boolean = () => true): Layout {
  const shown = new Set(tree.people.filter(p => show(p.id)).map(p => p.id));
  const fams = new Map<string, { f: Family; parents: string[]; children: string[] }>();
  const birth = new Map<string, string>();
  const own = new Map<string, string>();
  for (const f of tree.families) {
    const parents = f.parents.filter(p => shown.has(p));
    const children = f.children.filter(c => shown.has(c));
    if (parents.length === 0 && children.length === 0) continue;
    fams.set(f.id, { f, parents, children });
    for (const c of children) birth.set(c, f.id);
    for (const p of parents) own.set(p, f.id);
  }

  // Generation of each person, relative to the first person of their connected group (BFS over
  // visible links, started from the earliest person in tree order).
  const gens = new Map<string, number>();
  // Rows are generations with one change: a couple whose brothers and sisters have families of their own
  // has its own children start lower, below the deepest of those branches, so the cousins' rows sit
  // between the couple and their children instead of needing room beside them.
  const rowsV = new Map<string, number>();
  const branchDepth = (id: string, seen = new Set<string>()): number => {
    const o = own.get(id);
    if (!o || seen.has(o)) return 0;
    seen.add(o);
    const kids = fams.get(o)!.children;
    return kids.length ? 1 + Math.max(...kids.map(k => branchDepth(k, seen))) : 0;
  };
  // Only the couples above the first person (the tree's root) are lifted: those are the ones whose own
  // line the eye follows down the page, while their brothers and sisters hang to the sides.
  const spine = new Set<string>();
  const ancestors = new Set<string>();
  for (let cur = [tree.people[0]?.id]; cur.length;) {
    const nextUp: string[] = [];
    for (const c of cur) {
      const b = c && birth.get(c);
      if (!b || spine.has(b)) continue;
      spine.add(b);
      for (const p of fams.get(b)!.parents) ancestors.add(p);
      nextUp.push(...fams.get(b)!.parents);
    }
    cur = nextUp;
  }
  const liftOf = (fid: string): number => {
    if (!spine.has(fid)) return 0;
    let k = 0;
    for (const p of fams.get(fid)!.parents) {
      const b = birth.get(p);
      if (!b) continue;
      for (const s of fams.get(b)!.children) if (s !== p) k = Math.max(k, branchDepth(s));
    }
    // Branches two generations deep get one row more, for the parents of the children's spouses.
    return k >= 2 ? k + 1 : k;
  };
  const order = tree.people.filter(p => shown.has(p.id)).map(p => p.id);
  const anchors: string[] = [];
  for (const start of order) {
    if (gens.has(start)) continue;
    anchors.push(start);
    gens.set(start, 0);
    rowsV.set(start, 0);
    const queue = [start];
    while (queue.length) {
      const id = queue.shift()!;
      const g = gens.get(id)!;
      const visit = (other: string, dg: number, lift = 0) => {
        if (!gens.has(other)) { gens.set(other, g + dg); rowsV.set(other, rowsV.get(id)! + dg + lift); queue.push(other); }
      };
      const b = birth.get(id);
      if (b) {
        for (const p of fams.get(b)!.parents) visit(p, -1, -liftOf(b));
        for (const c of fams.get(b)!.children) if (c !== id) visit(c, 0);
      }
      const o = own.get(id);
      if (o) {
        for (const p of fams.get(o)!.parents) if (p !== id) visit(p, 0);
        for (const c of fams.get(o)!.children) visit(c, 1, liftOf(o));
      }
    }
  }
  let minGen = 0;
  for (const g of rowsV.values()) minGen = Math.min(minGen, g);
  const rowY = (id: string) => ((rowsV.get(id) ?? 0) - minGen) * (CARD_H + ROW_GAP) + PAD;

  const pos = new Map<string, Pos>();
  const done = new Set<string>();
  const queue: string[] = [];
  const links: Link[] = [];
  let right = 0;

  // Each row fills left to right: `frontier` is where the next card in a row may go, so a family
  // placed later can still sit above its child when the row above is free there.
  const rowOf = (id: string) => (rowsV.get(id) ?? 0) - minGen;
  const frontier = new Map<number, number>();
  let floor = 0; // left edge for the connected group being drawn
  const free = (row: number) => Math.max(frontier.get(row) ?? floor, floor);
  const mark = (id: string) => {
    const p = pos.get(id)!, row = rowOf(id);
    frontier.set(row, Math.max(free(row), p.x + CARD_W + GAP_X));
    right = Math.max(right, p.x + CARD_W);
  };
  const putCard = (id: string, x: number) => { pos.set(id, { x, y: rowY(id) }); mark(id); };
  const shift = (ids: string[], dx: number) => {
    for (const id of ids) { const p = pos.get(id)!; pos.set(id, { x: p.x + dx, y: p.y }); mark(id); }
  };
  // A married child's in-law family met inside another family's block waits until that block is
  // done, so it never pushes in between a parent and that parent's own brothers and sisters.
  let deferred: string[] = [];

  // Whether someone, or anyone descended from them, is a son whose wife's own family is still to be drawn.
  const inLawMemo = new Map<string, boolean>();
  function leadsToInLaw(k: string): boolean {
    const hit = inLawMemo.get(k);
    if (hit !== undefined) return hit;
    inLawMemo.set(k, false); // a cycle (relatives who married) must not recurse forever
    const ofid = own.get(k);
    let found = false;
    if (ofid && !done.has(ofid)) {
      const sp = fams.get(ofid)!.parents.find(p => p !== k && !pos.has(p));
      const bf = sp && birth.get(sp);
      const bfam = bf && fams.get(bf);
      found = (!!sp && sexRank(tree, k) < sexRank(tree, sp) && !!bf && !!bfam && !done.has(bf) && bfam.parents.length + bfam.children.length > 1)
        || fams.get(ofid)!.children.some(leadsToInLaw);
    }
    inLawMemo.set(k, found);
    return found;
  }

  // Places a family group: its children (with their own families) left to right, then the parents
  // centred over them. Returns the people placed, for shifting. People placed earlier stay put.
  function placeFamily(fid: string, skip: Set<string> = new Set()): string[] {
    done.add(fid);
    const fam = fams.get(fid)!;
    const parents = fam.parents.filter(p => !pos.has(p));
    const placedKids = fam.children.filter(c => pos.has(c));
    const fresh = fam.children.filter(c => !pos.has(c) && !skip.has(c));
    links.push({ family: fid, parents: fam.parents, children: fam.children });

    // A married son's wife's own family is drawn right after him, so each side of a couple
    // forms its own block and the two sibling rails never run over each other. Sons with such a
    // link go last among their brothers and sisters, next to the in-laws.
    const wifeFamily = new Map<string, string>();
    for (const k of fresh) {
      const ofid = own.get(k);
      if (!ofid || done.has(ofid)) continue;
      const sp = fams.get(ofid)!.parents.find(p => p !== k && !pos.has(p));
      if (!sp || sexRank(tree, k) >= sexRank(tree, sp)) continue;
      const bf = birth.get(sp);
      const bfam = bf && fams.get(bf);
      if (bf && bfam && !done.has(bf) && bfam.parents.length + bfam.children.length > 1) wifeFamily.set(k, bf);
    }
    // A branch that has such a link anywhere below it also goes last, so the in-law family always
    // lands right beside the branch it joins, and the other branches sit clear of both.
    // On the line above the root, a child whose own couple is lifted by two rows or more goes first, so the rest of the
    // brothers and sisters sit on its far side, with room for their families under them.
    const lead = spine.has(fid) ? fresh.filter(k => ancestors.has(k) && liftOf(own.get(k) ?? '') >= 2) : [];
    const rest = fresh.filter(k => !lead.includes(k));
    const kids = [...lead, ...rest.filter(k => !leadsToInLaw(k)), ...rest.filter(k => leadsToInLaw(k))];

    const placed: string[] = [];
    const centers: number[] = [];
    for (const k of placedKids) centers.push(pos.get(k)!.x + CARD_W / 2);
    // Each brother's or sister's branch (them, their spouse, their descendants) gets its own stretch
    // from side to side: the next one starts to the right of everything drawn so far, in every row,
    // so a family's grandchildren never sit under another branch.
    const floorBefore = floor;
    let first = placedKids.length === 0;
    for (const k of kids) {
      if (pos.has(k)) continue; // placed as part of an earlier sibling's block
      if (!first) floor = Math.max(floor, right + GAP_X);
      first = false
      const ofid = own.get(k);
      if (ofid && !done.has(ofid)) {
        placed.push(...placeFamily(ofid));
        centers.push(pos.get(k)!.x + CARD_W / 2);
      } else {
        putCard(k, free(rowOf(k)));
        placed.push(k);
        centers.push(pos.get(k)!.x + CARD_W / 2);
      }
      const bf = wifeFamily.get(k);
      if (bf && !done.has(bf)) deferred.push(bf);
    }

    floor = floorBefore;

    // Male parent on the left, as is the convention.
    const ordered = [...parents].sort((a, b) => sexRank(tree, a) - sexRank(tree, b));
    if (ordered.length) {
      const pairW = ordered.length * CARD_W + (ordered.length - 1) * COUPLE_GAP;
      const lim = Math.max(...ordered.map(p => free(rowOf(p))));
      let pairLeft = lim;
      if (centers.length) {
        const want = (Math.min(...centers) + Math.max(...centers)) / 2 - pairW / 2;
        if (want >= lim) pairLeft = want;
        else if (!placedKids.length && placed.length) shift(placed, lim - want); // move the new children along
        // else a child is already drawn to the left: keep clear of the row and reach back with the rail
      }
      ordered.forEach((p, i) => { putCard(p, pairLeft + i * (CARD_W + COUPLE_GAP)); placed.push(p); });
    }
    // A parent's own birth family is drawn on its own, further along.
    for (const p of fam.parents) { const b = birth.get(p); if (b && !done.has(b)) queue.push(b); }
    return placed;
  }

  // The families of a branch's married-in wives that sit above a deeper join of the same branch
  // (a grandfather's wife's brothers and sisters, say, above a son whose wife has a family too).
  // The deeper join takes the side next to its branch, so these go to the left instead of being
  // squeezed in between. Each comes with the wife that links it back, who is drawn later.
  function leftWing(top: string): { fid: string; joiner: string }[] {
    const out: { fid: string; joiner: string }[] = [];
    const seenFam = new Set<string>();
    const walk = (fid: string) => {
      if (seenFam.has(fid)) return;
      seenFam.add(fid);
      for (const k of fams.get(fid)!.children) {
        const ofid = own.get(k);
        if (!ofid) continue;
        const sp = fams.get(ofid)!.parents.find(p => p !== k);
        const bf = sp && birth.get(sp);
        const bfam = bf && fams.get(bf);
        if (sp && bf && bfam && sexRank(tree, k) < sexRank(tree, sp) && bfam.parents.length + bfam.children.length > 1
          && fams.get(ofid)!.children.some(leadsToInLaw)) out.push({ fid: bf, joiner: sp });
        walk(ofid);
      }
    };
    walk(top);
    return out;
  }

  for (const anchor of anchors) {
    if (pos.has(anchor)) continue;
    let top: string | undefined = birth.get(anchor) ?? own.get(anchor);
    if (!top) continue;
    const seen = new Set<string>([top]);
    for (;;) {
      const next: string | undefined = [...fams.get(top)!.parents].sort((a, b) => sexRank(tree, a) - sexRank(tree, b)).map(p => birth.get(p)).find(b => b !== undefined && !seen.has(b));
      if (next === undefined) break;
      seen.add(next); top = next;
    }
    floor = right ? right + GAP_X * 2 : 0; // each connected group starts clear of the last
    const wing = leftWing(top);
    for (const w of wing) if (!done.has(w.fid)) placeFamily(w.fid, new Set([w.joiner]));
    if (wing.length) floor = Math.max(floor, right + GAP_X * 2);
    queue.unshift(top);
    while (queue.length) {
      const fid = queue.shift()!;
      if (done.has(fid)) continue;
      placeFamily(fid);
      queue.unshift(...deferred);
      deferred = [];
    }
  }
  // Anyone left (no family, or not reached): a card of their own, in tree order.
  let x = right ? right + GAP_X * 2 : 0;
  for (const id of order) if (!pos.has(id)) { putCard(id, x); x += CARD_W + GAP_X; }

  // Normalise so the leftmost card sits at PAD.
  let minX = Infinity, maxX = 0, maxY = 0;
  for (const p of pos.values()) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + CARD_W); maxY = Math.max(maxY, p.y + CARD_H); }
  if (!pos.size) return { pos, gens, links, width: 0, height: 0 };
  for (const [id, p] of pos) pos.set(id, { x: p.x - minX + PAD, y: p.y });
  return { pos, gens, links, width: maxX - minX + PAD * 2, height: maxY + PAD };
}

const sexRank = (t: Tree, id: string) => (t.people.find(p => p.id === id)?.sex === 'm' ? 0 : 1);

// `bridge`: a rail moved off the usual line (and its drop and stems) is drawn on top, with a gap
// cut into any line it crosses, so a crossing never reads as a join.
export interface Segment { x1: number; y1: number; x2: number; y2: number; dashed?: boolean; bridge?: boolean }

// Rails that would run along the same line between two rows are moved up or down a little,
// so two families' children are never joined by one line that reads as a single family.
const LANES = [0, -8, 8];

// Line segments for the family links: couple line, drop, rail and one stem per child.
export function linkSegments(layout: Layout, show: (id: string) => boolean = () => true): Segment[] {
  const segs: Segment[] = [];
  const at = (ids: string[]) => ids.filter(show).map(i => layout.pos.get(i)).filter((p): p is Pos => !!p);
  interface Rail { sorted: Pos[]; adjacent: boolean; dropX: number; dropY: number; kids: Pos[]; cx: number[]; y: number; x1: number; x2: number }
  const rails: Rail[] = [];
  for (const l of layout.links) {
    const parents = at(l.parents);
    const kids = at(l.children);
    if (!parents.length && !kids.length) continue;
    if (!parents.length && kids.length < 2) continue; // nothing to join
    const sorted = [...parents].sort((a, b) => a.x - b.x);
    let dropX: number, dropY: number;
    const adjacent = sorted.length === 2 && sorted[0].y === sorted[1].y && sorted[1].x - sorted[0].x <= CARD_W + COUPLE_GAP + 1;
    if (adjacent) {
      const y = sorted[0].y + FACE_CY;
      segs.push({ x1: sorted[0].x + CARD_W, y1: y, x2: sorted[1].x, y2: y });
      dropX = (sorted[0].x + CARD_W + sorted[1].x) / 2; dropY = y;
    } else if (sorted.length) {
      dropX = sorted[0].x + CARD_W / 2; dropY = sorted[0].y + CARD_H;
    } else { dropX = 0; dropY = 0; }
    if (!kids.length) continue;
    const y = Math.min(...kids.map(k => k.y)) - ROW_GAP / 2;
    const cx = kids.map(k => k.x + CARD_W / 2);
    if (!sorted.length) dropX = (Math.min(...cx) + Math.max(...cx)) / 2;
    const xs = [...cx, dropX, ...(adjacent ? [] : sorted.map(p => p.x + CARD_W / 2))];
    rails.push({ sorted, adjacent, dropX, dropY, kids, cx, y, x1: Math.min(...xs), x2: Math.max(...xs) });
  }

  // Lanes: rails between the same two rows that overlap take different heights. Shorter rails
  // keep the usual line; a long one reaching across other families moves off it.
  const lanes = new Map<number, [number, number][][]>(); // rail height -> spans in each lane
  const out: Segment[] = [];
  for (const r of [...rails].sort((a, b) => (a.x2 - a.x1) - (b.x2 - b.x1) || a.x1 - b.x1)) {
    const used = lanes.get(r.y) ?? LANES.map(() => []);
    lanes.set(r.y, used);
    let lane = used.findIndex(spans => spans.every(([a, b]) => r.x2 < a - 1 || r.x1 > b + 1));
    if (lane < 0) lane = 0;
    used[lane].push([r.x1, r.x2]);
    const railY = r.y + LANES[lane];
    const mine: Segment[] = [];
    if (!r.sorted.length) {
      mine.push({ x1: r.dropX, y1: railY - 22, x2: r.dropX, y2: railY, dashed: true });
    } else {
      mine.push({ x1: r.dropX, y1: r.dropY, x2: r.dropX, y2: railY });
      // A parent that is not beside the couple line (placed elsewhere) joins the rail too.
      if (!r.adjacent) for (const p of r.sorted.slice(1)) mine.push({ x1: p.x + CARD_W / 2, y1: p.y + CARD_H, x2: p.x + CARD_W / 2, y2: railY });
    }
    mine.push({ x1: r.x1, y1: railY, x2: r.x2, y2: railY });
    r.kids.forEach((k, i) => mine.push({ x1: r.cx[i], y1: railY, x2: r.cx[i], y2: k.y }));
    if (lane) for (const m of mine) m.bridge = true;
    out.push(...mine);
  }
  // Bridged rails last, so they are drawn over the others.
  segs.push(...out.filter(m => !m.bridge), ...out.filter(m => m.bridge));
  return segs;
}

// Where to draw a heart: the middle of each couple line between two side-by-side parents.
export function coupleHearts(layout: Layout, show: (id: string) => boolean = () => true): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const l of layout.links) {
    const ps = l.parents.filter(show).map(p => layout.pos.get(p)).filter((p): p is Pos => !!p).sort((a, b) => a.x - b.x);
    if (ps.length === 2 && ps[0].y === ps[1].y && ps[1].x - ps[0].x <= CARD_W + COUPLE_GAP + 1) {
      out.push({ x: (ps[0].x + CARD_W + ps[1].x) / 2, y: ps[0].y + FACE_CY });
    }
  }
  return out;
}
