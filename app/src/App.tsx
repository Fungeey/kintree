import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { emptyTree, removePerson, removePet, renamePet, sides, visible } from '../../engine/src/index.ts';
import type { Tree, View } from '../../engine/src/index.ts';
import { AddPerson } from './add/AddPerson.tsx';
import { PersonPopup } from './PersonPopup.tsx';
import { EditPet } from './EditPet.tsx';
import { FileMenu } from './FileMenu.tsx';
import { fileNameFor, readFile, saveFile } from './fileIO.ts';
import { adopt, applyDetails, clearAll, decodeFile, encodeFile, newTreeId, pruneNotes, readDetails, readNotes, saveDetails, setNote } from '../../storage/src/index.ts';
import { cleanName } from './rename.ts';
import { TreeView } from './TreeView.tsx';
import { demoTree } from './demo.ts';
import { browserStore, openApp, persist, shareUrl } from './persist.ts';
import { viewingAs } from './switchPov.ts';
import { rootLabel } from './display.ts';
import { headingFor, initialLang, langFor, LANG_IDS, NONE, saveLang } from './lang.ts';
import type { LangChoice } from './lang.ts';

const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

interface Start { tree: Tree; me: string | null; treeId: string; error?: string }

const store = browserStore();
// Notes and birth years need a store that can list and remove keys. Without usable browser storage they last until the page closes.
const kv = store ?? memoryKV();

export function App() {
  const [start, setStart] = useState<Start | null>(() => (demo ? { ...demoTree(), treeId: newTreeId() } : null));
  const [fileError, setFileError] = useState<string | undefined>();
  const [epoch, setEpoch] = useState(0);
  const [lang, setLangState] = useState<LangChoice>(() => initialLang(typeof location !== 'undefined' ? location.search : '', store));
  // The language is the viewer's choice, not part of the tree: it is saved here and shown as ?lang= so a link can carry it.
  const setLang = (id: LangChoice) => {
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
      if (!live) return;
      // Links and the saved tree carry no birth years; they come back from this browser's details for the same tree id.
      const treeId = o.snapshot?.treeId ?? newTreeId();
      const tree = o.snapshot ? applyDetails(o.snapshot.tree, readDetails(kv, treeId)) : emptyTree();
      setStart({ tree, me: o.snapshot?.me ?? null, treeId, error: o.error });
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

  // Open file: the file wins, like a link. The tree it replaces stays saved in this browser as a recent copy.
  const startRef = useRef(start);
  startRef.current = start;
  const openFile = useCallback(async (file: File) => {
    try {
      const snap = decodeFile(await readFile(file));
      const had = startRef.current?.tree.people.length;
      if (had && !confirm(`Open "${file.name}"? It replaces the tree on screen, so save that one first if you want to keep it.`)) return;
      const treeId = snap.treeId ?? newTreeId();
      const next = { ...snap, treeId };
      if (!demo) {
        saveDetails(kv, treeId, next.tree);   // the file's birth years win over any kept here for this tree
        const { fragment } = await adopt(store ?? memoryStore(), next);
        history.replaceState(null, '', `${location.pathname}${location.search}#${fragment}`);
      }
      setFileError(undefined);
      setStart({ tree: next.tree, me: next.me, treeId });
      setEpoch(e => e + 1);
    } catch (e) {
      setFileError(`Couldn't open ${file.name} (${(e as Error).message}). Your tree is unchanged.`);
    }
  }, []);
  const dropping = useDrop(openFile);

  if (!start) return <main className="start"><p>Loading…</p></main>;
  return (
    <>
      <Shell key={epoch} start={start} lang={lang} setLang={setLang} onOpenFile={openFile} fileError={fileError} dismissFileError={() => setFileError(undefined)} />
      {dropping && <div className="drop-hint" aria-hidden="true">Drop a .kintree file to open it</div>}
    </>
  );
}

// A .kintree file dropped anywhere on the page opens it. Returns whether a file is being dragged over the page.
function useDrop(onFile: (f: File) => void): boolean {
  const [over, setOver] = useState(false);
  useEffect(() => {
    const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    let depth = 0;
    const enter = (e: DragEvent) => { if (hasFile(e)) { depth++; setOver(true); } };
    const leave = (e: DragEvent) => { if (hasFile(e) && --depth <= 0) { depth = 0; setOver(false); } };
    const overEv = (e: DragEvent) => { if (hasFile(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const f = e.dataTransfer?.files[0];
      if (f) onFile(f);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overEv);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overEv);
      window.removeEventListener('drop', drop);
    };
  }, [onFile]);
  return over;
}

// A hidden file input plus the function that opens its picker.
function usePicker(onFile: (f: File) => void): [JSX.Element, () => void] {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      hidden
      accept=".kintree,application/json,application/octet-stream"
      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onFile(f); }}
    />
  );
  return [input, () => ref.current?.click()];
}

function memoryKV() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
}
const memoryStore = memoryKV;

interface ShellProps {
  start: Start; lang: LangChoice; setLang: (id: LangChoice) => void;
  onOpenFile: (f: File) => void; fileError?: string; dismissFileError: () => void;
}

function Shell({ start, lang, setLang, onOpenFile, fileError, dismissFileError }: ShellProps) {
  const [fileInput, openPicker] = usePicker(onOpenFile);
  const [saved, setSaved] = useState<string | null>(null);
  const [tree, setTree] = useState<Tree>(start.tree);
  const [me, setMe] = useState<string | null>(start.me);
  const [error, setError] = useState<string | undefined>(start.error);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const [view, setView] = useState<View>('mine');
  const [focus, setFocus] = useState<string | null>(null);          // whose popup is open
  const [requested, setRequested] = useState<string | null>(null);   // tapped while the popup has unsaved changes
  const [dirty, setDirty] = useState(false);
  const [genOf, setGenOf] = useState<(id: string) => number>(() => () => 0);
  const [box, setBox] = useState<{ height: number; width: number; panel: boolean } | null>(null);
  const [petEditing, setPetEditing] = useState<string | null>(null);

  // Autosave on every change, and keep the address bar in step so a reload reopens this tree.
  useEffect(() => {
    if (demo) return;
    persist(store, { tree, me, treeId: start.treeId }, frag => history.replaceState(null, '', `${location.pathname}${location.search}#${frag}`))
      .catch(() => { /* full or blocked storage must not break editing */ });
  }, [tree, me, start.treeId]);

  // Birth years stay in this browser for this tree id (links don't carry them); notes of removed people go.
  useEffect(() => {
    if (demo || !tree.people.length) return;
    try { saveDetails(kv, start.treeId, tree); pruneNotes(kv, start.treeId, tree); } catch { /* storage full or blocked */ }
  }, [tree, start.treeId]);
  const note = useMemo(() => ({
    get: (id: string) => readNotes(kv, start.treeId)[id] ?? '',
    set: (id: string, text: string) => setNote(kv, start.treeId, id, text),
  }), [start.treeId]);
  const hasYears = tree.people.some(p => p.born !== undefined);

  const clearDevice = () => {
    if (!confirm('Remove everything Kintree keeps in this browser: the saved tree, recent copies, notes and settings? Files you saved are not affected.')) return;
    try { clearAll(kv); } catch { /* nothing more to do */ }
    location.replace(location.pathname);
  };

  const copyLink = async () => {
    try {
      const url = await shareUrl({ tree, me, treeId: start.treeId }, location, lang);
      try { await navigator.clipboard.writeText(url); }
      catch { prompt('Copy this link:', url); }
      setCopied('ok');
    } catch { setCopied('fail'); }
    setTimeout(() => setCopied(null), 2000);
  };

  const saveToFile = () => {
    let note: string;
    try {
      saveFile(encodeFile({ tree, me, treeId: start.treeId }), fileNameFor(tree));
      note = 'Saved';
    } catch { note = 'Failed'; }
    setSaved(note);
    setTimeout(() => setSaved(null), 2000);
  };

  const s = useMemo(() => (me && tree.people.some(p => p.id === me) ? sides(tree, me) : null), [tree, me]);
  const show = useCallback((id: string) => (s ? visible(s, id, view) : true), [s, view]);

  // Tapping a person opens their popup. With unsaved changes in the open popup it asks first. A pet opens its own sheet.
  const pick = (id: string) => {
    if (tree.pets?.some(a => a.id === id)) { setPetEditing(id); return; }
    if (id === focus) return;
    if (focus && dirty) setRequested(id);
    else setFocus(id);
  };
  // A tap on the empty tree closes the popup, asking first when it has unsaved changes.
  const blank = () => { if (!focus) return; if (dirty) setRequested(''); else setFocus(null); };
  const editingPet = petEditing ? tree.pets?.find(a => a.id === petEditing) : undefined;
  const viewAs = (id: string) => { setMe(id); setView('mine'); setFocus(null); };
  const changed = (t: Tree, id: string) => {
    setTree(t);
    if (!me) setMe(id);
  };
  // Remove (in Relatives): take someone off the tree. If it was "me", the view moves to someone who is left.
  const removeAt = (id: string) => {
    const t = removePerson(tree, id);
    setTree(t);
    setFocus(null);
    if (id === me) { setMe(t.people[0]?.id ?? null); setView('mine'); }
  };

  const picker = (
    <select className="lang" value={lang} aria-label="Language" onChange={e => setLang(e.target.value as LangChoice)}>
      {LANG_IDS.map(id => <option key={id} value={id}>{langFor(id).label} · {langFor(id).english}</option>)}
      <option value={NONE}>None · names only</option>
    </select>
  );

  // An empty tree starts with "me" (decision 17).
  if (!me || !s) {
    return (
      <main className="start">
        <div className="start-top"><h1>{lang === NONE ? 'Kinship' : `${headingFor(lang)} · Kinship`}</h1>{picker}</div>
        {error && <p className="notice" role="alert">Couldn't open that link ({error}). Showing your saved tree.</p>}
        {fileError && <p className="notice" role="alert">{fileError}{' '}<button type="button" onClick={dismissFileError}>Dismiss</button></p>}
        <p>Build your family tree to see what to call everyone.</p>
        <AddPerson tree={tree} me={null} onChange={changed} />
        <p className="start-file">Already have a family file? <button type="button" onClick={openPicker}>Open file…</button></p>
        {fileInput}
      </main>
    );
  }

  return (
    <div className="app">
      <header className="bar">
        <h1 lang={lang === NONE ? undefined : langFor(lang).html}>{headingFor(lang)}</h1>
        {s.married && (
          <div className="seg" role="group" aria-label="Whose family to show">
            <button type="button" aria-pressed={view === 'mine'} onClick={() => setView('mine')}>My <span className="long">family</span></button>
            <button type="button" aria-pressed={view === 'spouse'} onClick={() => setView('spouse')}>Spouse<span className="long">'s family</span></button>
          </div>
        )}
        <span className="spacer" />
        {picker}
        <FileMenu onSave={saveToFile} onOpen={openPicker} onClear={clearDevice} note={saved} />
        {fileInput}
        <button type="button" onClick={copyLink} title={hasYears ? 'A link carries the tree and names. Birth years go in a saved file.' : undefined}>{copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Failed' : <>Copy<span className="long"> link{hasYears ? ' (names only)' : ''}</span></>}</button>
      </header>
      {error && (
        <p className="notice" role="alert">
          Couldn't open that link ({error}). Showing your saved tree.{' '}
          <button type="button" onClick={() => setError(undefined)}>Dismiss</button>
        </p>
      )}
      {fileError && (
        <p className="notice" role="alert">
          {fileError}{' '}
          <button type="button" onClick={dismissFileError}>Dismiss</button>
        </p>
      )}
      <div className="stage" style={{ '--inset-b': box && !box.panel ? `${box.height}px` : '0px', '--inset-r': box?.panel ? `${box.width}px` : '0px' } as React.CSSProperties}>
        <TreeView tree={tree} me={me} show={show} onPick={pick} onBlank={blank} onGen={g => setGenOf(() => g)} focusId={focus} insets={box ? { bottom: box.panel ? 0 : box.height, right: box.panel ? box.width : 0 } : undefined} lang={lang} />
        {focus && tree.people.some(p => p.id === focus) && (
          <PersonPopup
            key={focus}
            tree={tree}
            me={me}
            id={focus}
            lang={lang}
            gen={genOf(focus)}
            requested={requested}
            note={note}
            onTree={(t, newId) => changed(t, newId ?? me)}
            onViewAs={() => viewAs(focus)}
            onRemove={() => removeAt(focus)}
            onClose={() => setFocus(null)}
            onSwitch={id => { setRequested(null); setDirty(false); setFocus(id || null); }}
            onKeep={() => setRequested(null)}
            onDirty={setDirty}
            onSize={setBox}
          />
        )}
        {!focus && <p className="viewing" aria-live="polite">Viewing as: <strong>{viewingAs(tree, me)}</strong></p>}
      </div>
      {editingPet && (
        <EditPet
          key={editingPet.id}
          pet={editingPet}
          owner={tree.people.find(p => p.id === editingPet.owner)?.name ?? rootLabel(tree, editingPet.owner) ?? 'someone'}
          onSave={name => { setTree(renamePet(tree, editingPet.id, cleanName(name))); setPetEditing(null); }}
          onRemove={() => { setTree(removePet(tree, editingPet.id)); setPetEditing(null); }}
          onCancel={() => setPetEditing(null)}
        />
      )}
    </div>
  );
}

