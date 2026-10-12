// check.js: consistency check of terms.json and family-terms.json against the walker.
// Run: node check.js  (exit code 1 on any error; uncovered keys are reported but are not errors)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { KEY_RE, canonical, wildcard } from './codec.js';
import { walk, collisionsOf } from './walk.js';

const load = f => JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'));
const isData = k => !k.startsWith('_');

export function check(terms = load('./terms.json'), familyFile = load('./family-terms.json')) {
  const errors = [];
  const collapse = new Set(terms._collapse_sen);
  const seen = walk();
  const canon = new Set([...seen.keys()].map(k => canonical(k, collapse)));
  const termKeys = Object.keys(terms).filter(isData);

  for (const k of termKeys) {
    if (!KEY_RE.test(k)) errors.push(`term key '${k}' is not a valid 8-character key`);
    else if (k[7] !== '-') errors.push(`term key '${k}' has a rank; rank terms belong in family-terms.json`);
  }
  for (const w of collapse) {
    if (!KEY_RE.test(w.replace('*', 'o'))) errors.push(`collapse entry '${w}' is not a valid wildcard key`);
    for (const a of 'oy') {
      const k = w.replace('*', a);
      if (terms[k]) errors.push(`term '${k}' can never be reached: '${w}' collapses sen`);
    }
    if (![...seen.keys()].some(k => wildcard(k) === w)) errors.push(`collapse entry '${w}' matches no walker key`);
  }
  for (const [k, paths] of collisionsOf(seen)) errors.push(`collision ${k}: ${paths.join(' | ')}`);

  const orphans = termKeys.filter(k => !canon.has(k));
  for (const k of orphans) errors.push(`orphan term ${k} (${terms[k].gloss}): no walker chain reaches it`);

  for (const [fam, table] of Object.entries(familyFile._families ?? {})) {
    for (const k of Object.keys(table).filter(isData)) {
      if (!KEY_RE.test(k.replace('*', 'o'))) errors.push(`family '${fam}': key '${k}' is not a valid key`);
      else if (k[7] === '-') errors.push(`family '${fam}': key '${k}' has no rank`);
    }
  }

  const uncovered = [...canon].filter(k => !terms[k]).sort();
  const status = {};
  for (const k of termKeys) status[terms[k].status] = (status[terms[k].status] ?? 0) + 1;
  return { errors, keys: seen.size, canonical: canon.size, terms: termKeys.length, uncovered, status };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = check();
  console.log(`${r.keys} keys, ${r.canonical} canonical, ${r.terms} terms, ${r.uncovered.length} without a term (fallback)`);
  console.log('status:', r.status);
  for (const k of r.uncovered) console.log(`  fallback ${k}: ${walk().get(k)?.[0] ?? '(collapsed key)'}`);
  for (const e of r.errors) console.log(`ERROR ${e}`);
  if (r.errors.length) process.exitCode = 1;
}
