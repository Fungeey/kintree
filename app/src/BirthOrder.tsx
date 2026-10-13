import { useEffect, useRef, useState } from 'react';

export interface OrderRow { key: string; label: string }

interface Props {
  rows: OrderRow[];     // everyone in the group, eldest first
  self?: string;        // key of the row being edited or added, shown highlighted
  onChange: (keys: string[]) => void;
}

// Birth order as a numbered list. Every row has a handle: drag it (mouse or touch) or use the arrow keys.
// Used both for editing someone already on the tree and for placing someone being added.
export function BirthOrder({ rows, self, onChange }: Props) {
  const list = useRef<HTMLOListElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const keys = rows.map(r => r.key);

  const moveTo = (key: string, to: number) => {
    const at = keys.indexOf(key);
    if (to === at || to < 0 || to >= keys.length) return;
    const next = keys.filter(k => k !== key);
    next.splice(to, 0, key);
    onChange(next);
  };
  // The slot is the row under the pointer.
  const slotAt = (y: number) => {
    const r = list.current!.getBoundingClientRect();
    return Math.min(keys.length - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * keys.length)));
  };

  // While a handle is held, follow the pointer on the window. Pointer capture on the handle would be lost when
  // React moves its row in the DOM, which happens as soon as the row is dragged down past a neighbour.
  const latest = useRef({ moveTo, slotAt });
  latest.current = { moveTo, slotAt };
  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) => latest.current.moveTo(dragging, latest.current.slotAt(e.clientY));
    const stop = () => setDragging(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [dragging]);

  return (
    <fieldset className="order">
      <legend>Birth order</legend>
      <p className="order-help">Drag the handles to reorder. Eldest is first.</p>
      <ol ref={list} aria-label="Siblings, eldest first">
        {rows.map((row, i) => (
          <li key={row.key} className={`${row.key === self ? 'self' : ''}${row.key === dragging ? ' dragging' : ''}`}>
            <span className="pos">{i + 1}</span>
            <span className="who">{row.label}</span>
            <button
              type="button"
              className="grip"
              aria-label={`Move ${row.label}. Position ${i + 1} of ${rows.length}. Use the up and down arrow keys.`}
              onPointerDown={e => { e.preventDefault(); e.currentTarget.focus(); setDragging(row.key); }}
              onKeyDown={e => {
                if (e.key === 'ArrowUp') { e.preventDefault(); moveTo(row.key, i - 1); }
                if (e.key === 'ArrowDown') { e.preventDefault(); moveTo(row.key, i + 1); }
              }}
            >
              <svg viewBox="0 0 12 18" width="12" height="18" aria-hidden="true">
                {[3, 9, 15].map(y => [3, 9].map(x => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" />))}
              </svg>
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
