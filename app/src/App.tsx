import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyTree, removePerson, sides, visible } from '../../engine/src/index.ts';
import type { Tree, View } from '../../engine/src/index.ts';
import { AddPerson } from './add/AddPerson.tsx';
import { ConfirmSwitch } from './ConfirmSwitch.tsx';
import { EditName } from './EditName.tsx';
import { TreeView } from './TreeView.tsx';
import { demoTree } from './demo.ts';
import { browserStore, openApp, persist, shareUrl } from './persist.ts';
import { switchTarget, viewingAs } from './switchPov.ts';
import { applyEdit, nameRequired, siblingsOf } from './rename.ts';
import { rootLabel } from './display.ts';
import { initialLang, langFor, LANG_IDS, saveLang } from './lang.ts';
import type { LangId } from './lang.ts';

const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

interface Start { tree: Tree; me: string | null; error?: string }

const store = browserStore();

export function App() {
  const [start, setStart] = useState<Start | null>(() => (demo ? { ...demoTree() } : null));
  const [epoch, setEpoch] = useState(0);
  const [lang, setLangState] = useState<LangId>(() => initialLang(typeof location !== 'undefined' ? location.search : '', store));
  // The language is the viewer's choice, not part of the tree: it is saved here and shown as ?lang= so a link can carry it.
  const setLang = (id: LangId) => {
    setLangState(id);
    saveLang(store, id);
    const q = new URLSearchParams(location.search);
    if (q.has('lang')) { q.set('lang', id); history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`); }
  };

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
  return <Shell key={epoch} start={start} lang={lang} setLang={setLang} />;
}

function Shell({ start, lang, setLang }: { start: Start; lang: LangId; setLang: (id: LangId) => void }) {
  const [tree, setTree] = useState<Tree>(start.tree);
  const [me, setMe] = useState<string | null>(start.me);
  const [error, setError] = useState<string | undefined>(start.error);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [view, setView] = useState<View>('mine');
  const [asking, setAsking] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  // Autosave on every change, and keep the address bar in step so a reload reopens this tree.
  useEffect(() => {
    if (demo) return;
    persist(store, { tree, me }, frag => history.replaceState(null, '', `${location.pathname}${location.search}#${frag}`))
      .catch(() => { /* full or blocked storage must not break editing */ });
  }, [tree, me]);

  const copyLink = async () => {
    try {
      const url = await shareUrl({ tree, me }, location, lang);
      try { await navigator.clipboard.writeText(url); }
      catch { prompt('Copy this link:', url); }
      setCopied('ok');
    } catch { setCopied('fail'); }
    setTimeout(() => setCopied(null), 2000);
  };

  const s = useMemo(() => (me && tree.people.some(p => p.id === me) ? sides(tree, me) : null), [tree, me]);
  const show = useCallback((id: string) => (s ? visible(s, id, view) : true), [s, view]);

  // Tapping someone asks before switching "me"; tapping "me" again does nothing. In edit mode it renames them.
  const pick = (id: string) => {
    if (editMode) setRenaming(id);
    else if (switchTarget(tree, me, id)) setAsking(id);
  };
  const toggleEdit = () => { setEditMode(e => !e); setRenaming(null); };
  const rename = (id: string, name: string, order: string[]) => {
    const t = applyEdit(tree, id, name, order);
    if (t && t !== tree) setTree(t);
    setRenaming(null);
  };
  const renamingWho = renaming ? tree.people.find(p => p.id === renaming) : undefined;
  const switchTo = (id: string) => { setMe(id); setView('mine'); setAsking(null); };
  const askingWho = asking ? switchTarget(tree, me, asking) : null;
  const changed = (t: Tree, id: string) => {
    setTree(t);
    if (!me) setMe(id);
  };
  // Edit mode's Remove: take someone off the tree. If it was "me", the view moves to someone who is left.
  const removeAt = (id: string) => {
    const t = removePerson(tree, id);
    setTree(t);
    setRenaming(null);
    if (id === me) { setMe(t.people[0]?.id ?? null); setView('mine'); }
  };

  const picker = (
    <select className="lang" value={lang} aria-label="Language" onChange={e => setLang(e.target.value as LangId)}>
      {LANG_IDS.map(id => <option key={id} value={id}>{langFor(id).label}</option>)}
    </select>
  );

  // An empty tree starts with "me" (decision 17).
  if (!me || !s) {
    return (
      <main className="start">
        <div className="start-top"><h1>{langFor(lang).heading} · Kinship</h1>{picker}</div>
        {error && <p className="notice" role="alert">Couldn't open that link ({error}). Showing your saved tree.</p>}
        <p>Build your family tree to see what to call everyone.</p>
        <AddPerson tree={tree} me={null} onChange={changed} />
      </main>
    );
  }

  return (
    <div className="app">
      <header className="bar">
        <h1 lang={langFor(lang).html}>{langFor(lang).heading}</h1>
        {s.married && (
          <div className="seg" role="group" aria-label="Whose family to show">
            <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>My <span className="long">family</span></button>
            <button type="button" aria-pressed={view === 'spouse'} onClick={() => setView('spouse')}>Spouse<span className="long">'s family</span></button>
          </div>
        )}
        <span className="spacer" />
        {picker}
        <button type="button" className={editMode ? 'editing' : undefined} aria-pressed={editMode} onClick={toggleEdit}>{editMode ? 'Done' : 'Edit'}</button>
        <button type="button" onClick={copyLink}>{copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Failed' : <>Copy<span className="long"> link</span></>}</button>
      </header>
      {error && (
        <p className="notice" role="alert">
          Couldn't open that link ({error}). Showing your saved tree.{' '}
          <button type="button" onClick={() => setError(undefined)}>Dismiss</button>
        </p>
      )}
      {editMode && <p className="edit-banner" role="status">Editing. Tap a person to rename, reorder, add relatives or remove them.</p>}
      <TreeView tree={tree} me={me} show={show} onPick={pick} editing={editMode} lang={lang} />
      {asking && askingWho && <ConfirmSwitch who={askingWho} onConfirm={() => switchTo(asking)} onCancel={() => setAsking(null)} />}
      {renaming && renamingWho && (
        <EditName
          key={renaming}
          tree={tree}
          who={rootLabel(tree, renaming)?.replace(/^Your /, 'your ') ?? switchTarget(tree, me, renaming) ?? 'this person'}
          name={renamingWho.name ?? ''}
          required={nameRequired(tree, renaming)}
          self={renaming}
          siblings={siblingsOf(tree, renaming).map(id => tree.people.find(p => p.id === id)!)}
          onSave={(name, order) => rename(renaming, name, order)}
          onAdded={(t, id) => { changed(t, id); setRenaming(null); }}
          onRemove={() => removeAt(renaming)}
          onCancel={() => setRenaming(null)}
        />
      )}
      <p className="viewing" aria-live="polite">Viewing as: <strong>{viewingAs(tree, me)}</strong></p>
    </div>
  );
}

