// What stays in this browser, keyed by tree id (see METADATA.md 4.1): birth years (so opening a link to your own tree
// doesn't lose them, since links carry only the tree and names) and notes (which are never in a link or a file).
import type { Tree } from '../../engine/src/index.ts';
import { MAX_BORN, MIN_BORN } from '../../engine/src/index.ts';
import type { KV } from './storage.ts';

/** A KV that can also list and remove keys, for "Clear this device". localStorage is one. */
export interface KVAll extends KV { removeItem(k: string): void; keys(): string[] }

export const DETAILS_PREFIX = 'kinship:details:';
export const NOTES_PREFIX = 'kinship:notes:';
export const MAX_NOTE = 2000;

export interface Details { [personId: string]: { born?: number } }

const isYear = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= MIN_BORN && x <= MAX_BORN;

function readJson(store: KV, key: string): Record<string, unknown> {
  try {
    const v = JSON.parse(store.getItem(key) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

/** The tree's details worth keeping: just the people who have any. */
export function detailsOf(tree: Tree): Details {
  const d: Details = {};
  for (const p of tree.people) if (p.born !== undefined) d[p.id] = { born: p.born };
  return d;
}

export function readDetails(store: KV, treeId: string): Details {
  const d: Details = {};
  for (const [id, v] of Object.entries(readJson(store, DETAILS_PREFIX + treeId))) {
    const born = (v as { born?: unknown } | null)?.born;
    if (isYear(born)) d[id] = { born };
  }
  return d;
}

/** Replace the saved details for a tree with what the tree has now (nothing left to keep removes the key). */
export function saveDetails(store: KVAll, treeId: string, tree: Tree): void {
  const d = detailsOf(tree);
  if (Object.keys(d).length) store.setItem(DETAILS_PREFIX + treeId, JSON.stringify(d));
  else store.removeItem(DETAILS_PREFIX + treeId);
}

/** The tree with saved details put back on the people who are still in it. */
export function applyDetails(tree: Tree, details: Details): Tree {
  if (!tree.people.some((p) => details[p.id])) return tree;
  return { ...tree, people: tree.people.map((p) => (details[p.id] ? { ...p, ...details[p.id] } : p)) };
}

export function readNotes(store: KV, treeId: string): Record<string, string> {
  const n: Record<string, string> = {};
  for (const [id, v] of Object.entries(readJson(store, NOTES_PREFIX + treeId))) if (typeof v === 'string' && v) n[id] = v;
  return n;
}

/** Save (or, when empty, delete) one person's note. False when the browser refused to store it. */
export function setNote(store: KVAll, treeId: string, personId: string, text: string): boolean {
  try {
    const notes = readNotes(store, treeId);
    const t = text.slice(0, MAX_NOTE);
    if (t.trim()) notes[personId] = t; else delete notes[personId];
    if (Object.keys(notes).length) store.setItem(NOTES_PREFIX + treeId, JSON.stringify(notes));
    else store.removeItem(NOTES_PREFIX + treeId);
    return true;
  } catch { return false; }
}

/** Drop notes of people who are no longer in the tree. */
export function pruneNotes(store: KVAll, treeId: string, tree: Tree): void {
  const notes = readNotes(store, treeId);
  const keep = new Set(tree.people.map((p) => p.id));
  const gone = Object.keys(notes).filter((id) => !keep.has(id));
  if (!gone.length) return;
  for (const id of gone) delete notes[id];
  if (Object.keys(notes).length) store.setItem(NOTES_PREFIX + treeId, JSON.stringify(notes));
  else store.removeItem(NOTES_PREFIX + treeId);
}

/** "Clear this device": everything Kintree keeps here (the saved tree, recents, language, details, notes). */
export function clearAll(store: KVAll): void {
  for (const k of store.keys()) if (k.startsWith('kinship:')) store.removeItem(k);
}
