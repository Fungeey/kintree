// Link format. Fragment = "v<version>." + base64url(deflate-raw(payload)).
// v2 (written now): a compact binary payload, see encodeV2. v1 (still read): JSON
// {v:1, me, r?, p:[[id,sex,name?]], f:[[id,[parents],[children]]]}.
// The version prefix lets later formats be added without breaking old links.
import { validateTree } from '../../engine/src/index.ts';
import type { Person, Tree, Sex } from '../../engine/src/index.ts';

export const FORMAT_VERSION = 2;

export interface Snapshot { tree: Tree; me: string | null }

interface Wire {
  v: number;
  me: string | null;
  r?: string;   // root person (the tree's creator); absent in older links
  p: [string, Sex, string?][];
  f: [string, string[], string[]][];
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toB64url(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('link is not valid base64url');
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function check({ tree, me }: Snapshot): void {
  validateTree(tree);
  if (me !== null && !tree.people.some((p) => p.id === me)) throw new Error(`me "${me}" is not in the tree`);
}

export function toWire(snap: Snapshot): Wire {
  const { tree, me } = snap;
  check(snap);
  return {
    v: 1,
    me,
    ...(tree.root ? { r: tree.root } : {}),
    p: tree.people.map((p) => (p.name ? [p.id, p.sex, p.name] : [p.id, p.sex])),
    f: tree.families.map((f) => [f.id, f.parents, f.children]),
  };
}

export function fromWire(w: Wire): Snapshot {
  const tree: Tree = {
    version: 1,
    people: w.p.map(([id, sex, name]) => (name ? { id, sex, name } : { id, sex })),
    families: w.f.map(([id, parents, children]) => ({ id, parents, children })),
  };
  return finish(tree, w.me ?? null, w.r);
}

function finish(tree: Tree, me: string | null, root: string | undefined): Snapshot {
  if (me !== null && !tree.people.some((p) => p.id === me)) throw new Error(`me "${me}" is not in the tree`);
  // Links and saved trees from before the root existed: whoever was "me" when it was saved made the tree.
  const r = [root, me].find((id) => id != null && tree.people.some((p) => p.id === id));
  if (r) tree.root = r;
  validateTree(tree);
  return { tree, me };
}

// v2 payload, all integers unsigned LEB128 varints:
//   flags (1 = me present, 2 = root present), person count, family count
//   person ids, then family ids: (zigzag gap from the previous number << 1) for the usual "p<n>" / "f<n>",
//     else (byte length << 1 | 1) + UTF-8
//   sexes: one bit per person (1 = f), packed 8 to a byte
//   names: (byte length + 1) + UTF-8, or 0 for no name
//   me index, root index (only when flagged)
//   per family: parents count, children count, then those people's indexes in order
// Person and family order, ids, parent order and birth order all round-trip exactly.

class Writer {
  bytes: number[] = [];
  uint(x: number): void {
    while (x >= 0x80) { this.bytes.push((x & 0x7f) | 0x80); x = Math.floor(x / 0x80); }
    this.bytes.push(x);
  }
  raw(b: Uint8Array): void { for (const x of b) this.bytes.push(x); }
  last = 0;
  // Numeric ids are stored as the zigzagged gap from the previous one, so p1, p2, p3... is a run of zeros.
  id(id: string, prefix: string): void {
    const m = new RegExp(`^${prefix}([1-9]\\d{0,14})$`).exec(id);
    if (m) {
      const gap = Number(m[1]) - this.last - 1;
      this.last = Number(m[1]);
      this.uint((gap >= 0 ? gap * 2 : -gap * 2 - 1) * 2);
      return;
    }
    const b = new TextEncoder().encode(id);
    this.uint(b.length * 2 + 1);
    this.raw(b);
  }
}

class Reader {
  at = 0;
  b: Uint8Array;
  constructor(b: Uint8Array) { this.b = b; }
  uint(): number {
    let x = 0, scale = 1;
    for (;;) {
      if (this.at >= this.b.length) throw new Error('ends early');
      const c = this.b[this.at++];
      x += (c & 0x7f) * scale;
      if (c < 0x80) return x;
      scale *= 0x80;
      if (scale > 2 ** 49) throw new Error('number too large');
    }
  }
  raw(n: number): Uint8Array {
    if (this.at + n > this.b.length) throw new Error('ends early');
    return this.b.subarray(this.at, (this.at += n));
  }
  text(n: number): string { return new TextDecoder('utf-8', { fatal: true }).decode(this.raw(n)); }
  last = 0;
  id(prefix: string): string {
    const x = this.uint();
    if (x % 2 === 1) return this.text((x - 1) / 2);
    const z = x / 2;
    this.last += 1 + (z % 2 === 0 ? z / 2 : -(z + 1) / 2);
    if (this.last < 1) throw new Error('bad id');
    return prefix + this.last;
  }
  index(count: number): number {
    const i = this.uint();
    if (i >= count) throw new Error('index out of range');
    return i;
  }
}

function encodeV2(snap: Snapshot): Uint8Array {
  const { tree, me } = snap;
  check(snap);
  const ix = new Map(tree.people.map((p, i) => [p.id, i]));
  const at = (id: string) => ix.get(id)!;
  const root = tree.root && ix.has(tree.root) ? tree.root : undefined;
  const w = new Writer();
  w.uint((me !== null ? 1 : 0) | (root !== undefined ? 2 : 0));
  w.uint(tree.people.length);
  w.uint(tree.families.length);
  for (const p of tree.people) w.id(p.id, 'p');
  w.last = 0;
  for (const f of tree.families) w.id(f.id, 'f');
  for (let i = 0; i < tree.people.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < tree.people.length; j++) if (tree.people[i + j].sex === 'f') byte |= 1 << j;
    w.bytes.push(byte);
  }
  for (const p of tree.people) {
    if (!p.name) { w.uint(0); continue; }
    const b = new TextEncoder().encode(p.name);
    w.uint(b.length + 1);
    w.raw(b);
  }
  if (me !== null) w.uint(at(me));
  if (root !== undefined) w.uint(at(root));
  for (const f of tree.families) {
    w.uint(f.parents.length);
    w.uint(f.children.length);
    for (const id of [...f.parents, ...f.children]) w.uint(at(id));
  }
  return Uint8Array.from(w.bytes);
}

function decodeV2(b: Uint8Array): Snapshot {
  const r = new Reader(b);
  const flags = r.uint();
  if (flags > 3) throw new Error('unknown flags');
  const nPeople = r.uint(), nFamilies = r.uint();
  // Every person and family takes at least one byte, so larger counts can only be junk.
  if (nPeople + nFamilies > b.length) throw new Error('bad counts');
  const pids = Array.from({ length: nPeople }, () => r.id('p'));
  r.last = 0;
  const fids = Array.from({ length: nFamilies }, () => r.id('f'));
  const sexBytes = r.raw(Math.ceil(nPeople / 8));
  const people: Person[] = pids.map((id, i) => ({ id, sex: (sexBytes[i >> 3] >> (i & 7)) & 1 ? 'f' : 'm' }));
  for (const p of people) {
    const n = r.uint();
    if (n > 0) p.name = r.text(n - 1);
  }
  const me = flags & 1 ? pids[r.index(nPeople)] : null;
  const root = flags & 2 ? pids[r.index(nPeople)] : undefined;
  const families = fids.map((id) => {
    const np = r.uint(), nc = r.uint();
    if (np + nc > b.length) throw new Error('bad counts');
    const ids = Array.from({ length: np + nc }, () => pids[r.index(nPeople)]);
    return { id, parents: ids.slice(0, np), children: ids.slice(np) };
  });
  if (r.at !== b.length) throw new Error('trailing bytes');
  return finish({ version: 1, people, families }, me, root);
}

/** Encode a tree and "me" as a link fragment (without the leading #). */
export async function encodeFragment(snap: Snapshot): Promise<string> {
  return `v${FORMAT_VERSION}.` + toB64url(await pipe(encodeV2(snap), new CompressionStream('deflate-raw')));
}

/** Decode a fragment (with or without a leading #). Reads v1 and v2. Throws on anything malformed or from a newer version. */
export async function decodeFragment(fragment: string): Promise<Snapshot> {
  const f = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const m = /^v(\d+)\./.exec(f);
  if (!m) throw new Error('link has no version prefix');
  const version = Number(m[1]);
  if (version !== 1 && version !== 2) throw new Error(`unsupported link version ${m[1]}`);
  let raw: Uint8Array;
  try {
    raw = await pipe(fromB64url(f.slice(m[0].length)), new DecompressionStream('deflate-raw'));
  } catch (e) {
    throw new Error(`link is corrupt: ${(e as Error).message}`);
  }
  if (version === 2) {
    let snap: Snapshot;
    try { snap = decodeV2(raw); } catch (e) { throw new Error(`link is corrupt: ${(e as Error).message}`); }
    return snap;
  }
  let w: Wire;
  try {
    w = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    throw new Error(`link is corrupt: ${(e as Error).message}`);
  }
  if (!w || w.v !== 1 || !Array.isArray(w.p) || !Array.isArray(w.f)) throw new Error('link is corrupt: bad shape');
  return fromWire(w);
}
