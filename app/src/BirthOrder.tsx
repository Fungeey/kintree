import { useRef, useState } from 'react';

interface Props {
  others: string[];     // everyone else in the group, eldest first
  self: string;         // the one being placed
  slot: number;         // where `self` sits: 0 = eldest, others.length = youngest
  onSlot: (slot: number) => void;
}

// Birth order as a numbered list: drag the handle on one row (mouse or touch) or use the arrow keys.
// Used both for moving someone already on the tree and for placing someone being added.
export function BirthOrder({ others, self, slot, onSlot }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState(false);
  const total = others.length + 1;
  const rows = [...others.slice(0, slot), null, ...others.slice(slot)];

  // The slot is the row under the pointer.
  const slotAt = (y: number) => {
    const r = list.current!.getBoundingClientRect();
    return Math.min(total - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * total)));
  };

  return (
    <fieldset className="order">
      <legend>Birth order</legend>
      <p className="order-help">Drag the handle to move {self}. Eldest is first.</p>
      <ol ref={list} aria-label="Siblings, eldest first">
        {rows.map((name, i) => name === null ? (
          <li key="self" className={`self${dragging ? ' dragging' : ''}`}>
            <span className="pos">{i + 1}</span>
            <span className="who">{self}</span>
            <button
              type="button"
              className="grip"
              aria-label={`Move ${self}. Position ${slot + 1} of ${total}. Use the up and down arrow keys.`}
              onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(true); }}
              onPointerMove={e => { if (dragging) onSlot(slotAt(e.clientY)); }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onKeyDown={e => {
                if (e.key === 'ArrowUp' && slot > 0) { e.preventDefault(); onSlot(slot - 1); }
                if (e.key === 'ArrowDown' && slot < total - 1) { e.preventDefault(); onSlot(slot + 1); }
              }}
            >
              <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
                {[3, 9, 15].map(y => [3, 9].map(x => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
              </svg>
            </button>
          </li>
        ) : <li key={i}><span className="pos">{i + 1}</span><span className="who">{name}</span></li>)}
      </ol>
    </fieldset>
  );
}
