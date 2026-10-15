import { useEffect, useRef, useState } from 'react';
import type { Pet } from '../../engine/src/index.ts';
import { PET_LABEL, PetArt } from './PetArt.tsx';
import { MAX_NAME } from './rename.ts';

interface Props {
  pet: Pet;
  owner: string;          // "Mei", or how the owner is described when unnamed
  onSave: (name: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}

// The sheet for a pet (tap it): rename it or take it off the tree. The same native <dialog> as the person sheet.
export function EditPet({ pet, owner, onSave, onRemove, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(pet.name ?? '');
  const [removing, setRemoving] = useState(false);
  const what = `${owner}'s ${PET_LABEL[pet.kind].toLowerCase()}`;

  useEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    d.focus({ preventScroll: true }); // keep the phone keyboard down until the field is tapped
    return () => { if (d.open) d.close(); back?.focus({ preventScroll: true }); };
  }, []);

  return (
    <dialog ref={ref} tabIndex={-1} className="confirm" aria-labelledby="pet-title"
      onCancel={e => { e.preventDefault(); onCancel(); }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <form className="confirm-body rename" onSubmit={e => { e.preventDefault(); onSave(value); }}>
        <h2 id="pet-title" className="pet-title"><PetArt kind={pet.kind} />Edit {pet.name || what}</h2>
        <label>
          Name (optional)
          <input value={value} onChange={e => setValue(e.target.value)} maxLength={MAX_NAME * 2}
            placeholder="what you call them" autoComplete="off" enterKeyHint="done" />
        </label>
        <p>{pet.name ? `${pet.name} is ${what}.` : `Leave it empty to show them as ${PET_LABEL[pet.kind].toLowerCase()}.`}</p>
        {removing ? (
          <div className="remove-confirm" role="alert">
            <p>Remove {pet.name || what} from the tree?</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setRemoving(false)}>Keep</button>
              <button type="button" className="danger" onClick={onRemove}>Remove</button>
            </div>
          </div>
        ) : (
          <>
            <div className="sheet-links">
              <span />
              <button type="button" className="danger-link" onClick={() => setRemoving(true)}>Remove…</button>
            </div>
            <div className="confirm-actions">
              <button type="button" onClick={onCancel}>Cancel</button>
              <button type="submit" className="primary">Save</button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
