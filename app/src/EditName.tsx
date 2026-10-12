import { useEffect, useRef, useState } from 'react';
import type { Person } from '../../engine/src/index.ts';
import { cleanName, MAX_NAME } from './rename.ts';

interface Props {
  who: string;            // how the person is described when they have no name ("Mei's father")
  name: string;
  required: boolean;
  siblings: Person[];     // everyone in their birth family, eldest first (just them when they have no siblings)
  self: string;
  onSave: (name: string, slot: number) => void;
  onCancel: () => void;
}

const called = (p: Person) => p.name || (p.sex === 'm' ? 'brother' : 'sister');

// Edit mode's sheet: rename someone and move them in the birth order. A native modal <dialog>, like the switch confirmation.
export function EditName({ who, name, required, siblings, self, onSave, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const [slot, setSlot] = useState(Math.max(0, siblings.findIndex(p => p.id === self)));
  const empty = !cleanName(value);

  useEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    input.current?.select();
    return () => { if (d.open) d.close(); back?.focus({ preventScroll: true }); };
  }, []);

  // The siblings as they would read after the move, with this person shown by the name being typed.
  const others = siblings.filter(p => p.id !== self);
  const me = siblings.find(p => p.id === self);
  const line = me ? [...others.slice(0, slot).map(called), '', ...others.slice(slot).map(called)] : [];
  const here = cleanName(value) || (me ? called(me) : '');

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="rename-title"
      onCancel={e => { e.preventDefault(); onCancel(); }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="confirm-body rename" onSubmit={e => { e.preventDefault(); if (!(required && empty)) onSave(value, slot); }}>
        <h2 id="rename-title">Edit {name || who}</h2>
        <label>
          {required ? 'Name' : 'Name (optional)'}
          <input ref={input} value={value} onChange={e => setValue(e.target.value)} maxLength={MAX_NAME * 2}
            placeholder="nickname or initials" required={required} autoComplete="off" enterKeyHint="done" />
        </label>
        <p>{required ? 'Everyone’s card is labelled with this name.' : 'Leave it empty to show them by relation.'}</p>
        {siblings.length > 1 && (
          <fieldset className="order">
            <legend>Birth order</legend>
            <ol aria-label="Siblings, eldest first">
              {line.map((t, i) => <li key={i} className={t === '' ? 'self' : undefined}>{t === '' ? here : t}</li>)}
            </ol>
            <div className="order-btns">
              <button type="button" disabled={slot === 0} onClick={() => setSlot(slot - 1)}>← Older</button>
              <button type="button" disabled={slot === others.length} onClick={() => setSlot(slot + 1)}>Younger →</button>
            </div>
          </fieldset>
        )}
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={required && empty}>Save</button>
        </div>
      </form>
    </dialog>
  );
}
