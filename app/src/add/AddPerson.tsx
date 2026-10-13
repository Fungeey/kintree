// Add-person entry component (slice 4b).
//
// Interface for the app shell (4a):
//   <AddPerson tree={tree} me={meId} onChange={(tree, newId) => ...} />
// `from` (optional) is the person to add a relative to; it defaults to `me`.
// On an empty tree it asks for "me" first; onChange then gets the one-person tree and its id.
// The component never mutates `tree`; it only calls onChange with the edited copy.
import { useState } from 'react';
import type { Sex, Tree, Person } from '../../../engine/src/index.ts';
import { BirthOrder } from '../BirthOrder.tsx';
import { availableRelations, slotQuestion, applyAdd, startTree, suggestSex } from './flow.ts';
import type { Relation } from './flow.ts';

export interface AddPersonProps {
  tree: Tree;
  me: string | null;
  from?: string;
  onChange: (tree: Tree, newId: string) => void;
}

const RELATION_LABEL: Record<Relation, string> = {
  parent: 'Parent', child: 'Child', spouse: 'Spouse', sibling: 'Brother or sister',
};
const label = (p: Person, relation: Relation) =>
  p.name || (relation === 'child' ? (p.sex === 'm' ? 'son' : 'daughter') : (p.sex === 'm' ? 'brother' : 'sister'));

function SexAndName(props: { initialSex: Sex | null; submitText: string; nameLabel?: string; required?: boolean; onSubmit: (sex: Sex, name: string) => void }) {
  const [sex, setSex] = useState<Sex | null>(props.initialSex);
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (sex && (!props.required || name.trim())) props.onSubmit(sex, name); }}>
      <div className="choices" role="radiogroup" aria-label="Sex">
        {(['m', 'f'] as Sex[]).map(s => (
          <button type="button" key={s} role="radio" aria-checked={sex === s} onClick={() => setSex(s)}>
            {s === 'm' ? 'Male' : 'Female'}
          </button>
        ))}
      </div>
      <label>{props.nameLabel ?? 'Name (optional)'} <input value={name} onChange={e => setName(e.target.value)} placeholder="nickname or initials" required={props.required} autoFocus={props.required} /></label>
      <button type="submit" disabled={!sex || (props.required && !name.trim())}>{props.submitText}</button>
    </form>
  );
}

export function AddPerson({ tree, me, from, onChange }: AddPersonProps) {
  const [relation, setRelation] = useState<Relation | null>(null);
  const [pending, setPending] = useState<{ sex: Sex; name: string } | null>(null);
  const [slot, setSlot] = useState(0);
  const reset = () => { setRelation(null); setPending(null); };

  if (tree.people.length === 0) {
    return (
      <section className="add-person">
        <h3>Start with yourself</h3>
        <p>Your name goes on the tree, so cards can say “{'<'}your name{'>'}'s father”.</p>
        <SexAndName initialSex={null} submitText="Start" nameLabel="Your name" required
          onSubmit={(sex, name) => { const r = startTree(sex, name); onChange(r.tree, r.id); }} />
      </section>
    );
  }

  const target = from ?? me;
  const person = tree.people.find(p => p.id === target);
  if (!person) return <section className="add-person">Pick someone in the tree first.</section>;
  const who = person.name || 'this person';

  const finish = (sex: Sex, name: string, slot?: number) => {
    const r = applyAdd(tree, { from: person.id, relation: relation!, sex, name, slot });
    reset();
    onChange(r.tree, r.id);
  };

  if (!relation) {
    return (
      <section className="add-person">
        <h3>Add a relative of {who}</h3>
        <div className="choices">
          {availableRelations(tree, person.id).map(r => (
            <button type="button" key={r} onClick={() => setRelation(r)}>{RELATION_LABEL[r]}</button>
          ))}
        </div>
      </section>
    );
  }

  if (!pending) {
    return (
      <section className="add-person">
        <h3>{RELATION_LABEL[relation]} of {who}</h3>
        <SexAndName initialSex={suggestSex(tree, person.id, relation)} submitText="Next"
          onSubmit={(sex, name) => {
            const q = slotQuestion(tree, person.id, relation);
            if (q) { setSlot(q.members.length); setPending({ sex, name }); } // youngest unless moved
            else finish(sex, name);
          }} />
        <button type="button" className="back" onClick={reset}>Back</button>
      </section>
    );
  }

  const q = slotQuestion(tree, person.id, relation)!;
  return (
    <section className="add-person">
      <h3>Where in the birth order?</h3>
      <BirthOrder others={q.members.map(p => label(p, relation))} self={pending.name.trim() || 'New person'} slot={slot} onSlot={setSlot} />
      <button type="button" className="add-here" onClick={() => finish(pending.sex, pending.name, slot)}>Add</button>
      <button type="button" className="back" onClick={() => setPending(null)}>Back</button>
    </section>
  );
}
