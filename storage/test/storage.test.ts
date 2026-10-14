import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFragment, decodeFragment, save, open, CURRENT_KEY, RECENT_KEY } from '../src/index.ts';
import { toWire } from '../src/format.ts';
import type { KV, Snapshot } from '../src/index.ts';

const tree = (extra = false): Snapshot => ({
  me: 'a',
  tree: {
    version: 1,
    root: 'a',
    people: [
      { id: 'a', sex: 'm', name: '阿明' }, { id: 'b', sex: 'f' },
      { id: 'c', sex: 'm' }, { id: 'd', sex: 'f' },
      ...(extra ? [{ id: 'e', sex: 'f' as const }] : []),
    ],
    families: [{ id: 'f1', parents: ['c', 'd'], children: ['a', ...(extra ? ['e'] : [])] }, { id: 'f2', parents: ['a', 'b'], children: [] }],
  },
});

class Mem implements KV {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

test('round trip keeps tree and me', async () => {
  const f = await encodeFragment(tree());
  assert.match(f, /^v2\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeFragment('#' + f), tree());
});

test('empty tree with no me round trips', async () => {
  const s: Snapshot = { me: null, tree: { version: 1, people: [], families: [] } };
  assert.deepEqual(await decodeFragment(await encodeFragment(s)), s);
});

test('unknown version, junk and invalid trees are rejected', async () => {
  await assert.rejects(decodeFragment('v3.abc'), /unsupported link version 3/);
  await assert.rejects(decodeFragment('hello'), /version/);
  await assert.rejects(decodeFragment('v1.!!!'), /corrupt|base64/);
  await assert.rejects(decodeFragment('v1.AAAA'), /corrupt/);
  await assert.rejects(decodeFragment('v2.!!!'), /corrupt|base64/);
  await assert.rejects(decodeFragment('v2.AAAA'), /corrupt/);
  await assert.rejects(encodeFragment({ ...tree(), me: 'zzz' }), /not in the tree/);
});

test('empty store opens empty', async () => {
  const r = await open(new Mem(), '');
  assert.equal(r.source, 'empty');
  assert.equal(r.snapshot, null);
});

test('autosave then restore', async () => {
  const s = new Mem();
  await save(s, tree());
  const r = await open(s, '');
  assert.equal(r.source, 'saved');
  assert.deepEqual(r.snapshot, tree());
});

test('link wins; differing saved tree is kept as recent', async () => {
  const s = new Mem();
  const savedFrag = await save(s, tree());
  const linkFrag = await encodeFragment(tree(true));
  const r = await open(s, '#' + linkFrag);
  assert.equal(r.source, 'link');
  assert.deepEqual(r.snapshot, tree(true));
  assert.deepEqual(r.recent, [savedFrag]);
  assert.equal(s.getItem(CURRENT_KEY), linkFrag);
});

test('same link as saved adds nothing to recent', async () => {
  const s = new Mem();
  const frag = await save(s, tree());
  const r = await open(s, '#' + frag);
  assert.deepEqual(r.recent, []);
});

test('bad link falls back to the saved tree and reports the error', async () => {
  const s = new Mem();
  await save(s, tree());
  const r = await open(s, '#v1.garbage');
  assert.equal(r.source, 'saved');
  assert.ok(r.error);
  assert.deepEqual(r.snapshot, tree());
});

test('corrupt saved data is ignored', async () => {
  const s = new Mem();
  s.setItem(RECENT_KEY, 'not json');
  s.setItem(CURRENT_KEY, 'junk');
  const r = await open(s, '#' + await encodeFragment(tree()));
  assert.equal(r.source, 'link');
  assert.deepEqual(r.recent, []);
});

test('root is kept when it is not "me"', async () => {
  const s = tree();
  s.me = 'b';
  assert.deepEqual(await decodeFragment(await encodeFragment(s)), s);
});

test('a tree without a root (older link or save) takes "me" as its root', async () => {
  const s = tree();
  delete s.tree.root;
  const back = await decodeFragment(await encodeFragment(s));
  assert.equal(back.tree.root, 'a');
  const empty = await decodeFragment(await encodeFragment({ me: null, tree: { version: 1, people: [], families: [] } }));
  assert.equal(empty.tree.root, undefined);
});

// The v1 encoder as it shipped, so old links stay covered after the switch to v2.
async function encodeV1(s: Snapshot): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(toWire(s)));
  const out = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return 'v1.' + Buffer.from(await new Response(out).arrayBuffer()).toString('base64url');
}

test('v1 links still open, unchanged', async () => {
  assert.deepEqual(await decodeFragment(await encodeV1(tree())), tree());
  const s = tree();
  s.me = 'b';
  assert.deepEqual(await decodeFragment(await encodeV1(s)), s);
  const noRoot = tree();
  delete noRoot.tree.root;
  assert.equal((await decodeFragment(await encodeV1(noRoot))).tree.root, 'a');
});

// A seeded generator: gaps in ids, odd ids, 0-2 parents, childless families, names in several scripts or none.
function randomTree(seed: number, n: number): Snapshot {
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const names = ['', 'Richard Lee', '陳嘉欣', 'Zoë', '👵 Ah Ma', 'O\'Brien-Smith', 'p7', ' spaced '];
  const ids = new Set<string>();
  const people = [];
  for (let i = 0; people.length < n; i++) {
    const id = rnd() < 0.1 ? `x-${i}` : rnd() < 0.05 ? `p0${i}` : `p${i * 2 + (rnd() < 0.5 ? 1 : 0) + 1}`;
    if (ids.has(id)) continue;
    ids.add(id);
    const name = names[Math.floor(rnd() * names.length)];
    people.push(name ? { id, sex: rnd() < 0.5 ? 'm' as const : 'f' as const, name } : { id, sex: rnd() < 0.5 ? 'm' as const : 'f' as const });
  }
  // Each person is a child in at most one family and a parent in at most one family.
  const free = people.map((p) => p.id);
  const kids = [...free].sort(() => rnd() - 0.5);
  const families = [];
  for (let f = 0; free.length && f < n; f++) {
    const np = Math.min(free.length, Math.floor(rnd() * 3));
    const parents = free.splice(0, np);
    const children = kids.filter((k) => !parents.includes(k)).splice(0, Math.floor(rnd() * 4));
    for (const c of children) kids.splice(kids.indexOf(c), 1);
    families.push({ id: rnd() < 0.1 ? `fam${f}` : `f${f + 3}`, parents, children });
  }
  const me = rnd() < 0.2 ? null : people[Math.floor(rnd() * n)].id;
  const root = rnd() < 0.3 ? undefined : people[Math.floor(rnd() * n)].id;
  return { me, tree: { version: 1, people, families, ...(root ? { root } : {}) } };
}

test('v2 round-trips random trees exactly, and matches what v1 gives back', async () => {
  let checked = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = randomTree(seed, 1 + (seed % 40));
    let v1: Snapshot;
    try { v1 = await decodeFragment(await encodeV1(s)); } catch { continue; } // the generator made an invalid tree
    assert.deepEqual(await decodeFragment(await encodeFragment(s)), v1, `seed ${seed}`);
    checked++;
  }
  assert.ok(checked > 100, `only ${checked} valid random trees`);
});

test('cut-short or padded v2 links are rejected', async () => {
  const f = await encodeFragment(tree());
  const raw = await new Response(new Blob([Buffer.from(f.slice(3), 'base64url')]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  const pack = async (b: Uint8Array) => 'v2.' + Buffer.from(await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()).toString('base64url');
  const bytes = new Uint8Array(raw);
  for (let cut = 0; cut < bytes.length; cut++) await assert.rejects(decodeFragment(await pack(bytes.subarray(0, cut))), /corrupt/);
  await assert.rejects(decodeFragment(await pack(Uint8Array.from([...bytes, 0]))), /corrupt/);
});

test('pets round-trip in the link, named or not, and cut-short pet links are rejected', async () => {
  const s = tree();
  s.tree.pets = [
    { id: 'a1', kind: 'dog', owner: 'a', name: 'Rex' },
    { id: 'a2', kind: 'guinea-pig', owner: 'b' },
    { id: 'pip', kind: 'cat', owner: 'a', name: '咪咪' },
  ];
  const f = await encodeFragment(s);
  assert.deepEqual(await decodeFragment(f), s);
  // A tree without pets is encoded exactly as before pets existed.
  assert.equal(await encodeFragment(tree()), await encodeFragment({ ...tree(), tree: { ...tree().tree, pets: [] } }));
  const raw = await new Response(new Blob([Buffer.from(f.slice(3), 'base64url')]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  const pack = async (b: Uint8Array) => 'v2.' + Buffer.from(await new Response(new Blob([b as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()).toString('base64url');
  const bytes = new Uint8Array(raw);
  for (let cut = 0; cut < bytes.length; cut++) await assert.rejects(decodeFragment(await pack(bytes.subarray(0, cut))), /corrupt/);
});
