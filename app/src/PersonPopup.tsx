import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { setBirthOrder, setBorn } from '../../engine/src/index.ts';
import type { Person, Tree } from '../../engine/src/index.ts';
import { MAX_NOTE } from '../../storage/src/index.ts';
import { AddPerson } from './add/AddPerson.tsx';
import { BirthOrder } from './BirthOrder.tsx';
import { aboutLines, maxYear, orderByYear, orderConflict, parseYear } from './details.ts';
import { captionFor, showFor } from './display.ts';
import { spokenText } from './audio/speech.ts';
import { useSpeech } from './audio/useSpeech.ts';
import { faceUrl, initials } from './faces.ts';
import { ageFor, HairBack, HairFront, toneFor } from './Hair.tsx';
import { DEFAULT_LANG, langFor, NONE } from './lang.ts';
import type { LangChoice } from './lang.ts';
import { applyRename, cleanName, MAX_NAME, nameRequired, siblingsOf } from './rename.ts';

// The person popup (METADATA.md section 3): tapping anyone opens it. Main view: header, About, My notes, buttons.
// The pencil edits the profile (name, birth year); Relatives is the old edit sheet (birth order, add, remove).
// Notes save by themselves; the profile and Relatives views have Save and Cancel and ask before throwing changes away.

export interface NoteApi {
  get: (id: string) => string;
  set: (id: string, text: string) => boolean;   // false when the browser could not keep it
}

interface Props {
  tree: Tree;
  me: string;
  id: string;
  lang: LangChoice;
  gen: number;                              // generation row relative to the tree's first person, for the hair
  requested: string | null;                 // someone else was tapped (or '' for the tree background) while this view has unsaved changes
  note: NoteApi;
  onTree: (tree: Tree, newId?: string) => void;
  onViewAs: () => void;
  onRemove: () => void;
  onClose: () => void;
  onSwitch: (id: string) => void;           // go to the requested person ('' closes the popup)
  onKeep: () => void;                       // stay on this person
  onDirty: (dirty: boolean) => void;
  onSize: (box: { height: number; width: number; panel: boolean } | null) => void;
}

type View = 'main' | 'profile' | 'relatives';
interface Form { save: () => boolean }

const called = (p: Person) => p.name || (p.sex === 'm' ? 'brother' : 'sister');

export function displayName(tree: Tree, me: string, p: Person): string {
  return p.name?.trim() || captionFor(tree, p.id) || (p.id === me ? 'You' : p.sex === 'm' ? 'Man' : 'Woman');
}

export function PersonPopup({ tree, me, id, lang: choice, gen, requested, note, onTree, onViewAs, onRemove, onClose, onSwitch, onKeep, onDirty, onSize }: Props) {
  const person = tree.people.find(p => p.id === id)!;
  const [view, setView] = useState<View>('main');
  const [dirty, setDirty] = useState(false);
  const [prompt, setPrompt] = useState<{ run: () => void } | null>(null);
  const form = useRef<Form | null>(null);
  const root = useRef<HTMLElement>(null);

  const bare = choice === NONE;
  const lang = bare ? DEFAULT_LANG : choice;
  const shown = showFor(tree, me, id, lang);
  const isMe = id === me;
  const name = displayName(tree, me, person);
  const speech = useSpeech(lang);
  const text = spokenText(shown, lang);
  const canPlay = !bare && speech.state === 'ready' && text !== '';

  useEffect(() => { onDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onDirty(false), []);      // eslint-disable-line react-hooks/exhaustive-deps

  // Report the popup's size so the tree can keep the person in the part of the screen the popup leaves free.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const report = () => onSize({ height: el.offsetHeight, width: el.offsetWidth, panel: window.matchMedia('(min-width: 720px)').matches });
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => { ro.disconnect(); onSize(null); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = (then: () => void) => { if (dirty) setPrompt({ run: then }); else then(); };
  const toMain = () => { setDirty(false); setView('main'); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (prompt || requested !== null) { setPrompt(null); if (requested !== null) onKeep(); return; }
      if (view === 'main') onClose(); else leave(toMain);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  const asking = prompt !== null || requested !== null;
  const answer = (what: 'keep' | 'discard' | 'save') => {
    const go = () => { if (prompt) { setPrompt(null); prompt.run(); } else if (requested !== null) onSwitch(requested); };
    if (what === 'keep') { setPrompt(null); if (requested !== null) onKeep(); return; }
    if (what === 'save' && !(form.current?.save() ?? true)) return;
    if (what === 'discard') setDirty(false);
    go();
  };

  const saveProfile = (n: string, born: number | undefined): boolean => {
    let t = applyRename(tree, id, n);
    if (!t) return false;
    t = setBorn(t, id, born);
    onTree(t);
    toMain();
    return true;
  };
  const saveOrder = (order: string[]) => { onTree(setBirthOrder(tree, id, order)); toMain(); };

  const lines = aboutLines(shown, isMe, person.born);
  const firstName = person.name?.trim();

  return (
    <aside className="popup" ref={root} role="dialog" aria-label={`${name}: details`}>
      <div className="grab" aria-hidden="true" />
      {asking && (
        <div className="popup-prompt" role="alertdialog" aria-labelledby="prompt-title">
          <h3 id="prompt-title">Save changes to {name}?</h3>
          <p>You have changes that aren't saved yet.</p>
          <div className="popup-actions">
            <button type="button" className="link" onClick={() => answer('keep')}>Keep editing</button>
            <button type="button" onClick={() => answer('discard')}>Discard</button>
            <button type="button" className="primary" onClick={() => answer('save')}>Save</button>
          </div>
        </div>
      )}
      {/* The form stays mounted under the question, so "Keep editing" finds the changes as they were. */}
      <div hidden={asking}>
      {view === 'main' ? (
        <>
          <div className="popup-head">
            <div className="popup-face">
              <Face person={person} isMe={isMe} gen={gen} />
              <button type="button" className="pencil" aria-label="Edit profile" title="Edit profile" onClick={() => setView('profile')}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4-1 11-11-3-3L5 16z" /><path d="M14 7l3 3" /></svg>
              </button>
            </div>
            <div className="popup-who">
              <h2 className="popup-name">{name}</h2>
              {!bare && shown.lines.length > 0 && (
                <p className="popup-title" lang={langFor(lang).html}>
                  {shown.lines.map((l, i) => (
                    <span key={i} className="popup-line">
                      {l.label && <i>{l.label}</i>}
                      {l.rom && <b>{l.rom}</b>}
                      <span className="zh">{l.kana && l.kana !== l.chars ? <ruby>{l.chars}<rt>{l.kana}</rt></ruby> : l.chars}</span>
                    </span>
                  ))}
                </p>
              )}
            </div>
            {canPlay && (
              <button type="button" className="popup-play" aria-label={`Play ${text}`} title="Play" onClick={() => speech.speak(text, id)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5c1.6 1.6 1.6 5.4 0 7M18.5 6c3 3 3 9 0 12" fill="none" /></svg>
              </button>
            )}
          </div>
          <div className="popup-actions main">
            {!isMe && <button type="button" className="dark" onClick={onViewAs}>View tree as {firstName || 'them'}</button>}
            <button type="button" onClick={() => setView('relatives')}>Relatives</button>
          </div>
          {lines.length > 0 && (
            <section className="popup-field" aria-label="About">
              <h3 className="label">About</h3>
              <p className="popup-about">{lines.map((l, i) => <span key={i}>{l}</span>)}</p>
            </section>
          )}
          <Notes key={id} id={id} note={note} />
        </>
      ) : view === 'profile' ? (
        <ProfileForm
          key={id}
          person={person}
          required={nameRequired(tree, id)}
          onSave={saveProfile}
          onCancel={() => leave(toMain)}
          onDirty={setDirty}
          register={f => { form.current = f; }}
          save={(n, b) => saveProfile(n, b)}
        />
      ) : (
        <Relatives
          key={id}
          tree={tree}
          self={id}
          me={me}
          name={name}
          onOrder={order => onTree(setBirthOrder(tree, id, order))}
          onSave={saveOrder}
          onAdded={(t, newId) => { onTree(t, newId); toMain(); }}
          onRemove={onRemove}
          onCancel={() => leave(toMain)}
          onDirty={setDirty}
          register={f => { form.current = f; }}
        />
      )}
      </div>
    </aside>
  );
}

// The same drawn face as the card (hair from their generation), larger.
function Face({ person, isMe, gen }: { person: Person; isMe: boolean; gen: number }) {
  const [broken, setBroken] = useState(false);
  const age = ageFor(gen), tone = toneFor(gen);
  return (
    <span className={`popup-photo sex-${person.sex}`}>
      <HairBack sex={person.sex} age={age} tone={tone} />
      <span className="face">
        {broken
          ? <span className="initials">{initials(person.name, isMe, person.sex)}</span>
          : <img src={faceUrl(person.id)} alt="" draggable={false} onError={() => setBroken(true)} />}
      </span>
      <HairFront sex={person.sex} age={age} tone={tone} />
    </span>
  );
}

// My notes: type straight away. They save about a second after typing stops, and when the box loses focus or the
// popup closes or moves to someone else. Notes live in this browser only, so "Saved" never means "shared".
function Notes({ id, note }: { id: string; note: NoteApi }) {
  const [text, setText] = useState(() => note.get(id));
  const [status, setStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const api = useRef(note);
  api.current = note;

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (pending.current === null) return;
    const ok = api.current.set(id, pending.current);
    pending.current = null;
    setStatus(ok ? 'saved' : 'failed');
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (v: string) => {
    setText(v);
    pending.current = v;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 1000);
  };
  const label = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved';
  return (
    <section className="popup-field notes">
      <div className="notes-head">
        <label className="label" htmlFor={`note-${id}`}>My notes</label>
        <span className={`notes-status ${status}`} role="status" aria-live="polite">{label}</span>
      </div>
      <textarea id={`note-${id}`} value={text} maxLength={MAX_NOTE} rows={3} placeholder="Add a note"
        onChange={e => change(e.target.value)} onBlur={flush} />
    </section>
  );
}

interface FormProps { onDirty: (d: boolean) => void; register: (f: Form | null) => void }

function ProfileForm({ person, required, onSave, onCancel, onDirty, register, save }: FormProps & {
  person: Person;
  required: boolean;
  onSave: (name: string, born: number | undefined) => boolean;
  onCancel: () => void;
  save: (name: string, born: number | undefined) => boolean;
}) {
  const [name, setName] = useState(person.name ?? '');
  const [year, setYear] = useState(person.born === undefined ? '' : String(person.born));
  const parsed = parseYear(year);
  const empty = !cleanName(name);
  const blocked = (required && empty) || 'error' in parsed;
  const dirty = cleanName(name) !== (person.name ?? '') || year.trim() !== (person.born === undefined ? '' : String(person.born));

  useEffect(() => { onDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  register({ save: () => (blocked ? false : save(name, 'error' in parsed ? undefined : parsed.year)) });
  useEffect(() => () => register(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form className="popup-form" onSubmit={e => { e.preventDefault(); if (!blocked) onSave(name, 'error' in parsed ? undefined : parsed.year); }}>
      <h2 className="popup-formtitle">Edit profile</h2>
      <label className="field">
        {required ? 'Name' : 'Name (optional)'}
        <input value={name} onChange={e => setName(e.target.value)} maxLength={MAX_NAME * 2} placeholder="nickname or initials"
          required={required} autoComplete="off" enterKeyHint="next" />
      </label>
      <p className="hint">{required ? 'Everyone’s card is labelled with this name.' : 'Leave it empty to show them by relation.'}</p>
      <label className="field narrow">
        Born (year)
        <input value={year} onChange={e => setYear(e.target.value)} inputMode="numeric" maxLength={4} placeholder={`e.g. ${maxYear() - 50}`}
          autoComplete="off" aria-invalid={'error' in parsed} aria-describedby="year-error" enterKeyHint="done" />
      </label>
      <p id="year-error" className="hint error" role="alert">{'error' in parsed ? parsed.error : ''}</p>
      <div className="popup-actions">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary" disabled={blocked}>Save</button>
      </div>
    </form>
  );
}

// Relatives: the old edit sheet's layout (birth order, + Add relative, Remove…, Cancel / Save) without the Name field.
function Relatives({ tree, self, me, name, onOrder, onSave, onAdded, onRemove, onCancel, onDirty, register }: FormProps & {
  tree: Tree;
  self: string;
  me: string;
  name: string;
  onOrder: (order: string[]) => void;
  onSave: (order: string[]) => void;
  onAdded: (tree: Tree, id: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}) {
  const siblings = siblingsOf(tree, self).map(id => tree.people.find(p => p.id === id)!);
  const base = useRef(siblings.map(p => p.id).join('|'));
  const [order, setOrder] = useState(() => siblings.map(p => p.id));
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const dirty = order.join('|') !== base.current;

  useEffect(() => { onDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  register({ save: () => { onSave(order); return true; } });
  useEffect(() => () => register(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = order.map(id => {
    const p = tree.people.find(x => x.id === id)!;
    return { key: id, label: id === self ? name : called(p) };
  });
  const conflict = siblings.length > 1 && orderConflict(tree, order);

  // Adding acts at once, so an order change made first is applied first and nothing is lost.
  const startAdd = () => {
    if (dirty) { onOrder(order); base.current = order.join('|'); }
    setAdding(true);
  };

  if (adding) {
    return (
      <div className="popup-form rename">
        <AddPerson tree={tree} me={self} from={self} onChange={onAdded} onCancel={() => setAdding(false)} />
      </div>
    );
  }
  return (
    <form className="popup-form rename" onSubmit={e => { e.preventDefault(); onSave(order); }}>
      <h2 className="popup-formtitle">Relatives</h2>
      {siblings.length > 1 && <BirthOrder rows={rows} self={self} onChange={setOrder} />}
      {conflict && (
        <p className="order-warning" role="status">
          Birth years don't match this order.{' '}
          <button type="button" className="link" onClick={() => setOrder(orderByYear(tree, order))}>Reorder by year</button>
        </p>
      )}
      {removing ? (
        <div className="remove-confirm" role="alert">
          <p>Remove {name} from the tree?{tree.root === self ? ' Cards will no longer be labelled with their name.' : ''}</p>
          <div className="popup-actions">
            <button type="button" onClick={() => setRemoving(false)}>Keep</button>
            <button type="button" className="danger" onClick={onRemove}>Remove</button>
          </div>
        </div>
      ) : (
        <>
          <div className="sheet-links">
            <button type="button" onClick={startAdd}>+ Add relative</button>
            <button type="button" className="danger-link" onClick={() => setRemoving(true)}>Remove…</button>
          </div>
          <div className="popup-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary">Save</button>
          </div>
        </>
      )}
    </form>
  );
}

export type { ReactNode };
