import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPattern } from '../src/index.ts';
import type { Title } from '../src/index.ts';
import { expand, setup, titles, generic } from './helpers.ts';

const { table, r, spoken, formal } = setup('jpn', 'の');

test('Japanese table answers every path the Cantonese table does', () => {
  for (const e of titles('yue')) {
    for (const path of expand(e.pattern)) assert.ok(matchPattern(table, path), `no Japanese title for ${path}`);
  }
});

const all = (): Title[] => titles('jpn').flatMap(e => [
  e.formal, ...(e.spoken && e.spoken !== 'by-name' ? [e.spoken] : []),
  ...(e.older && e.younger ? [e.older.formal, e.younger.formal, ...(e.older.spoken !== 'by-name' ? [e.older.spoken] : [])] : []),
]);

test('Japanese: every title has a rōmaji reading, and any kanji comes with a kana reading', () => {
  for (const t of all()) {
    assert.ok(t.rom && /^[a-zāīūēō']+$/.test(t.rom), `${t.chars} reading`);
    if (/[一-鿿]/.test(t.chars)) assert.ok(t.kana && /^[ぁ-ゟー]+$/.test(t.kana), `${t.chars} kana`);
    if (t.kana !== undefined) assert.notEqual(t.kana, t.chars);
  }
});

test('Japanese: humble form to outsiders, home form for speaking', () => {
  assert.equal(formal('me', 'dad'), '父'); assert.equal(spoken('me', 'dad'), 'お父さん');
  assert.equal(formal('me', 'mum'), '母'); assert.equal(spoken('me', 'mum'), 'お母さん');
  const dad = r('me', 'dad');
  assert.ok(dad.kind === 'title');
  const said = dad.kind === 'title' ? dad.forms.spoken : 'by-name';
  assert.ok(said !== 'by-name');
  assert.deepEqual([said.kana, said.rom], ['おとうさん', 'otōsan']);
});

test('Japanese: 伯父 is older than the parent and 叔父 younger, both said おじさん', () => {
  assert.equal(formal('me', 'dadElderBro'), '伯父');
  assert.equal(formal('me', 'mumYoungerBro'), '叔父');
  assert.equal(formal('me', 'dadYoungerSis'), '叔母');
  assert.equal(spoken('me', 'dadElderBro'), 'おじさん');
  assert.equal(spoken('me', 'mumYoungerSis'), 'おばさん');
});

test('Japanese: the speaker\'s sex makes no difference', () => {
  assert.equal(spoken('elderSis', 'dadElderBro'), spoken('me', 'dadElderBro'));
  assert.equal(formal('wifeYoungerSis', 'wifeElderBro'), '兄');
  assert.equal(formal('me', 'elderSis'), '姉');
  assert.equal(spoken('me', 'youngerBro'), 'by-name');
});

test('Japanese: cousins are いとこ, with the older one called お兄ちゃん or お姉ちゃん', () => {
  const x = r('me', 'cousinA');
  assert.ok(x.kind === 'byAge');
  if (x.kind === 'byAge') {
    assert.equal(x.older.formal.chars, '従兄'); assert.equal(x.older.formal.kana, 'いとこ');
    assert.equal(x.younger.formal.chars, '従弟');
  }
});

test('Japanese: a fallback description joins with の and the generic title is おじさん', () => {
  const x = r('me', 'dadCousin');
  assert.ok(x.kind === 'fallback');
  assert.match(x.describe.text, /の/);
  const above = generic('jpn').above1.m;
  assert.equal(above !== 'by-name' && above.chars, 'おじさん');
});
