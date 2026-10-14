import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLang, langFor, saveLang } from '../src/lang.ts';
import { showFor } from '../src/display.ts';
import { shareUrl } from '../src/persist.ts';
import { addChild, addPerson, addSibling, emptyTree } from '../../engine/src/index.ts';

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

test('Japanese, Korean and Tagalog are in the picker list and load', async () => {
  const { LANG_IDS } = await import('../src/lang.ts');
  for (const id of ['jpn', 'kor', 'tgl'] as const) assert.ok(LANG_IDS.includes(id), id);
  assert.equal(langFor('jpn').joiner, 'の');
  assert.equal(langFor('kor').joiner, '의 ');
  assert.equal(langFor('tgl').reverse, true);
  assert.equal(initialLang('?lang=jpn', null), 'jpn');
  assert.equal(initialLang('?lang=kor', null), 'kor');
  assert.equal(initialLang('?lang=tgl', null), 'tgl');
});

test('Japanese: a card shows the humble term with its kana and rōmaji, and speaks the kana', async () => {
  const { spokenText } = await import('../src/audio/speech.ts');
  const a = addPerson(emptyTree(), 'm', 'Me');
  const dad = addChild(a.tree, a.id, 'm');
  const up = showFor(dad.tree, dad.id, a.id, 'jpn');
  assert.deepEqual([up.lines[0].chars, up.lines[0].kana, up.lines[0].rom], ['お父さん', 'おとうさん', 'otōsan']);
  assert.equal(up.formal?.chars, '父');
  assert.equal(spokenText(up, 'jpn'), 'おとうさん');
  assert.deepEqual(showFor(dad.tree, a.id, a.id, 'jpn').lines[0], { chars: '私', rom: 'watashi', kana: 'わたし' });
});

test('Korean: the same older brother is 형 to a man and 오빠 to a woman', () => {
  const bro = addPerson(emptyTree(), 'm', 'Bro');
  const man = addSibling(bro.tree, bro.id, 'm', 'Younger');          // youngest by default
  const woman = addSibling(man.tree, bro.id, 'f', 'Younger sister');
  assert.equal(showFor(woman.tree, man.id, bro.id, 'kor').lines[0].chars, '형');
  assert.equal(showFor(woman.tree, woman.id, bro.id, 'kor').lines[0].chars, '오빠');
  assert.equal(showFor(woman.tree, woman.id, bro.id, 'kor').lines[0].rom, 'oppa');
  assert.equal(showFor(woman.tree, man.id, bro.id, 'kor').formal, undefined);   // same word, nothing underneath
});

test('Korean, Japanese and Tagalog voices are found by language tag, in the Android and desktop spellings', async () => {
  const { pickVoice } = await import('../src/audio/speech.ts');
  assert.equal(pickVoice([{ lang: 'ja_JP', name: 'a' }, { lang: 'zh_CN', name: 'b' }], 'jpn')?.name, 'a');
  assert.equal(pickVoice([{ lang: 'ko-KR', name: 'Yuna' }], 'kor')?.name, 'Yuna');
  assert.equal(pickVoice([{ lang: 'fil_PH', name: 'f' }], 'tgl')?.name, 'f');
  assert.equal(pickVoice([{ lang: 'tl-PH', name: 't' }], 'tgl')?.name, 't');
  assert.equal(pickVoice([{ lang: 'zh-CN', name: 'c' }], 'kor'), undefined);
});

test('"none" (names only) opens from ?lang=none and is remembered like a language', async () => {
  const { headingFor } = await import('../src/lang.ts');
  const store = mem();
  assert.equal(initialLang('?lang=none', store), 'none');
  saveLang(store, 'none');
  assert.equal(initialLang('', store), 'none');
  assert.equal(headingFor('none'), 'Kinship');
  const a = addPerson(emptyTree(), 'm', 'Me');
  assert.match(await shareUrl({ tree: a.tree, me: a.id }, { origin: 'https://x.test', pathname: '/' }, 'none'), /\?lang=none#v/);
});
