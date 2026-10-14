import type { Pet } from '../../engine/src/index.ts';
import { PET_LABEL, PetArt } from './PetArt.tsx';

interface Props {
  pet: Pet;
  owner: string | null;   // the owner's name, for the screen-reader label
  x: number;
  y: number;
  onPick: (id: string) => void;
  bare?: boolean;
}

// A pet's card: its drawing in the face circle, its name above as for people, and what it is where a person's title goes.
// Pets have no titles, so there is nothing to read aloud.
export function PetCard({ pet, owner, x, y, onPick, bare = false }: Props) {
  const kind = PET_LABEL[pet.kind];
  const name = pet.name?.trim();
  return (
    <div data-id={pet.id} className={`node pet${bare ? ' bare' : ''}`} style={{ left: x, top: y }}>
      <div className="root-label" title={name}>{!bare && name && <span>{name}</span>}</div>
      <button type="button" className="face-btn" onClick={() => onPick(pet.id)}
        aria-label={`${name ? `${name}, ` : ''}${owner ? `${owner}'s ` : ''}${kind.toLowerCase()}`}>
        <span className="face"><PetArt kind={pet.kind} /></span>
      </button>
      <div className={`titles pet-kind${bare ? ' bare-name' : ''}`}><span>{bare ? name || kind : kind}</span></div>
    </div>
  );
}
