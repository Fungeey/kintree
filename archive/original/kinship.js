// kinship.js: single source of truth for the walker and the frontend.
// Each hop is an atomic relation. Macros (maternal cousin etc.) are expressed
// as atomic hops with an explicit side, so the walker enumerates real keys.

export const HOPS = {
  father:       { gen: +1, side: 'P', sex: 'm', lineal: true },
  mother:       { gen: +1, side: 'M', sex: 'f', lineal: true },
  son:          { gen: -1, sex: 'm', lineal: true },
  daughter:     { gen: -1, sex: 'f', lineal: true },
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
// Speaker's siblings and cousins use seniority; a parent's siblings use rank.
export function ageInput(s, hop) {
  const h = HOPS[hop];
  if (h.cousin) return 'sen';
  if (h.sibling) return 'sen'; // seniority relative to the anchor: speaker, parent, or grandparent
  return null;
}

export const START = { gen: 0, side: 'S', sex: null, lineal: true, aff: false, sen: null, rank: null };

export function step(s, hop, { sen = null, rank = null } = {}) {
  const h = HOPS[hop];
  let side = s.side;
  if (h.cousin) side = h.side;                                        // cousin sets its line (TODO: beyond-speaker cousins, see DESIGN §9)
  else if (h.spouse && s.side === 'S' && s.gen === 0) side = h.sex === 'm' ? 'H' : 'W'; // speaker's spouse starts the in-law line
  else if (h.lineal && h.gen === +1 && s.side === 'S') side = h.side;  // first ancestor sets line
  else if (h.sibling && s.side === 'S' && s.gen === 0) side = h.sex === 'm' ? 'B' : 'Z'; // speaker's siblings

  return {
    gen: s.gen + h.gen,
    side,
    sex: h.sex,
    lineal: !!(h.lineal && s.lineal),
    aff: !!(s.aff || h.spouse),                                        // persists once a marriage is on the path
    sen: h.spouse ? s.sen : (h.cousin || h.sibling ? sen : null),
    rank: h.spouse ? s.rank : (h.sibling ? rank : null),
    // Sex of the anchor for siblings of grandparents: grandfather's sister (姑婆) and grandmother's sister (姨婆) differ.
    anc: h.sibling ? s.sex : (h.spouse ? s.anc : null),
  };
}

export function key(s) {
  return [
    `g${s.gen}`, `side=${s.side}`, `sex=${s.sex}`, `lin=${s.lineal ? 1 : 0}`,
    s.sen ? `sen=${s.sen}` : null,
    s.rank ? `rank=${s.rank}` : null,
    s.anc && s.gen >= 2 ? `anc=${s.anc}` : null,
    s.aff ? 'aff=1' : null,
  ].filter(Boolean).join('|');
}

// Resolve a chain of { hop, sen?, rank? } picks to a key and term.
export function resolve(chain, terms) {
  let s = START;
  for (const { hop, sen, rank } of chain) s = step(s, hop, { sen, rank });
  const k = key(s);
  return { key: k, term: terms[k] ?? null, state: s };
}
