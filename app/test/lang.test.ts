import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLang, langFor, saveLang } from '../src/lang.ts';
import { showFor } from '../src/display.ts';
import { shareUrl } from '../src/persist.ts';
import { addChild, addPerson, emptyTree } from '../../engine/src/index.ts';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('initialLang: ?lang= wins, then the saved choice, then Cantonese', () => {
  const store = mem();
  assert.equal(initialLang('', store), 'yue');
  saveLang(store, 'cmn');
  assert.equal(initialLang('', store), 'cmn');
  assert.equal(initialLang('?lang=yue', store), 'yue');
  assert.equal(initialLang('?lang=nonsense', store), 'cmn');
  assert.equal(initialLang('?lang=cmn', null), 'cmn');
  assert.equal(initialLang('', null), 'yue');
});

test('both languages load', () => {
  assert.equal(langFor('yue').joiner, '嘅');
  assert.equal(langFor('cmn').joiner, '的');
});

test('showFor in Mandarin gives simplified titles with pinyin', () => {
  const a = addPerson(emptyTree(), 'm', 'Me');
  const dad = addChild(a.tree, a.id, 'm');   // a child, so the other direction is the parent
  const t = dad.tree;
  const kid = showFor(t, a.id, dad.id, 'cmn');
  assert.equal(kid.kind, 'title');
  const up = showFor(t, dad.id, a.id, 'cmn');
  assert.equal(up.lines[0].chars, '爸爸');
  assert.equal(up.lines[0].rom, 'bàba');
  assert.equal(showFor(t, a.id, a.id, 'cmn').lines[0].rom, 'wǒ');
  assert.equal(showFor(t, dad.id, a.id, 'yue').lines[0].rom, 'baa4 baa1');
});

test('copy link carries ?lang= for any chosen language', async () => {
  const a = addPerson(emptyTree(), 'm', 'Me');
  const s = { tree: a.tree, me: a.id };
  const base = { origin: 'https://x.test', pathname: '/app/' };
  assert.ok(!(await shareUrl(s, base)).includes('?'));
  assert.match(await shareUrl(s, base, 'yue'), /^https:\/\/x\.test\/app\/\?lang=yue#v/);
  assert.match(await shareUrl(s, base, 'cmn'), /^https:\/\/x\.test\/app\/\?lang=cmn#v/);
});

test('Vietnamese: no reading, title alone, vi-VN voice, own heading', async () => {
  const { pickVoice } = await import('../src/audio/speech.ts');
  const a = addPerson(emptyTree(), 'm', 'Me');
  const dad = addChild(a.tree, a.id, 'm');
  const up = showFor(dad.tree, dad.id, a.id, 'vie');
  assert.equal(up.lines[0].chars, 'bố');
  assert.equal(up.lines[0].rom, undefined);
  assert.equal(showFor(dad.tree, a.id, a.id, 'vie').lines[0].chars, 'tôi');
  assert.equal(langFor('vie').romanized, false);
  assert.equal(pickVoice([{ lang: 'zh_CN_#Hans', name: 'c' }, { lang: 'vi_VN', name: 'Vietnamese Vietnam' }], 'vie')?.name, 'Vietnamese Vietnam');
  assert.equal(pickVoice([{ lang: 'zh_CN_#Hans', name: 'c' }], 'vie'), undefined);
});
