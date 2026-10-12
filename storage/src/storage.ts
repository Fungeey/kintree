// Autosave and restore (slice 2). The link wins over the saved tree; a differing saved tree is kept as "recent".
import { encodeFragment, decodeFragment } from './format.ts';
import type { Snapshot } from './format.ts';

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const CURRENT_KEY = 'kinship:current';
export const RECENT_KEY = 'kinship:recent';
export const MAX_RECENT = 5;

export interface Opened {
  snapshot: Snapshot | null;           // what to show; null = start an empty tree
  source: 'link' | 'saved' | 'empty';
  recent: string[];                     // fragments of older trees, newest first
  error?: string;                       // set when the link was present but unusable
}

function readList(store: KV): string[] {
  try {
    const v = JSON.parse(store.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

function pushRecent(store: KV, frag: string): string[] {
  const list = [frag, ...readList(store).filter((x) => x !== frag)].slice(0, MAX_RECENT);
  store.setItem(RECENT_KEY, JSON.stringify(list));
  return list;
}

/** Autosave: call on every change. */
export async function save(store: KV, snap: Snapshot): Promise<string> {
  const frag = await encodeFragment(snap);
  store.setItem(CURRENT_KEY, frag);
  return frag;
}

/** Open: `hash` is location.hash ('' or '#v1....'). */
export async function open(store: KV, hash: string): Promise<Opened> {
  const saved = store.getItem(CURRENT_KEY);
  let savedSnap: Snapshot | null = null;
  if (saved) { try { savedSnap = await decodeFragment(saved); } catch { savedSnap = null; } }

  const link = hash.replace(/^#/, '');
  if (link) {
    try {
      const snapshot = await decodeFragment(link);
      let recent = readList(store);
      if (saved && savedSnap && saved !== link) recent = pushRecent(store, saved);
      store.setItem(CURRENT_KEY, link);
      return { snapshot, source: 'link', recent };
    } catch (e) {
      // A bad link must not destroy the saved tree: fall through to restore it.
      const r = await open(store, '');
      return { ...r, error: (e as Error).message };
    }
  }
  if (savedSnap) return { snapshot: savedSnap, source: 'saved', recent: readList(store) };
  return { snapshot: null, source: 'empty', recent: readList(store) };
}
