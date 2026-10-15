// Birth year, "About" lines and the birth-order check for the person popup.
import { MAX_BORN, MIN_BORN } from '../../engine/src/index.ts';
import type { Tree } from '../../engine/src/index.ts';
import type { Shown } from './display.ts';

export const thisYear = (): number => new Date().getFullYear();

/** The latest year a person can be born in: this year. */
export const maxYear = (now = thisYear()): number => Math.min(MAX_BORN, now);

export type YearResult = { year: number | undefined } | { error: string };

/** Read the year field: empty clears it, otherwise a whole year from 1000 to this year. */
export function parseYear(text: string, now = thisYear()): YearResult {
  const t = text.trim();
  if (!t) return { year: undefined };
  if (!/^\d{4}$/.test(t)) return { error: `Enter a four-digit year, like 1952.` };
  const year = Number(t);
  if (year < MIN_BORN || year > maxYear(now)) return { error: `Enter a year from ${MIN_BORN} to ${maxYear(now)}.` };
  return { year };
}

/** Age from the year alone, so it can be a year out. Never negative. */
export const ageOf = (born: number, now = thisYear()): number => Math.max(0, now - born);

export const bornLine = (born: number, now = thisYear()): string => `b. ${born} · age ${ageOf(born, now)}`;

/** How someone relates to "me", for the About block: "Your father's older sister", "You". Null when there is nothing to say. */
export function relationText(shown: Shown, isMe: boolean): string | null {
  if (isMe || shown.kind === 'self') return 'You';
  if (shown.gloss) return `Your ${shown.gloss}`;
  return shown.describe ?? null;
}

/** The About lines, in order: the relation, then the birth year when there is one. */
export function aboutLines(shown: Shown, isMe: boolean, born: number | undefined, now = thisYear()): string[] {
  const lines: string[] = [];
  const rel = relationText(shown, isMe);
  if (rel) lines.push(rel);
  if (born !== undefined) lines.push(bornLine(born, now));
  return lines;
}

const yearOf = (tree: Tree, id: string) => tree.people.find(p => p.id === id)?.born;

/** True when birth years disagree with the birth order: someone listed as older was born later than someone listed as younger. */
export function orderConflict(tree: Tree, order: string[]): boolean {
  let last = -Infinity;
  for (const id of order) {
    const y = yearOf(tree, id);
    if (y === undefined) continue;
    if (y < last) return true;
    last = y;
  }
  return false;
}

/** The order with everyone who has a year sorted by it (earliest born first). People without a year keep their places. */
export function orderByYear(tree: Tree, order: string[]): string[] {
  const dated = order.filter(id => yearOf(tree, id) !== undefined);
  const sorted = [...dated].sort((a, b) => yearOf(tree, a)! - yearOf(tree, b)!); // stable: equal years keep their order
  let i = 0;
  return order.map(id => (yearOf(tree, id) !== undefined ? sorted[i++] : id));
}
