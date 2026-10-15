import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFragment, decodeFragment, encodeFile, decodeFile, adopt, open, save, newTreeId, isTreeId, CURRENT_KEY, RECENT_KEY } from '../src/index.ts';
import type { KV, Snapshot } from '../src/index.ts';

const snap = (treeId?: string): Snapshot => ({
  me: 'p2',
  ...(treeId ? { treeId } : {}),
  tree: {
    version: 1,
    root: 'p1',
    people: [
      { id: 'p1', sex: 'm', name: '阿明' }, { id: 'p2', sex: 'f', name: 'Zoë' },
      { id: 'p3', sex: 'm' }, { id: 'p4', sex: 'f' },
    ],
    families: [{ id: 'f1', parents: ['p3', 'p4'], children: ['p1', 'p2'] }],
    pets: [{ id: 'a1', kind: 'cat', owner: 'p1', name: 'Mimi' }],
  },
});

class Mem implements KV {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

test('a file round-trips the tree, me, pets and tree id', () => {
  const s = snap('t4k9z2ab');
  assert.deepEqual(decodeFile(encodeFile(s)), s);
  assert.deepEqual(decodeFile(encodeFile(snap())), snap());
  const empty: Snapshot = { me: null, tree: { version: 1, people: [], families: [] } };
  assert.deepEqual(decodeFile(encodeFile(empty)), empty);
});

test('the file is readable JSON with the documented shape and an empty photos map', () => {
  const j = JSON.parse(encodeFile(snap('t4k9z2ab'), new Date('2026-10-15T04:40:00Z')));
  assert.equal(j.kintree, 1);
  assert.equal(j.saved, '2026-10-15T04:40:00.000Z');
  assert.equal(j.me, 'p2');
  assert.equal(j.treeId, 't4k9z2ab');
  assert.deepEqual(j.photos, {});
  assert.equal(j.tree.people.length, 4);
});

test('unknown fields are ignored, and a name that is not a string is refused', () => {
  const j = JSON.parse(encodeFile(snap()));
  j.future = { x: 1 };
  j.tree.people[0].nickname = 'Ah Ming';
  j.tree.people[0].extra = '<img onerror=alert(1)>';
  assert.deepEqual(decodeFile(JSON.stringify(j)), snap());
  j.tree.people[1].name = 7;
  assert.deepEqual(decodeFile(JSON.stringify(j)).tree.people[1], { id: 'p2', sex: 'f' });
});

test('files that are not Kintree files, or are broken, are refused with a readable error', () => {
  assert.throws(() => decodeFile('hello'), /not a Kintree file/);
  assert.throws(() => decodeFile('[]'), /not a Kintree file/);
  assert.throws(() => decodeFile('{"a":1}'), /not a Kintree file/);
  assert.throws(() => decodeFile(JSON.stringify({ kintree: 2, tree: {} })), /newer version/);
  assert.throws(() => decodeFile(JSON.stringify({ kintree: 1 })), /no tree/);
  const bad = (edit: (j: any) => void, re: RegExp) => {
    const j = JSON.parse(encodeFile(snap()));
    edit(j);
    assert.throws(() => decodeFile(JSON.stringify(j)), re);
  };
  bad((j) => { j.me = 'zzz'; }, /not in the tree/);
  bad((j) => { j.me = 5; }, /corrupt/);
  bad((j) => { j.treeId = 'Not Valid!'; }, /tree id/);
  bad((j) => { j.tree.people[3].id = 'p1'; }, /duplicate person/);
  bad((j) => { j.tree.people[0].sex = 'x'; }, /corrupt/);
  bad((j) => { j.tree.families[0].children = ['nobody']; }, /unknown person/);
  bad((j) => { j.tree.families[0] = null; }, /corrupt/);
  bad((j) => { j.tree.pets[0].kind = 'dragon'; }, /bad kind/);
});

test('a file with no root takes "me" as its root, like an older link', () => {
  const j = JSON.parse(encodeFile(snap()));
  delete j.tree.root;
  assert.equal(decodeFile(JSON.stringify(j)).tree.root, 'p2');
});

test('tree ids: made fresh, and checked', () => {
  const a = newTreeId();
  assert.match(a, /^t[a-z0-9]{8}$/);
  assert.ok(isTreeId(a));
  assert.notEqual(a, newTreeId());
  for (const bad of ['', 'T1', 'a b', 'x'.repeat(33), 5, null]) assert.ok(!isTreeId(bad));
  assert.rejects(encodeFragment(snap('NO!')), /bad tree id/);
  assert.throws(() => encodeFile(snap('NO!')), /bad tree id/);
});

test('a tree id rides in the link (v3) and links without one stay v2', async () => {
  const withId = await encodeFragment(snap('t4k9z2ab'));
  assert.match(withId, /^v3\./);
  assert.deepEqual(await decodeFragment(withId), snap('t4k9z2ab'));
  const plain = await encodeFragment(snap());
  assert.match(plain, /^v2\./);
  assert.deepEqual(await decodeFragment(plain), snap());
});

test('a v2 link cannot carry the tree id flag, and a cut-short v3 link is refused', async () => {
  const v3 = await encodeFragment(snap('t4k9z2ab'));
  await assert.rejects(decodeFragment('v2.' + v3.slice(3)), /corrupt/);
  await assert.rejects(decodeFragment(v3.slice(0, -6)), /corrupt/);
});

test('opening a file keeps the replaced tree as recent', async () => {
  const s = new Mem();
  const old = await save(s, snap('told00001'));
  const { fragment, recent } = await adopt(s, snap('tnew00002'));
  assert.deepEqual(recent, [old]);
  assert.equal(s.getItem(CURRENT_KEY), fragment);
  assert.equal(JSON.parse(s.getItem(RECENT_KEY)!)[0], old);
  const r = await open(s, '#' + fragment);
  assert.deepEqual(r.snapshot, snap('tnew00002'));
  assert.deepEqual(r.recent, [old]);
});

test('opening the same tree again, or with nothing saved, adds nothing to recent; junk saved data is not kept', async () => {
  const s = new Mem();
  assert.deepEqual((await adopt(s, snap('tsame0001'))).recent, []);
  assert.deepEqual((await adopt(s, snap('tsame0001'))).recent, []);
  s.setItem(CURRENT_KEY, 'junk');
  assert.deepEqual((await adopt(s, snap('tsame0002'))).recent, []);
});
