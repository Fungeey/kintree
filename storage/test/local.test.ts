import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeFile, decodeFile, encodeFragment, decodeFragment, detailsOf, readDetails, saveDetails, applyDetails,
  readNotes, setNote, pruneNotes, clearAll, MAX_NOTE, DETAILS_PREFIX, NOTES_PREFIX,
} from '../src/index.ts';
import type { KVAll, Snapshot } from '../src/index.ts';

class Mem implements KVAll {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}

const snap = (): Snapshot => ({
  me: 'p1', treeId: 'tabc12345',
  tree: {
    version: 1, root: 'p1',
    people: [{ id: 'p1', sex: 'f', name: 'Mei', born: 1952 }, { id: 'p2', sex: 'm' }, { id: 'p3', sex: 'f', born: 1980 }],
    families: [{ id: 'f1', parents: ['p1', 'p2'], children: ['p3'] }],
  },
});

test('birth years travel in the file but not in the link', async () => {
  const s = snap();
  assert.deepEqual(decodeFile(encodeFile(s)), s);
  const viaLink = await decodeFragment(await encodeFragment(s));
  assert.equal(viaLink.tree.people.some((p) => p.born !== undefined), false);
  assert.equal(viaLink.tree.people[0].name, 'Mei');
  assert.equal(viaLink.treeId, 'tabc12345');
});

test('a file with a bad birth year is refused', () => {
  const j = JSON.parse(encodeFile(snap()));
  for (const bad of [999, 10000, 1950.5, '1950', null]) {
    j.tree.people[0].born = bad;
    assert.throws(() => decodeFile(JSON.stringify(j)), /birth year/);
  }
});

test('details: saved per tree id, put back after a link opens the tree, and only for people still there', () => {
  const kv = new Mem();
  const s = snap();
  saveDetails(kv, 'tabc12345', s.tree);
  assert.deepEqual(readDetails(kv, 'tabc12345'), { p1: { born: 1952 }, p3: { born: 1980 } });
  assert.deepEqual(readDetails(kv, 'tother999'), {});
  const noYears = { ...s.tree, people: s.tree.people.map(({ born: _b, ...p }) => p) };
  assert.deepEqual(applyDetails(noYears, readDetails(kv, 'tabc12345')).people, s.tree.people);
  const without = { ...noYears, people: noYears.people.filter((p) => p.id !== 'p3'), families: [] };
  assert.equal(applyDetails(without, readDetails(kv, 'tabc12345')).people.find((p) => p.id === 'p3'), undefined);
  assert.equal(applyDetails(noYears, {}), noYears);
});

test('details: clearing every year removes the key; junk saved data is ignored', () => {
  const kv = new Mem();
  const s = snap();
  saveDetails(kv, 't1', s.tree);
  assert.ok(kv.getItem(DETAILS_PREFIX + 't1'));
  saveDetails(kv, 't1', { ...s.tree, people: s.tree.people.map(({ born: _b, ...p }) => p) });
  assert.equal(kv.getItem(DETAILS_PREFIX + 't1'), null);
  kv.setItem(DETAILS_PREFIX + 't2', '{"p1":{"born":"x"},"p2":5,"p3":{"born":1999}}');
  assert.deepEqual(readDetails(kv, 't2'), { p3: { born: 1999 } });
  kv.setItem(DETAILS_PREFIX + 't3', 'not json');
  assert.deepEqual(readDetails(kv, 't3'), {});
  assert.deepEqual(detailsOf(s.tree), { p1: { born: 1952 }, p3: { born: 1980 } });
});

test('notes: per tree and person, trimmed to the limit, deleted when emptied, pruned with the person', () => {
  const kv = new Mem();
  assert.ok(setNote(kv, 't1', 'p1', 'Makes turnip cake'));
  assert.ok(setNote(kv, 't1', 'p2', 'x'.repeat(MAX_NOTE + 50)));
  assert.ok(setNote(kv, 't2', 'p1', 'another tree, another note'));
  assert.equal(readNotes(kv, 't1').p1, 'Makes turnip cake');
  assert.equal(readNotes(kv, 't1').p2.length, MAX_NOTE);
  assert.equal(readNotes(kv, 't2').p1, 'another tree, another note');
  pruneNotes(kv, 't1', snap().tree);              // p2 is in the tree, so both stay
  assert.deepEqual(Object.keys(readNotes(kv, 't1')), ['p1', 'p2']);
  pruneNotes(kv, 't1', { ...snap().tree, people: [snap().tree.people[0]], families: [] });
  assert.deepEqual(Object.keys(readNotes(kv, 't1')), ['p1']);
  assert.ok(setNote(kv, 't1', 'p1', '   '));
  assert.equal(kv.getItem(NOTES_PREFIX + 't1'), null);
});

test('notes: a store that refuses writes reports it', () => {
  const kv = new Mem();
  kv.setItem = () => { throw new Error('quota'); };
  assert.equal(setNote(kv, 't1', 'p1', 'hello'), false);
});

test('notes are not in the file, the link or the details', async () => {
  const kv = new Mem();
  setNote(kv, 'tabc12345', 'p1', 'private words');
  const s = snap();
  assert.ok(!encodeFile(s).includes('private words'));
  assert.ok(!JSON.stringify(detailsOf(s.tree)).includes('private'));
});

test('clear this device removes everything Kintree keeps and nothing else', () => {
  const kv = new Mem();
  kv.setItem('kinship:current', 'v3.x');
  kv.setItem('kinship:lang', 'yue');
  setNote(kv, 't1', 'p1', 'hi');
  saveDetails(kv, 't1', snap().tree);
  kv.setItem('other-site:key', 'keep');
  clearAll(kv);
  assert.deepEqual(kv.keys(), ['other-site:key']);
});
