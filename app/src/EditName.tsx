import { useEffect, useRef, useState } from 'react';
import type { Person, Tree } from '../../engine/src/index.ts';
import { AddPerson } from './add/AddPerson.tsx';
import { BirthOrder } from './BirthOrder.tsx';
import { cleanName, MAX_NAME } from './rename.ts';

interface Props {
  tree: Tree;
  who: string;            // how the person is described when they have no name ("Mei's father")
  name: string;
  required: boolean;
  siblings: Person[];     // everyone in their birth family, eldest first (just them when they have no siblings)
  self: string;
  onSave: (name: string, order: string[]) => void;
  onAdded: (tree: Tree, newId: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

const called = (p: Person) => p.name || (p.sex === 'm' ? 'brother' : 'sister');

// Edit mode's sheet: rename someone and move them in the birth order. A native modal <dialog>, like the switch confirmation.
export function EditName({ tree, who, name, required, siblings, self, onSave, onAdded, onRemove, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const [order, setOrder] = useState(() => siblings.map(p => p.id));
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const empty = !cleanName(value);

  useEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    input.current?.select();
    return () => { if (d.open) d.close(); back?.focus({ preventScroll: true }); };
  }, []);

  const me = siblings.find(p => p.id === self);
  const here = cleanName(value) || (me ? called(me) : '');
  // Their own row follows the name being typed.
  const rows = order.map(id => ({ key: id, label: id === self ? here : called(siblings.find(p => p.id === id)!) }));

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="rename-title"
      onCancel={e => { e.preventDefault(); onCancel(); }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {adding ? (
        <div className="confirm-body rename">
          <AddPerson tree={tree} me={self} from={self} onChange={onAdded} onCancel={() => setAdding(false)} />
        </div>
      ) : (
      <form className="confirm-body rename" onSubmit={e => { e.preventDefault(); if (!(required && empty)) onSave(value, order); }}>
        <h2 id="rename-title">Edit {name || who}</h2>
        <label>
          {required ? 'Name' : 'Name (optional)'}
          <input ref={input} value={value} onChange={e => setValue(e.target.value)} maxLength={MAX_NAME * 2}
            placeholder="nickname or initials" required={required} autoComplete="off" enterKeyHint="done" />
        </label>
        <p>{required ? 'Everyone’s card is labelled with this name.' : 'Leave it empty to show them by relation.'}</p>
        {siblings.length > 1 && <BirthOrder rows={rows} self={self} onChange={setOrder} />}
        {removing ? (
          <div className="remove-confirm" role="alert">
            <p>Remove {name || who} from the tree?{required ? ' Cards will no longer be labelled with their name.' : ''}</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setRemoving(false)}>Keep</button>
              <button type="button" className="danger" onClick={onRemove}>Remove</button>
            </div>
          </div>
        ) : (
          <>
          <div className="sheet-links">
            <button type="button" onClick={() => setAdding(true)}>+ Add relative</button>
            <button type="button" className="danger-link" onClick={() => setRemoving(true)}>Remove…</button>
          </div>
          <div className="confirm-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="primary" disabled={required && empty}>Save</button>
          </div>
          </>
        )}
      </form>
      )}
    </dialog>
  );
}
