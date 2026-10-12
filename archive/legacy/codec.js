// codec.js: compact encodings for hop chains (URL-shareable) and lookup keys (table-indexable).
// Chain string: one code per hop; sibling/cousin hops take an age suffix: o = older, y = younger.
// Sibling hops may add a rank after the age: 1-9 counted from the eldest, L = youngest.
//   e.g. "MBoW"  = mother -> elder brother of mother -> wife of that brother
//        "MZo1"  = mother -> mother's eldest sister (older than mother)
//   Multiple chains in a URL: "MBoW,FZy"
// Key: 8 chars, positional: gen+4, side, sex, lin, sen, aff, anc, rank
//   e.g. "5Pf0o1--" = wife of father's elder brother (gen +1, paternal line, female, collateral, older than father, one marriage)
//   lin:  1 = direct line, 0 = collateral through a sibling or marriage, 2 = through a cousin, 3 = further
//   side: S speaker (and son's line below the speaker), D daughter's line, B/Z speaker's brother/sister,
//         P/M paternal/maternal line, H/W speaker's husband/wife (in-law line)
//   aff:  number of marriages on the path (0, 1, 2)
//   rank: 1-9, L, or '-'. Only family tables use it; sourced terms are looked up with rank '-'.

import { HOPS, START, step, normRank } from './kinship.js';

export const HOP_CODE = {
  father: 'F', mother: 'M', son: 'S', daughter: 'D',
  brother: 'B', sister: 'Z', husband: 'H', wife: 'W',
  maternal_cousin_m: 'A', maternal_cousin_f: 'E',
  paternal_cousin_m: 'P', paternal_cousin_f: 'Q',
};
const CODE_HOP = Object.fromEntries(Object.entries(HOP_CODE).map(([h, c]) => [c, h]));
const NEEDS_AGE = new Set(['B', 'Z', 'A', 'E', 'P', 'Q']);
const TAKES_RANK = new Set(['B', 'Z']);
const RANK_CHARS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'L']);
const AGE_CODE = { older: 'o', younger: 'y' };
const CODE_AGE = { o: 'older', y: 'younger' };

export const KEY_RE = /^[0-9][SDBZPMHW][mf-][0-3][oy-][0-2][mf-][1-9L-]$/;
const LIN_CODE = ['1', '0', '2', '3'];               // indexed by coll
const CODE_LIN = { 1: 0, 0: 1, 2: 2, 3: 3 };

export function encodeChain(chain) {
  return chain.map(({ hop, sen, rank }) => {
    const c = HOP_CODE[hop];
    if (!c) throw new Error(`unknown hop ${hop}`);
    if (NEEDS_AGE.has(c) && !AGE_CODE[sen]) throw new Error(`hop ${hop} needs an age (older or younger)`);
    const r = normRank(rank);
    if (r && !TAKES_RANK.has(c)) throw new Error(`hop ${hop} does not take a rank`);
    return c + (NEEDS_AGE.has(c) ? AGE_CODE[sen] : '') + (r ?? '');
  }).join('');
}

export function decodeChain(str) {
  const out = [];
  let i = 0;
  while (i < str.length) {
    const c = str[i++];
    const hop = CODE_HOP[c];
    if (!hop) throw new Error(`unknown hop code '${c}' at position ${i - 1}`);
    const item = { hop };
    if (NEEDS_AGE.has(c)) {
      const a = str[i++];
      if (!CODE_AGE[a]) throw new Error(`hop '${c}' needs an age (o or y) at position ${i - 1}`);
      item.sen = CODE_AGE[a];
    }
    if (RANK_CHARS.has(str[i])) {
      if (!TAKES_RANK.has(c)) throw new Error(`hop '${c}' does not take a rank at position ${i}`);
      item.rank = str[i++];
    }
    out.push(item);
  }
  return out;
}

// URL param: comma-separated chains.
export function decodeParam(param) {
  return param.split(',').filter(Boolean).map(decodeChain);
}

export function compactKey(s) {
  if (s.gen < -4 || s.gen > 5) throw new RangeError(`generation ${s.gen} is outside the key range (-4..+5)`);
  if (s.aff > 2) throw new RangeError(`${s.aff} marriages on one path is outside the key range (0..2)`);
  return [
    String(s.gen + 4),
    s.side,
    s.sex ?? '-',
    LIN_CODE[Math.min(s.coll, 3)],
    s.sen ? AGE_CODE[s.sen] : '-',
    String(s.aff),
    s.anc && s.gen >= 2 ? s.anc : '-',
    s.rank ?? '-',
  ].join('');
}

export function parseKey(k) {
  if (!KEY_RE.test(k)) throw new Error(`'${k}' is not a valid 8-character key`);
  return {
    gen: +k[0] - 4,
    side: k[1],
    sex: k[2] === '-' ? null : k[2],
    coll: CODE_LIN[k[3]],
    sen: k[4] === '-' ? null : CODE_AGE[k[4]],
    aff: +k[5],
    anc: k[6] === '-' ? null : k[6],
    rank: k[7] === '-' ? null : k[7],
  };
}

// Wildcard form: sen position replaced with '*'. Used for collapse rules.
export function wildcard(k) {
  return k.slice(0, 4) + '*' + k.slice(5);
}

// Drop sen when the wildcard form is listed as collapsed.
export function canonical(k, collapseSet) {
  if (k[4] === '-') return k;
  return collapseSet.has(wildcard(k)) ? k.slice(0, 4) + '-' + k.slice(5) : k;
}

// Sourced terms never depend on rank.
export function withoutRank(k) {
  return k.slice(0, 7) + '-';
}

// Family table lookup: exact key, then the key with sen as '*' (rank terms usually ignore older/younger).
export function familyTerm(k, family) {
  if (!family || k[7] === '-') return null;
  return family[k] ?? family[wildcard(k)] ?? null;
}

// Resolve one chain string to { key, term, family }.
// term: sourced term (rank ignored). family: the family's rank term, if a family table is given.
export function resolveChain(str, terms, collapseSet, family = null) {
  if (str === '') return { chain: str, key: null, term: null, family: null, self: true };
  let s = START;
  for (const { hop, sen, rank } of decodeChain(str)) s = step(s, hop, { sen, rank });
  const k = canonical(compactKey(s), collapseSet);
  return { chain: str, key: k, term: terms[withoutRank(k)] ?? null, family: familyTerm(k, family) };
}

// Resolve every chain in a URL param.
// A bad chain returns an error entry; the others still resolve.
export function resolveParam(param, terms, collapseSet, family = null) {
  return param.split(',').filter(Boolean).map(c => {
    try {
      return resolveChain(c, terms, collapseSet, family);
    } catch (e) {
      return { chain: c, key: null, term: null, family: null, error: e.message };
    }
  });
}

// Migration: long readable key (g1|side=P|sex=f|coll=1|...) to compact key.
// Also accepts the older lin=1/0 form.
export function longToCompact(lk) {
  const parts = lk.split('|');
  const gen = +parts[0].slice(1);
  const kv = Object.fromEntries(parts.slice(1).map(p => p.split('=')));
  return compactKey({
    gen,
    side: kv.side,
    sex: kv.sex === 'null' ? null : kv.sex,
    coll: kv.coll != null ? +kv.coll : (kv.lin === '1' ? 0 : 1),
    sen: kv.sen ?? null,
    aff: kv.aff ? +kv.aff : 0,
    anc: kv.anc ?? null,
    rank: kv.rank ? normRank(kv.rank) : null,
  });
}

// Migration: 7-char key (before the rank slot) to 8-char key.
export function migrate7(k) {
  return k.length === 7 ? k + '-' : k;
}
