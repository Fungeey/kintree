// Family rank titles: 大姨媽, 二姨媽, 大舅, 二伯 ... for a parent's siblings and their spouses.
// They are family usage, so they sit beside the table's title and never replace it (DESIGN.md, rank terms).
import type { Title, Tree } from './model.ts';
import { kinPath } from './path.ts';
import { parseTokens } from './tokens.ts';

const NUMERALS: [string, string][] = [
  ['大', 'daai6'], ['二', 'ji6'], ['三', 'saam1'], ['四', 'sei3'], ['五', 'ng5'],
  ['六', 'luk6'], ['七', 'cat1'], ['八', 'baat3'], ['九', 'gau2'], ['十', 'sap6'],
];

type Stem = [string, string];
const STEM = {
  // key: parent letter, sibling letter, sibling age, spouse (the title says "aunt's husband" etc.)
  'F Be': [['伯', 'baak3'], ['伯娘', 'baak3 noeng4']],
  'F By': [['叔', 'suk1'], ['嬸', 'sam2']],
  'F Ze': [['姑媽', 'gu1 maa1'], ['姑丈', 'gu1 zoeng2']],
  'F Zy': [['姑', 'gu1'], ['姑丈', 'gu1 zoeng2']],
  'M Be': [['舅', 'kau5'], ['舅母', 'kau5 mou2']],
  'M By': [['舅', 'kau5'], ['舅母', 'kau5 mou2']],
  'M Ze': [['姨媽', 'ji4 maa1'], ['姨丈', 'ji4 zoeng2']],
  'M Zy': [['姨', 'ji4'], ['姨丈', 'ji4 zoeng2']],
} as Record<string, [Stem, Stem]>;

// Where `target` stands among `of`'s siblings of the same sex, counting from the eldest (1-based), and how many such
// siblings there are. `of` itself is not counted: "the second aunt" is the second of the parent's sisters.
function rankAmongSiblings(tree: Tree, of: string, target: string): { rank: number; total: number } | null {
  const fam = tree.families.find(f => f.children.includes(of));
  const sex = tree.people.find(p => p.id === target)?.sex;
  if (!fam || !sex) return null;
  const same = fam.children.filter(id => id !== of && tree.people.find(p => p.id === id)?.sex === sex);
  const i = same.indexOf(target);
  return i < 0 ? null : { rank: i + 1, total: same.length };
}

// The rank title of `target` as seen from `me`, or null when the path is not a parent's sibling (or that sibling's
// spouse), there is only one such sibling (nothing to rank), or the rank is past 十.
export function rankTitle(tree: Tree, me: string, target: string): Title | null {
  const path = kinPath(tree, me, target);
  if (!path) return null;
  const tokens = parseTokens(path, false);
  if (tokens.length < 2 || tokens.length > 3) return null;
  const [up, sib, spouse] = tokens;
  if (up.letter !== 'F' && up.letter !== 'M') return null;
  if (sib.letter !== 'B' && sib.letter !== 'Z') return null;
  if (spouse && spouse.letter !== 'H' && spouse.letter !== 'W') return null;
  const key = `${up.letter} ${sib.letter}${sib.age}`;
  const stems = STEM[key];
  if (!stems) return null;

  // Walk to the parent and the sibling, so the spouse's rank is their husband's or wife's.
  const parent = parentOf(tree, me, up.letter);
  const sibling = spouse ? siblingSpouseOf(tree, target) : target;
  if (!parent || !sibling) return null;
  const r = rankAmongSiblings(tree, parent, sibling);
  if (!r || r.total < 2 || r.rank > NUMERALS.length) return null;
  const [num, numJp] = NUMERALS[r.rank - 1];
  const [chars, jyutping] = stems[spouse ? 1 : 0];
  return { chars: num + chars, jyutping: `${numJp} ${jyutping}` };
}

const birthFamily = (t: Tree, id: string) => t.families.find(f => f.children.includes(id));

function parentOf(tree: Tree, id: string, letter: 'F' | 'M'): string | null {
  const sex = letter === 'F' ? 'm' : 'f';
  return birthFamily(tree, id)?.parents.find(p => tree.people.find(x => x.id === p)?.sex === sex) ?? null;
}

// The other half of `spouse`'s couple (their own family's other parent), or null.
function siblingSpouseOf(tree: Tree, spouse: string): string | null {
  const fam = tree.families.find(f => f.parents.includes(spouse));
  return fam?.parents.find(p => p !== spouse) ?? null;
}
