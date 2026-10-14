import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPattern } from '../src/index.ts';
import { expand, setup, titles } from './helpers.ts';

const { table, r, spoken, formal } = setup('tgl', ' ng ', true);

test('Tagalog table answers every path the Cantonese table does', () => {
  for (const e of titles('yue')) {
    for (const path of expand(e.pattern)) assert.ok(matchPattern(table, path), `no Tagalog title for ${path}`);
  }
});

test('Tagalog table is Latin script with no reading field', () => {
  const all = JSON.stringify(titles('tgl'));
  assert.ok(!all.includes('"rom"'));
  assert.ok(!/[぀-鿿가-힯]/.test(all));
});

test('Tagalog: tito and tita whatever the age or side, lolo and lola for grandparents', () => {
  assert.equal(spoken('me', 'dadElderBro'), 'tito');
  assert.equal(spoken('me', 'dadYoungerSis'), 'tita');
  assert.equal(spoken('me', 'mumYoungerBro'), 'tito');
  assert.equal(spoken('me', 'yeye'), 'lolo');
  assert.equal(formal('me', 'maama'), 'lola sa ama');
  assert.equal(spoken('me', 'dad'), 'tatay');
});

test('Tagalog: elder siblings are kuya and ate, younger ones are called by name', () => {
  assert.equal(spoken('me', 'elderSis'), 'ate');
  assert.equal(spoken('youngerBro', 'me'), 'kuya');
  assert.equal(spoken('me', 'youngerBro'), 'by-name');
});

test('Tagalog: cousins are pinsan, older ones kuya or ate', () => {
  const x = r('me', 'cousinA');
  assert.ok(x.kind === 'byAge');
  assert.equal(x.kind === 'byAge' && x.older.spoken !== 'by-name' ? x.older.spoken.chars : '', 'kuya');
  assert.equal(x.kind === 'byAge' ? x.older.formal.chars : '', 'pinsan');
});

test('Tagalog: a fallback description puts the nearest relative last, joined with "ng"', () => {
  const x = r('me', 'dadCousin');
  assert.ok(x.kind === 'fallback');
  assert.match(x.describe.text, / ng /);
});
