import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addPerson, emptyTree } from '../../engine/src/index.ts';
import { encodeFile, decodeFile, newTreeId } from '../../storage/src/index.ts';
import { fileNameFor } from '../src/fileIO.ts';
import { openApp, persist, shareUrl } from '../src/persist.ts';

function snap(name = 'Mei') {
  const a = addPerson(emptyTree(), 'f', name);
  const b = addChild(a.tree, a.id, 'm', 'Kid');
  return { tree: b.tree, me: b.id };
}

test('file names come from the root person and lose characters file systems reject', () => {
  assert.equal(fileNameFor(snap().tree), 'Mei family.kintree');
  assert.equal(fileNameFor(snap('陳 嘉欣').tree), '陳 嘉欣 family.kintree');
  assert.equal(fileNameFor(snap('a/b:c*d?').tree), 'abcd family.kintree');
  assert.equal(fileNameFor(snap('/ \\').tree), 'Family tree.kintree');
  assert.equal(fileNameFor(emptyTree()), 'Family tree.kintree');
});

test('what the app saves is what it opens, and the tree id survives the link too', async () => {
  const s = { ...snap(), treeId: newTreeId() };
  assert.deepEqual(decodeFile(encodeFile(s)), s);
  const url = await shareUrl(s, { origin: 'https://x.test', pathname: '/kintree/' });
  const opened = await openApp(null, url.slice(url.indexOf('#')));
  assert.deepEqual(opened.snapshot, s);
});

test('autosave and the address bar carry the tree id', async () => {
  const s = { ...snap(), treeId: 'tabc12345' };
  let hash = '';
  await persist(null, s, f => { hash = f; });
  assert.match(hash, /^v3\./);
  assert.equal((await openApp(null, '#' + hash)).snapshot?.treeId, 'tabc12345');
});
