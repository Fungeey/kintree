// Add-person entry component (slice 4b).
//
// Interface for the app shell (4a):
//   <AddPerson tree={tree} me={meId} onChange={(tree, newId) => ...} />
// `from` (optional) is the person to add a relative to; it defaults to `me`.
// On an empty tree it asks for "me" first; onChange then gets the one-person tree and its id.
// The component never mutates `tree`; it only calls onChange with the edited copy.
import { useState } from 'react';
import type { Sex, Tree, Person } from '../../../engine/src/index.ts';
import { availableRelations, slotQuestion, slotLabels, applyAdd, startTree, suggestSex } from './flow.ts';
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
const label = (p: Person) => p.name || (p.sex === 'm' ? 'brother/son' : 'sister/daughter');

function SexAndName(props: { initialSex: Sex | null; submitText: string; onSubmit: (sex: Sex, name: string) => void }) {
  const [sex, setSex] = useState<Sex | null>(props.initialSex);
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (sex) props.onSubmit(sex, name); }}>
      <div className="choices" role="radiogroup" aria-label="Sex">
        {(['m', 'f'] as Sex[]).map(s => (
          <button type="button" key={s} role="radio" aria-checked={sex === s} onClick={() => setSex(s)}>
            {s === 'm' ? 'Male' : 'Female'}
          </button>
        ))}
      </div>
      <label>Name (optional) <input value={name} onChange={e => setName(e.target.value)} placeholder="nickname or initials" /></label>
      <button type="submit" disabled={!sex}>{props.submitText}</button>
    </form>
  );
}

export function AddPerson({ tree, me, from, onChange }: AddPersonProps) {
  const [relation, setRelation] = useState<Relation | null>(null);
  const [pending, setPending] = useState<{ sex: Sex; name: string } | null>(null);
  const reset = () => { setRelation(null); setPending(null); };

  if (tree.people.length === 0) {
    return (
      <section className="add-person">
        <h3>Start with yourself</h3>
        <SexAndName initialSex={null} submitText="Start"
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
            if (slotQuestion(tree, person.id, relation)) setPending({ sex, name });
            else finish(sex, name);
          }} />
        <button type="button" className="back" onClick={reset}>Back</button>
      </section>
    );
  }

  const q = slotQuestion(tree, person.id, relation)!;
  const labels = slotLabels(q.members, label);
  return (
    <section className="add-person">
      <h3>Where in the birth order?</h3>
      <p>Existing children, eldest first. Tap the slot for the new one.</p>
      <ol className="slots">
        {labels.map((text, i) => (
          <li key={i} style={{ listStyle: 'none' }}>
            <button type="button" onClick={() => finish(pending.sex, pending.name, i)}>{text}</button>
            {i < q.members.length && <div>{label(q.members[i])}</div>}
          </li>
        ))}
      </ol>
      <button type="button" className="back" onClick={() => setPending(null)}>Back</button>
    </section>
  );
}
