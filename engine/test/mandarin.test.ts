import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addParent, addPerson, addSibling, emptyTree, loadTable, rankTitle, resolve, RANK_CMN } from '../src/index.ts';
import type { Generic, Resolution, TitleEntry, Tree } from '../src/index.ts';
import { tree } from './fixture.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const yue: TitleEntry[] = load('../data/yue/titles.json');
const cmn: TitleEntry[] = load('../data/cmn/titles.json');
const generic: Generic = load('../data/cmn/generic.json');
const table = loadTable(cmn);
const r = (me: string, target: string): Resolution => resolve(tree, table, generic, me, target, '的');
const spoken = (me: string, target: string): string => {
  const x = r(me, target);
  assert.equal(x.kind, 'title');
  return x.kind === 'title' && x.forms.spoken !== 'by-name' ? x.forms.spoken.chars : 'by-name';
};

test('Mandarin table covers exactly the patterns the Cantonese table does', () => {
  assert.deepEqual(cmn.map(e => e.pattern), yue.map(e => e.pattern));
  for (const [i, e] of cmn.entries()) {
    assert.equal(e.en, yue[i].en, e.pattern);
    assert.equal(Boolean(e.older), Boolean(yue[i].older), `${e.pattern} byAge-ness`);
  }
});

test('Mandarin table is simplified characters with pinyin', () => {
  const titles = cmn.flatMap(e => [e.formal, ...(e.older && e.younger ? [e.older.formal, e.younger.formal] : [])]);
  for (const t of titles) assert.ok(t.rom, `${t.chars} has pinyin`);
  const all = JSON.stringify(cmn);
  for (const trad of ['爺', '嫲', '嬸', '舅父', '媽', '姊', '孫', '婦', '曾祖', '嘅']) {
    if (trad === '舅父' || trad === '曾祖') continue;   // shared with simplified
    assert.ok(!all.includes(trad), `no traditional form ${trad}`);
  }
  assert.ok(!/[a-z]\d/.test(all.replace(/"pattern":"[^"]*"/g, '')), 'no jyutping tone numbers');
});

test('Mandarin: spoken titles for the fixture family', () => {
  assert.equal(spoken('me', 'dad'), '爸爸');
  assert.equal(spoken('me', 'dadElderBro'), '伯伯');
  const cousin = r('me', 'cousinA');
  assert.equal(cousin.kind, 'byAge');
  assert.ok(cousin.kind === 'byAge' && /^[堂表]/.test(cousin.older.formal.chars));
});

test('Mandarin: fallback uses 的 and the mainland generic title', () => {
  const x = r('me', 'dadCousin');   // F F Be S
  assert.ok(x.kind === 'fallback');
  assert.deepEqual(x.generic, { chars: '叔叔', rom: 'shūshu' });
  assert.deepEqual(x.describe, { text: '父亲的堂兄弟', en: "father's paternal cousin" });
});

function aunts() {
  let t: Tree = emptyTree();
  const me = addPerson(t, 'm', 'Me'); t = me.tree;
  const mum = addParent(t, me.id, 'f'); t = mum.tree;
  const a = addSibling(t, mum.id, 'f', 'A', 0); t = a.tree;
  const b = addSibling(t, mum.id, 'f', 'B'); t = b.tree;
  return { t, me: me.id, a: a.id, b: b.id };
}

test('Mandarin rank titles: 大姨, 二姨 with pinyin', () => {
  const { t, me, a, b } = aunts();
  assert.deepEqual(rankTitle(t, me, a, RANK_CMN), { chars: '大姨', rom: 'dàyí' });
  assert.deepEqual(rankTitle(t, me, b, RANK_CMN), { chars: '二姨', rom: 'èryí' });
});
