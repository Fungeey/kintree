import { useEffect, useRef, useState } from 'react';
import { cleanName, MAX_NAME } from './rename.ts';

interface Props {
  who: string;            // how the person is described when they have no name ("Mei's father")
  name: string;
  required: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}

// Edit mode's rename sheet: a native modal <dialog>, like the switch confirmation.
export function EditName({ who, name, required, onSave, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(name);
  const empty = !cleanName(value);

  useEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    input.current?.select();
    return () => { if (d.open) d.close(); back?.focus({ preventScroll: true }); };
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="rename-title"
      onCancel={e => { e.preventDefault(); onCancel(); }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form className="confirm-body rename" onSubmit={e => { e.preventDefault(); if (!(required && empty)) onSave(value); }}>
        <h2 id="rename-title">Rename {name || who}</h2>
        <label>
          {required ? 'Name' : 'Name (optional)'}
          <input ref={input} value={value} onChange={e => setValue(e.target.value)} maxLength={MAX_NAME * 2}
            placeholder="nickname or initials" required={required} autoComplete="off" enterKeyHint="done" />
        </label>
        <p>{required ? 'Everyone’s card is labelled with this name.' : 'Leave it empty to show them by relation.'}</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary" disabled={required && empty}>Save</button>
        </div>
      </form>
    </dialog>
  );
}
