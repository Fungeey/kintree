import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateTree, kinPath, loadTable, matchPattern, resolve, emptyTree, addPerson, addParent, addSibling, addChild, addSpouse } from '../src/index.ts';
import type { TitleEntry, Generic, Resolution, Tree } from '../src/index.ts';
import { tree } from './fixture.ts';

const load = (f: string) => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const entries: TitleEntry[] = load('../data/titles.json');
const generic: Generic = load('../data/generic.json');
const table = loadTable(entries);
const r = (me: string, target: string): Resolution => resolve(tree, table, generic, me, target);
const formal = (me: string, target: string): string => {
  const x = r(me, target);
  assert.equal(x.kind, 'title', `${me} -> ${target} gave ${x.kind}`);
  return x.kind === 'title' ? x.forms.formal.chars : '';
};

test('fixture tree is valid', () => {
  validateTree(tree);
});

test('validateTree rejects bad trees', () => {
  const base = structuredClone(tree);
  const bad = (mut: (t: Tree) => void) => { const t = structuredClone(base); mut(t); return () => validateTree(t); };
  assert.throws(bad(t => t.families[0].parents.push('yeye', 'maama')));                    // 4 parents
  assert.throws(bad(t => t.families.push({ id: 'x', parents: [], children: ['me'] })));    // child in two families
  assert.throws(bad(t => t.families.push({ id: 'x', parents: ['me'], children: [] })));    // parent in two families
  assert.throws(bad(t => t.families[0].children.push('nobody')));                          // unknown id
  assert.throws(bad(t => t.people.push({ id: 'me', sex: 'm' })));                          // duplicate id
  assert.throws(bad(t => t.families.push({ id: 'x', parents: ['stranger'], children: ['stranger'] })));
});

test('kinPath: tokens, ages and unknown parents', () => {
  const cases: [string, string, string][] = [
    ['me', 'dad', 'F'], ['me', 'elderSis', 'Ze'], ['me', 'youngerBro', 'By'],
    ['me', 'dadElderBro', 'F Be'], ['me', 'dadYoungerSis', 'F Zy'],
    ['me', 'mumYoungerBro', 'M By'],               // through a family with unknown parents
    ['me', 'cousinA', 'F Be S'], ['me', 'cousinC', 'F Zy S'],
    ['me', 'dadCousin', 'F F Be S'],
    ['me', 'wifeGrandma', 'W M M'],
    ['me', 'greatGrandson', 'S S S'],
    ['me', 'me', ''],
    ['wife', 'dad', 'H F'], ['son', 'wifeDad', 'M F'], ['son', 'daughter', 'Zy'],
    ['daughter', 'son', 'Be'],
  ];
  for (const [me, t, path] of cases) assert.equal(kinPath(tree, me, t), path, `${me} -> ${t}`);
  assert.equal(kinPath(tree, 'me', 'stranger'), null);
});

test('kinPath: ties prefer fewer marriages, then F<M<B<Z<S<D<H<W', () => {
  // wifeYoungerSis is both "W Zy" and "By W"; both 2 tokens with 1 marriage; B sorts before W.
  assert.equal(kinPath(tree, 'me', 'wifeYoungerSis'), 'By W');
  // mum is "M", never "F W"; a sibling is "Be", never "F S".
  assert.equal(kinPath(tree, 'me', 'mum'), 'M');
  assert.equal(kinPath(tree, 'esSon', 'me'), 'M By');
  assert.equal(kinPath(tree, 'wife', 'youngerBro'), 'Zy H');
});

test('titles from me', () => {
  assert.equal(formal('me', 'dadElderBro'), '伯父');
  assert.equal(formal('me', 'dadYoungerSis'), '姑姐');
  assert.equal(formal('me', 'mumYoungerBro'), '舅父');        // via "M B*"
  assert.equal(formal('me', 'mumYoungerSis'), '阿姨');
  assert.equal(formal('me', 'bomu'), '伯娘');
  assert.equal(formal('me', 'guzheung'), '姑丈');
  assert.equal(formal('me', 'jizheung'), '姨丈');
  assert.equal(formal('me', 'yeye'), '爺爺');
  assert.equal(formal('me', 'wifeDad'), '外父');
  assert.equal(formal('me', 'wifeElderBro'), '大舅');
  assert.equal(formal('me', 'wifeYoungerSis'), '弟婦');       // tie-break above
  assert.equal(formal('me', 'esHusband'), '姐夫');
  assert.equal(formal('me', 'esSon'), '外甥');
  assert.equal(formal('me', 'sonWife'), '新抱');
  assert.equal(formal('me', 'dauHusband'), '女婿');
  assert.equal(formal('me', 'grandson'), '孫');
  assert.equal(formal('me', 'dauSon'), '外孫');               // son's line and daughter's line differ
});

test('gap entries: in-law grandparents and cousins\' spouses', () => {
  assert.equal(formal('me', 'wifeGrandma'), '外婆');           // W M M
  const x = r('me', 'cousinDHusband');                         // M Zy D H
  assert.ok(x.kind === 'byAge' && x.older.formal.chars === '表姐夫' && x.younger.formal.chars === '表妹夫');
});

test('spoken forms and by-name', () => {
  const x = r('me', 'dadElderBro');
  assert.ok(x.kind === 'title' && x.forms.spoken !== 'by-name' && x.forms.spoken.chars === '伯伯');
  const y = r('me', 'son');
  assert.ok(y.kind === 'title' && y.forms.spoken === 'by-name' && y.forms.formal.chars === '仔');
});

test('switching me: same tree, other viewpoints', () => {
  assert.equal(formal('wife', 'dad'), '老爺');
  assert.equal(formal('wife', 'mum'), '奶奶');
  assert.equal(formal('wife', 'elderSis'), '姑奶');
  assert.equal(formal('wife', 'youngerBro'), '妹夫');          // her sister's husband ("Zy H") beats "H By" on the tie-break
  assert.equal(formal('son', 'dad'), '爺爺');
  assert.equal(formal('son', 'wifeDad'), '外公');
  assert.equal(formal('son', 'elderSis'), '姑媽');
  assert.equal(formal('son', 'wifeElderBro'), '舅父');
  assert.equal(formal('son', 'wifeYoungerSis'), '阿姨');
  assert.equal(formal('cousinA', 'dad'), '叔父');             // dad is younger than dadElderBro
  assert.equal(formal('cousinC', 'dad'), '舅父');
});

test('堂 only through the father\'s brother; 表 otherwise', () => {
  const cousin = (me: string, t: string) => {
    const x = r(me, t);
    assert.equal(x.kind, 'byAge', `${me} -> ${t}`);
    return x.kind === 'byAge' ? [x.older.formal.chars, x.younger.formal.chars, x.younger.spoken] : [];
  };
  assert.deepEqual(cousin('me', 'cousinA'), ['堂哥', '堂弟', 'by-name']);
  assert.deepEqual(cousin('me', 'cousinB'), ['堂姐', '堂妹', 'by-name']);
  assert.deepEqual(cousin('me', 'cousinC'), ['表哥', '表弟', 'by-name']);   // father's sister's son
  assert.deepEqual(cousin('me', 'cousinD'), ['表姐', '表妹', 'by-name']);
});

test('fallback: generic title by generation and a description', () => {
  const fb = (me: string, t: string) => {
    const x = r(me, t);
    assert.equal(x.kind, 'fallback', `${me} -> ${t}`);
    return x.kind === 'fallback' ? x : null!;
  };
  let x = fb('me', 'dadCousin');                               // F F Be S
  assert.deepEqual(x.generic, { chars: '叔叔', jyutping: 'suk1 suk1' });
  assert.deepEqual(x.describe, { yue: '爸爸嘅堂兄弟', en: "father's paternal cousin" });

  const gg = r('son', 'wifeGrandma');                          // M M M: now has its own title
  assert.equal(gg.kind, 'title');
  assert.equal(gg.kind === 'title' && gg.forms.formal.chars, '外曾祖母');

  x = fb('me', 'webWife');                                     // W Be W
  assert.deepEqual(x.generic, { older: { chars: '姐姐', jyutping: 'ze4 ze1' }, younger: 'by-name' });
  assert.deepEqual(x.describe, { yue: '太太嘅阿嫂', en: "wife's elder brother's wife" });

  x = fb('son', 'cousinDHusband');                             // F M Zy D H
  assert.deepEqual(x.describe, { yue: '爸爸嘅表姐夫', en: "father's mother's sister's daughter's husband" });

  x = fb('me', 'greatGrandson');                               // S S S
  assert.equal(x.generic, 'by-name');
  assert.deepEqual(x.describe, { yue: '仔嘅孫', en: "son's son's son" });
});

test('self and unrelated', () => {
  assert.deepEqual(r('me', 'me'), { kind: 'self' });
  assert.deepEqual(r('me', 'stranger'), { kind: 'unrelated' });
});

test('matchPattern: most specific pattern wins', () => {
  const t = loadTable([...entries, { pattern: 'M Be', en: 'test', formal: { chars: '大舅父', jyutping: '' }, spoken: 'by-name', status: 'test' }]);
  assert.equal(matchPattern(t, 'M Be')?.pattern, 'M Be');
  assert.equal(matchPattern(t, 'M By')?.pattern, 'M B*');
  assert.equal(matchPattern(t, 'M F M F'), null);
});

test('loadTable rejects bad tables', () => {
  const e = (pattern: string): TitleEntry => ({ pattern, en: 'x', formal: { chars: 'x', jyutping: 'x' }, spoken: 'by-name', status: 'test' });
  assert.throws(() => loadTable([...entries, e('F X')]));                         // bad token
  assert.throws(() => loadTable([...entries, e('F B')]));                         // sibling without age
  assert.throws(() => loadTable([...entries, e('F* B*')]));                       // age on a non-sibling
  assert.throws(() => loadTable([...entries, e('F Be')]));                        // duplicate
  assert.throws(() => loadTable([...entries, e('F Be Z*'), e('F B* Ze')]));       // ambiguous, equal specificity
  assert.throws(() => loadTable(entries.filter(x => x.pattern !== 'Zy')));        // missing base token
  const { spoken, ...noSpoken } = e('F F F');
  assert.throws(() => loadTable([...entries, noSpoken as TitleEntry]));           // neither spoken nor older/younger
});

test('great-grandparents have their own titles, not the generic fallback', () => {
  let t = addPerson(emptyTree(), 'm', 'Me');
  const me = t.id;
  const up = (from: string, sex: 'm' | 'f') => { const e = addParent(t.tree, from, sex); t = e; return e.id; };
  const dad = up(me, 'm'), mum = up(me, 'f');
  const names = new Map<string, string>();
  for (const [path, from, sex] of [['F F', dad, 'm'], ['F M', dad, 'f'], ['M F', mum, 'm'], ['M M', mum, 'f']] as const) {
    const g = up(from, sex);
    for (const [s, label] of [['m', 'F'], ['f', 'M']] as const) {
      const id = up(g, s);
      names.set(`${path} ${label}`, id);
    }
  }
  assert.equal(names.size, 8);
  const seen = new Set<string>();
  for (const [path, id] of names) {
    const x = resolve(t.tree, table, generic, me, id);
    assert.equal(x.kind, 'title', path);
    if (x.kind === 'title') { assert.equal(x.path, path); assert.match(x.forms.formal.chars, /^(外)?曾祖[父母]$/); seen.add(x.forms.formal.chars); }
  }
  assert.equal(seen.size, 4);
  // Four generations up is beyond the table: still the generic fallback.
  const top = up(names.get('F F F')!, 'm');
  const far = resolve(t.tree, table, generic, me, top);
  assert.equal(far.kind, 'fallback');
  assert.deepEqual(far.kind === 'fallback' && far.generic, { chars: '公公', jyutping: 'gung4 gung1' });
});

test("mother's cousins, their spouses and children have titles", () => {
  let t = emptyTree();
  const add = (e: { tree: Tree; id: string }) => { t = e.tree; return e.id; };
  const me = add(addPerson(t, 'm'));
  const mum = add(addParent(t, me, 'f'));
  const gpa = add(addParent(t, mum, 'm'));
  const gma = add(addParent(t, mum, 'f'));
  const spoken = (id: string) => {
    const x = resolve(t, table, generic, me, id);
    assert.equal(x.kind, 'title', `${id} gave ${x.kind}`);
    return x.kind === 'title' ? [x.forms.spoken === 'by-name' ? 'by-name' : x.forms.spoken.chars, x.forms.formal.chars] : [];
  };
  // Mother's father's brother's son (via 堂) and mother's mother's sister's daughter: both are 表 to me.
  const uncle = add(addSibling(t, gpa, 'm'));
  const cousin = add(addChild(t, uncle, 'm'));
  assert.deepEqual(spoken(cousin), ['表舅', '表舅父']);
  assert.deepEqual(spoken(add(addSpouse(t, cousin, 'f'))), ['表舅母', '表舅母']);
  const son = add(addChild(t, cousin, 'm'));
  assert.equal(resolve(t, table, generic, me, son).kind, 'byAge');
  const aunt = add(addSibling(t, gma, 'f'));
  const female = add(addChild(t, aunt, 'f'));
  assert.deepEqual(spoken(female), ['表姨', '表姨']);
  assert.deepEqual(spoken(add(addSpouse(t, female, 'm'))), ['表姨丈', '表姨丈']);
});
