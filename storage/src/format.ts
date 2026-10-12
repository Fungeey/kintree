// Link format (slice 2). Fragment = "v1." + base64url(deflate-raw(JSON)).
// JSON is compact: {v:1, me, p:[[id,sex,name?]], f:[[id,[parents],[children]]]}.
// The version prefix lets later formats (half-siblings etc.) be added without breaking old links.
import { validateTree } from '../../engine/src/index.ts';
import type { Tree, Sex } from '../../engine/src/index.ts';

export const FORMAT_VERSION = 1;
const PREFIX = `v${FORMAT_VERSION}.`;

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

export function toWire(snap: Snapshot): Wire {
  const { tree, me } = snap;
  validateTree(tree);
  if (me !== null && !tree.people.some((p) => p.id === me)) throw new Error(`me "${me}" is not in the tree`);
  return {
    v: FORMAT_VERSION,
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
  const me = w.me ?? null;
  if (me !== null && !tree.people.some((p) => p.id === me)) throw new Error(`me "${me}" is not in the tree`);
  // Links and saved trees from before the root existed: whoever was "me" when it was saved made the tree.
  const root = [w.r, me].find((id) => id != null && tree.people.some((p) => p.id === id));
  if (root) tree.root = root;
  validateTree(tree);
  return { tree, me };
}

/** Encode a tree and "me" as a link fragment (without the leading #). */
export async function encodeFragment(snap: Snapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(snap)));
  return PREFIX + toB64url(await pipe(json, new CompressionStream('deflate-raw')));
}

/** Decode a fragment (with or without a leading #). Throws on anything malformed or from a newer version. */
export async function decodeFragment(fragment: string): Promise<Snapshot> {
  const f = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const m = /^v(\d+)\./.exec(f);
  if (!m) throw new Error('link has no version prefix');
  if (Number(m[1]) !== FORMAT_VERSION) throw new Error(`unsupported link version ${m[1]}`);
  let w: Wire;
  try {
    const raw = await pipe(fromB64url(f.slice(m[0].length)), new DecompressionStream('deflate-raw'));
    w = JSON.parse(new TextDecoder().decode(raw));
  } catch (e) {
    throw new Error(`link is corrupt: ${(e as Error).message}`);
  }
  if (!w || w.v !== FORMAT_VERSION || !Array.isArray(w.p) || !Array.isArray(w.f)) throw new Error('link is corrupt: bad shape');
  return fromWire(w);
}
