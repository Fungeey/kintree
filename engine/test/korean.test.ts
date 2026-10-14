import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchPattern } from '../src/index.ts';
import type { TitleEntry } from '../src/index.ts';
import { setup, titles } from './helpers.ts';

const { table, r, spoken, formal } = setup('kor', '의 ');

test('Korean table has every single-person path and a Revised Romanization reading on every title', () => {
  for (const p of ['F', 'M', 'S', 'D', 'H', 'W', 'Be', 'By', 'Ze', 'Zy', 'F F', 'M M', 'H F', 'W M']) assert.ok(matchPattern(table, p), p);
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (typeof o.chars === 'string') {
        assert.match(o.chars, /^[가-힣 ]+$/, o.chars);
        assert.match(String(o.rom), /^[a-z ]+$/, o.chars);
      }
      Object.values(o).forEach(walk);
    }
  };
  walk(titles('kor').map((e: TitleEntry) => [e.formal, e.spoken, e.older, e.younger, e.speaker]));
});

test('Korean: a man calls his older brother 형 and older sister 누나', () => {
  assert.equal(spoken('youngerBro', 'me'), '형');
  assert.equal(spoken('me', 'elderSis'), '누나');
});

test('Korean: a woman calls her older brother 오빠 and older sister 언니', () => {
  assert.equal(spoken('wifeYoungerSis', 'wifeElderBro'), '오빠');
  assert.equal(spoken('wifeYoungerSis', 'wife'), '언니');
});

test('Korean: the speaker\'s sex does not change younger siblings or parents', () => {
  assert.equal(spoken('me', 'youngerBro'), 'by-name');
  assert.equal(formal('me', 'youngerBro'), '남동생');
  assert.equal(formal('elderSis', 'youngerBro'), '남동생');
  assert.equal(spoken('elderSis', 'dad'), spoken('me', 'dad'));
  assert.equal(spoken('me', 'dad'), '아빠'); assert.equal(formal('me', 'dad'), '아버지');
});

test('Korean: sibling-in-law terms follow the speaker', () => {
  // A man's elder sister's husband is 매형; his elder brother's wife is 형수님.
  assert.equal(spoken('me', 'esHusband'), '매형');
  assert.equal(spoken('youngerBro', 'wife'), '형수님'); assert.equal(formal('youngerBro', 'wife'), '형수');
  // A woman's elder brother's wife is 새언니 (and 올케 in reference); her elder sister's husband is 형부.
  assert.equal(spoken('wifeYoungerSis', 'webWife'), '새언니'); assert.equal(formal('wifeYoungerSis', 'webWife'), '올케');
  // Spouse's family does not depend on the speaker's sex, only on whether the spouse is a husband or wife.
  assert.equal(spoken('me', 'wifeElderBro'), '형님'); assert.equal(formal('me', 'wifeElderBro'), '처남');
});

test('Korean: older cousins show 사촌 형/누나 to a man and 사촌 오빠/언니 to a woman', () => {
  const man = r('me', 'cousinA');
  const woman = r('elderSis', 'cousinA');
  assert.ok(man.kind === 'byAge' && woman.kind === 'byAge');
  if (man.kind === 'byAge' && woman.kind === 'byAge') {
    assert.equal(man.older.spoken !== 'by-name' && man.older.spoken.chars, '사촌 형');
    assert.equal(woman.older.spoken !== 'by-name' && woman.older.spoken.chars, '사촌 오빠');
    assert.equal(man.older.formal.chars, '친사촌 형');
    assert.equal(man.younger.formal.chars, woman.younger.formal.chars);
  }
  const sister = r('me', 'cousinB');
  assert.ok(sister.kind === 'byAge');
  assert.equal(sister.kind === 'byAge' && sister.older.spoken !== 'by-name' && sister.older.spoken.chars, '사촌 누나');
  const w = r('elderSis', 'cousinB');
  assert.equal(w.kind === 'byAge' && w.older.spoken !== 'by-name' && w.older.spoken.chars, '사촌 언니');
});

test('Korean: parents\' siblings and in-laws', () => {
  assert.equal(formal('me', 'dadElderBro'), '큰아버지');
  assert.equal(formal('me', 'dadYoungerSis'), '고모');
  assert.equal(formal('me', 'mumYoungerBro'), '외삼촌');
  assert.equal(formal('me', 'mumYoungerSis'), '이모');
  assert.equal(formal('me', 'wifeDad'), '장인'); assert.equal(spoken('me', 'wifeDad'), '아버님');
  assert.equal(formal('wife', 'wifeDad'), '아버지');
});

test('Korean: a relative with no entry falls back, and the generic older sibling follows the speaker', () => {
  // mother's younger sister's daughter's husband: no Korean term in this table.
  const man = r('me', 'cousinDHusband');
  const woman = r('elderSis', 'cousinDHusband');
  assert.ok(man.kind === 'fallback' && woman.kind === 'fallback');
  const older = (x: typeof man) => x.kind === 'fallback' && typeof x.generic === 'object' && 'older' in x.generic && x.generic.older !== 'by-name' ? x.generic.older.chars : '';
  assert.equal(older(man), '형');
  assert.equal(older(woman), '오빠');
});

test('Korean: a fallback description puts the nearest relative first and joins with 의', () => {
  const x = r('me', 'dadCousin');
  assert.ok(x.kind === 'fallback');
  assert.match(x.describe.text, /의 /);
});
