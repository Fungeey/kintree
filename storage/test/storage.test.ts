import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFragment, decodeFragment, save, open, CURRENT_KEY, RECENT_KEY } from '../src/index.ts';
import type { KV, Snapshot } from '../src/index.ts';

const tree = (extra = false): Snapshot => ({
  me: 'a',
  tree: {
    version: 1,
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
  assert.match(f, /^v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeFragment('#' + f), tree());
});

test('empty tree with no me round trips', async () => {
  const s: Snapshot = { me: null, tree: { version: 1, people: [], families: [] } };
  assert.deepEqual(await decodeFragment(await encodeFragment(s)), s);
});

test('unknown version, junk and invalid trees are rejected', async () => {
  await assert.rejects(decodeFragment('v2.abc'), /unsupported link version 2/);
  await assert.rejects(decodeFragment('hello'), /version/);
  await assert.rejects(decodeFragment('v1.!!!'), /corrupt|base64/);
  await assert.rejects(decodeFragment('v1.AAAA'), /corrupt/);
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
