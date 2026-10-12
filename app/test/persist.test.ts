import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addChild, addPerson, emptyTree } from '../../engine/src/index.ts';
import { openApp, persist, shareUrl } from '../src/persist.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

function snap() {
  const a = addPerson(emptyTree(), 'm', 'Me');
  const b = addChild(a.tree, a.id, 'f', 'Kid');
  return { tree: b.tree, me: b.id };
}

test('copied link reopens the same tree and me, and wins over a saved tree', async () => {
  const s = snap();
  const url = await shareUrl(s, { origin: 'https://x.test', pathname: '/app/' });
  const hash = url.slice(url.indexOf('#'));
  const other = mem();
  await persist(other, { tree: addPerson(emptyTree(), 'f', 'Other').tree, me: null }, () => {});
  const o = await openApp(other, hash);
  assert.equal(o.source, 'link');
  assert.deepEqual(o.snapshot, s);
});

test('bad link falls back to the saved tree and reports the error', async () => {
  const store = mem();
  const s = snap();
  let frag = '';
  await persist(store, s, f => { frag = f; });
  const o = await openApp(store, '#v1.garbage!');
  assert.equal(o.source, 'saved');
  assert.deepEqual(o.snapshot, s);
  assert.ok(o.error);
  assert.equal(frag.startsWith('v1.'), true);
});

test('no storage: a link still opens', async () => {
  const s = snap();
  const url = await shareUrl(s, { origin: 'https://x.test', pathname: '/' });
  const o = await openApp(null, url.slice(url.indexOf('#')));
  assert.deepEqual(o.snapshot, s);
});
