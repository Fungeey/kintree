import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyTree, removePerson, sides, visible } from '../../engine/src/index.ts';
import type { Tree, View } from '../../engine/src/index.ts';
import { AddPerson } from './add/AddPerson.tsx';
import { ConfirmSwitch } from './ConfirmSwitch.tsx';
import { TreeView } from './TreeView.tsx';
import { demoTree } from './demo.ts';
import { browserStore, openApp, persist, shareUrl } from './persist.ts';
import { switchTarget } from './switchPov.ts';

const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

interface Start { tree: Tree; me: string | null; error?: string }

const store = browserStore();

export function App() {
  const [start, setStart] = useState<Start | null>(() => (demo ? { ...demoTree() } : null));
  const [epoch, setEpoch] = useState(0);

  // Open from the link (it wins over a saved tree); a bad link falls back to the saved tree with the error.
  useEffect(() => {
    if (demo) return;
    let live = true;
    openApp(store, location.hash).then(o => {
      if (live) setStart({ tree: o.snapshot?.tree ?? emptyTree(), me: o.snapshot?.me ?? null, error: o.error });
    });
    return () => { live = false; };
  }, [epoch]);
  // Pasting another link into this tab only changes the hash: reopen.
  useEffect(() => {
    if (demo) return;
    const on = () => { if (location.hash.length > 1) setEpoch(e => e + 1); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  if (!start) return <main className="start"><p>Loading…</p></main>;
  return <Shell key={epoch} start={start} />;
}

function Shell({ start }: { start: Start }) {
  const [tree, setTree] = useState<Tree>(start.tree);
  const [me, setMe] = useState<string | null>(start.me);
  const [error, setError] = useState<string | undefined>(start.error);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [view, setView] = useState<View>('mine');
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);

  // Autosave on every change, and keep the address bar in step so a reload reopens this tree.
  useEffect(() => {
    if (demo) return;
    persist(store, { tree, me }, frag => history.replaceState(null, '', `${location.pathname}${location.search}#${frag}`))
      .catch(() => { /* full or blocked storage must not break editing */ });
  }, [tree, me]);

  const copyLink = async () => {
    try {
      const url = await shareUrl({ tree, me }, location);
      try { await navigator.clipboard.writeText(url); }
      catch { prompt('Copy this link:', url); }
      setCopied('ok');
    } catch { setCopied('fail'); }
    setTimeout(() => setCopied(null), 2000);
  };

  const s = useMemo(() => (me && tree.people.some(p => p.id === me) ? sides(tree, me) : null), [tree, me]);
  const show = useCallback((id: string) => (s ? visible(s, id, view) : true), [s, view]);

  // Tapping someone asks before switching "me"; tapping "me" again does nothing.
  const pick = (id: string) => { if (switchTarget(tree, me, id)) setAsking(id); };
  const switchTo = (id: string) => { setMe(id); setView('mine'); setAdding(false); setAsking(null); };
  const askingWho = asking ? switchTarget(tree, me, asking) : null;
  const changed = (t: Tree, id: string) => {
    setTree(t);
    if (!me) setMe(id);
    setAdding(false);
  };
  const remove = () => {
    if (!me) return;
    const name = tree.people.find(p => p.id === me)?.name ?? 'this person';
    if (!confirm(`Remove ${name} from the tree?`)) return;
    const t = removePerson(tree, me);
    const next = t.people.find(p => p.id !== me)?.id ?? null;
    setTree(t); setMe(next); setAdding(false);
  };

  // An empty tree starts with "me" (decision 17).
  if (!me || !s) {
    return (
      <main className="start">
        <h1>家庭稱呼 · Cantonese kinship</h1>
        {error && <p className="notice" role="alert">Couldn't open that link ({error}). Showing your saved tree.</p>}
        <p>Build your family tree to see what to call everyone.</p>
        <AddPerson tree={tree} me={null} onChange={changed} />
      </main>
    );
  }

  return (
    <div className="app">
      <header className="bar">
        <h1>家庭稱呼</h1>
        {s.married && (
          <div className="seg" role="group" aria-label="Whose family to show">
            <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>My <span className="long">family</span></button>
            <button type="button" aria-pressed={view === 'spouse'} onClick={() => setView('spouse')}>Spouse<span className="long">'s family</span></button>
          </div>
        )}
        <span className="spacer" />
        <button type="button" onClick={copyLink}>{copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Failed' : <>Copy<span className="long"> link</span></>}</button>
        <button type="button" className="primary" onClick={() => setAdding(a => !a)}>{adding ? 'Close' : <>+ Add<span className="long"> relative</span></>}</button>
        <button type="button" onClick={remove} aria-label="Remove me from the tree">Remove</button>
      </header>
      {error && (
        <p className="notice" role="alert">
          Couldn't open that link ({error}). Showing your saved tree.{' '}
          <button type="button" onClick={() => setError(undefined)}>Dismiss</button>
        </p>
      )}
      <TreeView tree={tree} me={me} show={show} onPick={pick} />
      {adding && (
        <aside className="sheet">
          <AddPerson tree={tree} me={me} onChange={changed} />
        </aside>
      )}
      {asking && askingWho && <ConfirmSwitch who={askingWho} onConfirm={() => switchTo(asking)} onCancel={() => setAsking(null)} />}
      <p className="hint">Tap a person to see everyone's titles from their point of view.</p>
    </div>
  );
}

