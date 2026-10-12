import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import {
  encodeChain, decodeChain, compactKey, parseKey, resolveChain, resolveParam, longToCompact, migrate7,
} from '../codec.js';
import { START, step } from '../kinship.js';
import { CHAINS, expandChain } from '../walk.js';
import { check } from '../check.js';

const load = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const terms = load('../terms.json');
const collapse = new Set(terms._collapse_sen);
const family = load('../family-terms.json')._families.sample;
const r = (c, fam = null) => resolveChain(c, terms, collapse, fam);
const chars = c => r(c).term?.yue.chars ?? null;

test('keys are 8 characters with the rank last', () => {
  assert.equal(r('MZo').key, '5Mf0o0--');
  assert.equal(r('MZo1').key, '5Mf0o0-1');
  assert.equal(r('FBy3W').key, '5Pf0y1-3');
  assert.equal(r('MZyL').key, '5Mf0y0-L');
});

test('rank round-trips through the chain codec', () => {
  for (const s of ['MZo1', 'FBy3W', 'MZyL', 'BoZy2', 'MBo', 'Ao']) {
    assert.equal(encodeChain(decodeChain(s)), s);
  }
  assert.deepEqual(decodeChain('MZo2'), [{ hop: 'mother' }, { hop: 'sister', sen: 'older', rank: '2' }]);
  assert.equal(encodeChain([{ hop: 'mother' }, { hop: 'sister', sen: 'younger', rank: 'last' }]), 'MZyL');
});

test('rank is rejected where it does not belong', () => {
  assert.throws(() => decodeChain('Ao1'), /does not take a rank/);
  assert.throws(() => encodeChain([{ hop: 'father', rank: '1' }]), /does not take a rank/);
  assert.throws(() => encodeChain([{ hop: 'sister', sen: 'older', rank: '0' }]), RangeError);
});

test('rank does not change the sourced term; family table adds the rank term', () => {
  assert.equal(chars('MZo1'), '姨媽');
  assert.equal(chars('MZy3'), '阿姨');
  assert.equal(r('MZo1').family, null);                       // no family table given
  assert.equal(r('MZo1', family).family.yue.chars, '大姨');
  assert.equal(r('MZy2', family).family.yue.chars, '二姨');  // sen wildcard in the family table
  assert.equal(r('MZyL', family).family.yue.chars, '細姨');
  assert.equal(r('MZo', family).family, null);                // no rank, no family term
  assert.equal(r('MBo1', family).family, null);               // family table has no entry
});

test('parseKey validates and round-trips', () => {
  for (const c of ['MZo1', 'WBoW', 'MPo', 'DS', 'FFZo', 'Ay']) {
    const k = compactKey((() => { let s = START; for (const h of decodeChain(c)) s = step(s, h.hop, h); return s; })());
    const p = parseKey(k);
    assert.equal(compactKey(p), k);
  }
  assert.throws(() => parseKey('5Mf0o0-'), /not a valid/);   // old 7-char key
  assert.throws(() => parseKey('5Xf0o0--'), /not a valid/);
  assert.equal(migrate7('5Mf0o0-'), '5Mf0o0--');
  assert.equal(longToCompact('g1|side=M|sex=f|lin=0|sen=older'), '5Mf0o0--');
  assert.equal(longToCompact('g1|side=M|sex=f|coll=1|sen=older|rank=last'), '5Mf0o0-L');
});

test('known issue: WBoW no longer collides with WZo', () => {
  assert.equal(chars('WZo'), '大姨');
  assert.notEqual(r('WBoW').key, r('WZo').key);
  assert.equal(r('WBoW').key, '4Wf0o2--');
  assert.equal(chars('WBoW'), null);                          // fallback until a term is sourced
  assert.notEqual(chars('HBoW'), '姑奶');
  assert.equal(chars('HZo'), '姑奶');
});

test('known issue: a cousin beyond the speaker keeps the line it was reached through', () => {
  assert.equal(chars('FBo'), '伯父');
  assert.notEqual(r('MPo').key, r('FBo').key);
  assert.equal(r('MPo').key, '5Mm2o0--');
  assert.equal(chars('MPo'), null);
  assert.equal(chars('Ao'), '表哥');                           // speaker's own cousins unchanged
  assert.equal(chars('Qy'), '堂細妹');
});

test('known issue: son\'s line and daughter\'s line are distinct', () => {
  assert.notEqual(r('SS').key, r('DS').key);
  assert.equal(chars('SS'), '孫');
  assert.equal(chars('SD'), '孫女');
  assert.equal(chars('DS'), '外孫');
  assert.equal(chars('DD'), '外孫女');
  assert.equal(chars('S'), '仔');
  assert.equal(chars('D'), '女');
  assert.equal(chars('SW'), '新抱');
  assert.equal(chars('DH'), '女婿');
});

test('migration keeps every original chain on its original term, except the fixed collisions', async () => {
  const oldK = await import('../original/kinship.js');
  const oldC = await import('../original/codec.js');
  const oldTerms = load('../original/terms.json');
  const oldCollapse = new Set(oldTerms._collapse_sen);
  const fixed = /^(husband|wife) > \w+:\w+ > (husband|wife)$|^daughter > (son|daughter)$/;
  let compared = 0;
  for (const chain of CHAINS) {
    for (const { path } of expandChain(chain)) {
      const p = path.join(' > ');
      if (fixed.test(p)) continue;
      let so = oldK.START;
      const code = encodeChain(path.map(l => { const [hop, sen] = l.split(':'); so = oldK.step(so, hop, { sen }); return { hop, sen }; }));
      const before = oldTerms[oldC.canonical(oldC.compactKey(so), oldCollapse)];
      if (!before) continue;
      assert.equal(chars(code), before.yue.chars, `${p} (${code})`);
      compared++;
    }
  }
  assert.ok(compared >= 80, `compared ${compared}`);
});

test('one bad chain does not break the parameter', () => {
  const out = resolveParam('MZo1,XX,Ao', terms, collapse);
  assert.equal(out.length, 3);
  assert.equal(out[0].term.yue.chars, '姨媽');
  assert.match(out[1].error, /unknown hop code/);
  assert.equal(out[2].term.yue.chars, '表哥');
});

test('term tables are consistent with the walker', () => {
  const { errors } = check();
  assert.deepEqual(errors, []);
});
