// codec.js: compact encodings for hop chains (URL-shareable) and lookup keys (table-indexable).
// Chain string: one code per hop; sibling/cousin hops take an age suffix: o = older, y = younger.
//   e.g. "MBoW" = mother -> elder brother of mother -> wife of that brother
//   Multiple chains in a URL: "MBoW,FZy"
// Key: 7 chars, positional: gen+4, side, sex, lin, sen, aff, anc
//   e.g. "5Pf0o1-" = wife of father's elder brother (gen +1, paternal line, female, collateral, older than father, by marriage)

import { HOPS, START, step } from './kinship.js';

export const HOP_CODE = {
  father: 'F', mother: 'M', son: 'S', daughter: 'D',
  brother: 'B', sister: 'Z', husband: 'H', wife: 'W',
  maternal_cousin_m: 'A', maternal_cousin_f: 'E',
  paternal_cousin_m: 'P', paternal_cousin_f: 'Q',
};
const CODE_HOP = Object.fromEntries(Object.entries(HOP_CODE).map(([h, c]) => [c, h]));
const NEEDS_AGE = new Set(['B', 'Z', 'A', 'E', 'P', 'Q']);
const AGE_CODE = { older: 'o', younger: 'y' };
const CODE_AGE = { o: 'older', y: 'younger' };

export function encodeChain(chain) {
  return chain.map(({ hop, sen }) => {
    const c = HOP_CODE[hop];
    if (!c) throw new Error(`unknown hop ${hop}`);
    if (NEEDS_AGE.has(c) && !AGE_CODE[sen]) throw new Error(`hop ${hop} needs an age (older or younger)`);
    return c + (NEEDS_AGE.has(c) ? AGE_CODE[sen] : '');
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
  return [
    String(s.gen + 4),
    s.side,
    s.sex ?? '-',
    s.lineal ? '1' : '0',
    s.sen ? AGE_CODE[s.sen] : '-',
    s.aff ? '1' : '0',
    s.anc && s.gen >= 2 ? s.anc : '-',
  ].join('');
}

export function parseKey(k) {
  return {
    gen: +k[0] - 4,
    side: k[1],
    sex: k[2] === '-' ? null : k[2],
    lineal: k[3] === '1',
    sen: k[4] === '-' ? null : CODE_AGE[k[4]],
    aff: k[5] === '1',
    anc: k[6] === '-' ? null : k[6],
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

// Resolve one chain string to { key, term }.
export function resolveChain(str, terms, collapseSet) {
  if (str === '') return { chain: str, key: null, term: null, self: true };
  let s = START;
  for (const { hop, sen } of decodeChain(str)) s = step(s, hop, { sen });
  const k = canonical(compactKey(s), collapseSet);
  return { chain: str, key: k, term: terms[k] ?? null };
}

// Resolve every chain in a URL param.
// A bad chain returns an error entry; the others still resolve.
export function resolveParam(param, terms, collapseSet) {
  return param.split(',').filter(Boolean).map(c => {
    try {
      return resolveChain(c, terms, collapseSet);
    } catch (e) {
      return { chain: c, key: null, term: null, error: e.message };
    }
  });
}

// Migration: long readable key (g1|side=P|sex=f|...) to compact key.
export function longToCompact(lk) {
  const parts = lk.split('|');
  const gen = +parts[0].slice(1);
  const kv = Object.fromEntries(parts.slice(1).map(p => p.split('=')));
  return compactKey({
    gen,
    side: kv.side,
    sex: kv.sex === 'null' ? null : kv.sex,
    lineal: kv.lin === '1',
    sen: kv.sen ?? null,
    aff: kv.aff === '1',
    anc: kv.anc ?? null,
  });
}
