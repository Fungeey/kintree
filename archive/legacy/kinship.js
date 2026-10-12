// kinship.js: single source of truth for the walker and the frontend.
// Each hop is an atomic relation. Macros (maternal cousin etc.) are expressed
// as atomic hops with an explicit side, so the walker enumerates real keys.

export const HOPS = {
  father:       { gen: +1, side: 'P', sex: 'm', lineal: true },
  mother:       { gen: +1, side: 'M', sex: 'f', lineal: true },
  son:          { gen: -1, side: 'S', sex: 'm', lineal: true },
  daughter:     { gen: -1, side: 'D', sex: 'f', lineal: true },
  brother:      { gen: 0, sex: 'm', sibling: true },
  sister:       { gen: 0, sex: 'f', sibling: true },
  // Cousins are same generation, on an explicit line. Not lineal.
  maternal_cousin_m: { gen: 0, side: 'M', sex: 'm', cousin: true },
  maternal_cousin_f: { gen: 0, side: 'M', sex: 'f', cousin: true },
  paternal_cousin_m: { gen: 0, side: 'P', sex: 'm', cousin: true },
  paternal_cousin_f: { gen: 0, side: 'P', sex: 'f', cousin: true },
  husband:      { gen: 0, sex: 'm', spouse: true },
  wife:         { gen: 0, sex: 'f', spouse: true },
};

// Which hops take a seniority (older/younger) vs a rank (eldest.../last).
// Speaker's siblings and cousins use seniority; a parent's siblings also take an optional rank.
export function ageInput(s, hop) {
  const h = HOPS[hop];
  if (h.cousin) return 'sen';
  if (h.sibling) return 'sen'; // seniority relative to the anchor: speaker, parent, or grandparent
  return null;
}

// Rank within a sibling group: '1'..'9' counted from the eldest, 'L' = youngest.
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'L'];
export function normRank(r) {
  if (r == null) return null;
  const v = r === 'last' ? 'L' : String(r);
  if (!RANKS.includes(v)) throw new RangeError(`rank '${r}' is not one of 1-9 or L (youngest)`);
  return v;
}

// coll: collateral distance from the speaker's direct line.
//   0 = direct line, 1 = through a sibling (or a marriage), 2 = through a cousin, 3+ = further.
// aff: number of marriage hops on the path (0, 1, 2).
export const START = { gen: 0, side: 'S', sex: null, coll: 0, aff: 0, sen: null, rank: null, anc: null };

export function step(s, hop, { sen = null, rank = null } = {}) {
  const h = HOPS[hop];
  if (!h) throw new Error(`unknown hop ${hop}`);
  const atSpeaker = s.side === 'S' && s.gen === 0;
  let side = s.side;
  if (h.cousin && atSpeaker) side = h.side;                            // speaker's cousin sets its line; a cousin of anyone else keeps the line it was reached through
  else if (h.spouse && atSpeaker) side = h.sex === 'm' ? 'H' : 'W';  // speaker's spouse starts the in-law line
  else if (h.lineal && h.gen === +1 && atSpeaker) side = h.side;     // first ancestor sets line
  else if (h.lineal && h.gen === -1 && atSpeaker) side = h.side;     // first descendant sets line: S son's line, D daughter's line
  else if (h.sibling && atSpeaker) side = h.sex === 'm' ? 'B' : 'Z'; // speaker's siblings

  let coll = s.coll;
  if (h.cousin) coll = s.coll + 2;
  else if (h.sibling || h.spouse) coll = Math.max(s.coll, 1);

  return {
    gen: s.gen + h.gen,
    side,
    sex: h.sex,
    coll,
    aff: s.aff + (h.spouse ? 1 : 0),                                   // persists once a marriage is on the path; counts marriages
    sen: h.spouse ? s.sen : (h.cousin || h.sibling ? sen : null),
    rank: h.spouse ? s.rank : (h.sibling ? normRank(rank) : null),
    // Sex of the anchor for siblings of grandparents: grandfather's sister (姑婆) and grandmother's sister (姨婆) differ.
    anc: h.sibling ? s.sex : (h.spouse ? s.anc : null),
  };
}

export function key(s) {
  return [
    `g${s.gen}`, `side=${s.side}`, `sex=${s.sex}`, `coll=${s.coll}`,
    s.sen ? `sen=${s.sen}` : null,
    s.rank ? `rank=${s.rank}` : null,
    s.anc && s.gen >= 2 ? `anc=${s.anc}` : null,
    s.aff ? `aff=${s.aff}` : null,
  ].filter(Boolean).join('|');
}

// Resolve a chain of { hop, sen?, rank? } picks to a key and term.
export function resolve(chain, terms) {
  let s = START;
  for (const { hop, sen, rank } of chain) s = step(s, hop, { sen, rank });
  const k = key(s);
  return { key: k, term: terms[k] ?? null, state: s };
}
