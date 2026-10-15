// Load/save wiring for the shell (slice 4c) over the storage library.
import { encodeFragment, open, save } from '../../storage/src/index.ts';
import type { KV, KVAll, Opened, Snapshot } from '../../storage/src/index.ts';

/** localStorage, or null when the browser blocks it (private mode, disabled storage). */
export function browserStore(): KVAll | null {
  try {
    const s = window.localStorage;
    s.getItem('kinship:probe');
    return {
      getItem: k => s.getItem(k),
      setItem: (k, v) => s.setItem(k, v),
      removeItem: k => s.removeItem(k),
      keys: () => Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => k !== null),
    };
  } catch { return null; }
}

const memory = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
};

/** Open from the link, else the saved tree. Without usable storage it still opens a link. */
export function openApp(store: KV | null, hash: string): Promise<Opened> {
  return open(store ?? memory(), hash);
}

/** Autosave and keep the address bar on the current tree, so a reload reopens it (the link wins on open). */
export async function persist(store: KV | null, snap: Snapshot, setHash: (frag: string) => void): Promise<void> {
  const frag = store ? await save(store, snap) : await encodeFragment(snap);
  setHash(frag);
}

/** The shareable URL for a tree and "me". */
// The language rides along as ?lang= (Cantonese too), so a saved choice on the opener's side doesn't change what the link shows.
export async function shareUrl(snap: Snapshot, base: { origin: string; pathname: string }, lang?: string): Promise<string> {
  const q = lang ? `?lang=${lang}` : '';
  return `${base.origin}${base.pathname}${q}#${await encodeFragment(snap)}`;
}
