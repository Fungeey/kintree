import { START, step } from './kinship.js';
import { compactKey as key } from './codec.js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

// Explicit kinship chains. Each token is a hop, optionally with ':sen' or ':rank'
// to expand over all values. Cousins are always a single hop with ':sen', never
// composed through a parent's sibling, because their seniority is relative to the speaker.
// Rank is not expanded here: rank terms live in family tables, not in the sourced table.
export const CHAINS = [
  // direct relatives
  ['father'], ['mother'], ['son'], ['daughter'], ['husband'], ['wife'],
  ['brother:sen'], ['sister:sen'],
  // speaker's siblings and their spouses / children
  ['brother:sen', 'wife'], ['sister:sen', 'husband'],
  ['brother:sen', 'son'], ['brother:sen', 'daughter'],
  ['sister:sen', 'son'], ['sister:sen', 'daughter'],
  // speaker's children's spouses
  ['son', 'wife'], ['daughter', 'husband'],
  // grandchildren (son's line vs daughter's line)
  ['son', 'son'], ['son', 'daughter'], ['daughter', 'son'], ['daughter', 'daughter'],
  // spouse's family (in-law line: side H or W)
  ['husband', 'father'], ['husband', 'mother'],
  ['wife', 'father'], ['wife', 'mother'],
  ['husband', 'brother:sen'], ['husband', 'sister:sen'],
  ['wife', 'brother:sen'], ['wife', 'sister:sen'],
  // spouse's siblings' spouses (two marriages on the path)
  ['husband', 'brother:sen', 'wife'], ['husband', 'sister:sen', 'husband'],
  ['wife', 'brother:sen', 'wife'], ['wife', 'sister:sen', 'husband'],
  // grandparents (both sexes, both lines)
  ['father', 'father'], ['father', 'mother'], ['mother', 'father'], ['mother', 'mother'],
  // parents' siblings and their spouses
  ['father', 'brother:sen'], ['father', 'sister:sen'],
  ['mother', 'brother:sen'], ['mother', 'sister:sen'],
  ['father', 'brother:sen', 'wife'], ['father', 'sister:sen', 'husband'],
  ['mother', 'brother:sen', 'wife'], ['mother', 'sister:sen', 'husband'],
  // grandparents' siblings
  ['father', 'father', 'brother:sen'], ['father', 'father', 'sister:sen'],
  ['father', 'mother', 'brother:sen'], ['father', 'mother', 'sister:sen'],
  ['mother', 'father', 'brother:sen'], ['mother', 'father', 'sister:sen'],
  ['mother', 'mother', 'brother:sen'], ['mother', 'mother', 'sister:sen'],
  // cousins (seniority vs speaker) and their spouses
  ['maternal_cousin_m:sen'], ['maternal_cousin_f:sen'],
  ['paternal_cousin_m:sen'], ['paternal_cousin_f:sen'],
  ['maternal_cousin_m:sen', 'wife'], ['maternal_cousin_f:sen', 'husband'],
  ['paternal_cousin_m:sen', 'wife'], ['paternal_cousin_f:sen', 'husband'],
];

const SEN = ['older', 'younger'];
const RANK = ['1', '2', '3', 'L'];

export function expandChain(chain) {
  let states = [{ s: START, path: [] }];
  for (const token of chain) {
    const [hop, mode] = token.split(':');
    const choices = mode === 'sen' ? SEN.map(v => ({ sen: v }))
                  : mode === 'rank' ? RANK.map(v => ({ rank: v }))
                  : [{}];
    const next = [];
    for (const { s, path } of states) {
      for (const choice of choices) {
        const label = choice.sen ? `${hop}:${choice.sen}`
                    : choice.rank ? `${hop}:rank${choice.rank}`
                    : hop;
        next.push({ s: step(s, hop, choice), path: [...path, label] });
      }
    }
    states = next;
  }
  return states;
}

// Map key -> list of paths that produce it. A collision is two paths with different hops
// (not just a different age pick that the key ignores) giving one key.
export function walk(chains = CHAINS) {
  const seen = new Map();
  for (const chain of chains) {
    for (const { path, s } of expandChain(chain)) {
      const k = key(s);
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(path.join(' > '));
    }
  }
  return seen;
}

export function collisionsOf(seen) {
  const hopsOf = p => p.replace(/:\w+/g, '');
  return [...seen].filter(([, p]) => new Set(p.map(hopsOf)).size > 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const seen = walk();
  const rows = [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([k, paths]) => `${k},"${paths[0]}",,,,,,false`);

  writeFileSync(new URL('./keys.csv', import.meta.url),
    'key,example_path,gloss_en,yue_chars,yue_jyutping,cmn_chars,cmn_pinyin,verified\n'
    + rows.join('\n') + '\n');

  console.log(`${seen.size} keys written to keys.csv`);
  const collisions = collisionsOf(seen);
  for (const [k, p] of collisions) console.log(`collision ${k}: ${p.join(' | ')}`);
  if (collisions.length) process.exitCode = 1;
}
