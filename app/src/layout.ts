// Drawn-tree layout. Generations are rows (from "me"); a family group is a couple joined
// by a line with its children under it. Positions are card top-left corners in tree pixels.
import type { Tree, Family } from '../../engine/src/index.ts';

export const CARD_W = 132;
export const CARD_H = 190;
// Centre of the face circle, from the node's top: couple lines run through it.
export const FACE_CY = 62;
export const GAP_X = 20;
export const COUPLE_GAP = 28;
export const ROW_GAP = 64;
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

export function layoutTree(tree: Tree, me: string, show: (id: string) => boolean = () => true): Layout {
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

  // Generation of each person relative to me (BFS over visible links).
  const gens = new Map<string, number>();
  if (shown.has(me)) {
    gens.set(me, 0);
    const queue = [me];
    while (queue.length) {
      const id = queue.shift()!;
      const g = gens.get(id)!;
      const visit = (other: string, dg: number) => {
        if (!gens.has(other)) { gens.set(other, g + dg); queue.push(other); }
      };
      const b = birth.get(id);
      if (b) {
        for (const p of fams.get(b)!.parents) visit(p, -1);
        for (const c of fams.get(b)!.children) if (c !== id) visit(c, 0);
      }
      const o = own.get(id);
      if (o) {
        for (const p of fams.get(o)!.parents) if (p !== id) visit(p, 0);
        for (const c of fams.get(o)!.children) visit(c, 1);
      }
    }
  }
  let minGen = 0;
  for (const g of gens.values()) minGen = Math.min(minGen, g);
  const rowY = (id: string) => ((gens.get(id) ?? 0) - minGen) * (CARD_H + ROW_GAP) + PAD;

  const pos = new Map<string, Pos>();
  const done = new Set<string>();
  const queue: string[] = [];
  const links: Link[] = [];
  let right = 0;

  const putCard = (id: string, x: number) => { pos.set(id, { x, y: rowY(id) }); right = Math.max(right, x + CARD_W); };
  const shift = (ids: string[], dx: number) => {
    for (const id of ids) { const p = pos.get(id)!; pos.set(id, { x: p.x + dx, y: p.y }); right = Math.max(right, p.x + dx + CARD_W); }
  };

  // Places a family group with its children starting at x0. Returns its width and the
  // placed people (for shifting). Parents or children placed earlier are left where they are.
  function placeFamily(fid: string, x0: number): { width: number; placed: string[] } {
    done.add(fid);
    const fam = fams.get(fid)!;
    const parents = fam.parents.filter(p => !pos.has(p));
    const placedKids = fam.children.filter(c => pos.has(c));
    const fresh = fam.children.filter(c => !pos.has(c));
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
    const kids = [...fresh.filter(k => !wifeFamily.has(k)), ...fresh.filter(k => wifeFamily.has(k))];

    const placed: string[] = [];
    let x = x0;
    const centers: number[] = [];
    for (const k of placedKids) centers.push(pos.get(k)!.x + CARD_W / 2); // already drawn, to the left
    for (const k of kids) {
      if (pos.has(k)) continue; // placed as part of an earlier sibling's block
      const ofid = own.get(k);
      if (ofid && !done.has(ofid)) {
        const r = placeFamily(ofid, x);
        placed.push(...r.placed);
        centers.push(pos.get(k)!.x + CARD_W / 2);
        x += r.width + GAP_X;
        const bf = wifeFamily.get(k);
        if (bf && !done.has(bf)) {
          const r2 = placeFamily(bf, x);
          placed.push(...r2.placed);
          x += r2.width + GAP_X;
        }
      } else {
        putCard(k, x);
        placed.push(k);
        centers.push(x + CARD_W / 2);
        x += CARD_W + GAP_X;
      }
    }
    let childrenEnd = kids.length ? x - GAP_X : x0;

    const n = parents.length;
    const pairW = n ? n * CARD_W + (n - 1) * COUPLE_GAP : 0;
    let pairLeft = x0;
    if (centers.length && n) {
      const mid = (centers[0] + centers[centers.length - 1]) / 2;
      pairLeft = mid - pairW / 2;
      if (pairLeft < x0 && placedKids.length) {
        pairLeft = x0; // a child is already drawn to the left: keep clear of the block before
      } else if (pairLeft < x0) {
        const dx = x0 - pairLeft;
        // Shift only what this call placed: the children blocks.
        shift(placed, dx);
        childrenEnd += dx;
        pairLeft = x0;
      }
    }
    // Male parent on the left, as is the convention.
    const ordered = [...parents].sort((a, b) => sexRank(tree, a) - sexRank(tree, b));
    ordered.forEach((p, i) => { putCard(p, pairLeft + i * (CARD_W + COUPLE_GAP)); placed.push(p); });
    const end = Math.max(childrenEnd, pairLeft + pairW);
    // A parent's own birth family is drawn on its own, further along.
    for (const p of fam.parents) { const b = birth.get(p); if (b && !done.has(b)) queue.push(b); }
    return { width: Math.max(end - x0, 0), placed };
  }

  if (shown.has(me)) {
    let top: string | undefined = birth.get(me) ?? own.get(me);
    if (top) {
      const seen = new Set<string>([top]);
      for (;;) {
        const next: string | undefined = [...fams.get(top)!.parents].sort((a, b) => sexRank(tree, a) - sexRank(tree, b)).map(p => birth.get(p)).find(b => b !== undefined && !seen.has(b));
        if (next === undefined) break;
        seen.add(next); top = next;
      }
      let x = 0;
      queue.unshift(top);
      while (queue.length) {
        const fid = queue.shift()!;
        if (done.has(fid)) continue;
        const r = placeFamily(fid, x);
        x = Math.max(x, right) + (r.width >= 0 ? GAP_X * 2 : 0);
      }
    }
  }
  // Anyone left (no family, or not reached): a card of their own.
  let x = right ? right + GAP_X * 2 : 0;
  const ordered = shown.has(me) ? [me, ...[...shown].filter(i => i !== me)] : [...shown];
  for (const id of ordered) if (!pos.has(id)) { putCard(id, x); x += CARD_W + GAP_X; }

  // Normalise so the leftmost card sits at PAD.
  let minX = Infinity, maxX = 0, maxY = 0;
  for (const p of pos.values()) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x + CARD_W); maxY = Math.max(maxY, p.y + CARD_H); }
  if (!pos.size) return { pos, gens, links, width: 0, height: 0 };
  for (const [id, p] of pos) pos.set(id, { x: p.x - minX + PAD, y: p.y });
  return { pos, gens, links, width: maxX - minX + PAD * 2, height: maxY + PAD };
}

const sexRank = (t: Tree, id: string) => (t.people.find(p => p.id === id)?.sex === 'm' ? 0 : 1);

export interface Segment { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }

// Line segments for the family links: couple line, drop, rail and one stem per child.
export function linkSegments(layout: Layout): Segment[] {
  const segs: Segment[] = [];
  for (const l of layout.links) {
    const parents = l.parents.map(p => layout.pos.get(p)).filter((p): p is Pos => !!p);
    const kids = l.children.map(c => layout.pos.get(c)).filter((p): p is Pos => !!p);
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
    const topKid = Math.min(...kids.map(k => k.y));
    const railY = topKid - ROW_GAP / 2;
    const cx = kids.map(k => k.x + CARD_W / 2);
    if (!sorted.length) {
      dropX = (Math.min(...cx) + Math.max(...cx)) / 2;
      segs.push({ x1: dropX, y1: railY - 22, x2: dropX, y2: railY, dashed: true });
    } else {
      segs.push({ x1: dropX, y1: dropY, x2: dropX, y2: railY });
      // A parent that is not beside the couple line (placed elsewhere) joins the rail too.
      if (!adjacent) for (const p of sorted.slice(1)) segs.push({ x1: p.x + CARD_W / 2, y1: p.y + CARD_H, x2: p.x + CARD_W / 2, y2: railY });
    }
    const xs = [...cx, dropX, ...(adjacent ? [] : sorted.map(p => p.x + CARD_W / 2))];
    segs.push({ x1: Math.min(...xs), y1: railY, x2: Math.max(...xs), y2: railY });
    kids.forEach((k, i) => segs.push({ x1: cx[i], y1: railY, x2: cx[i], y2: k.y }));
  }
  return segs;
}
