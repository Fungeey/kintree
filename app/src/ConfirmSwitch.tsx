import { useEffect, useRef } from 'react';

interface Props {
  who: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// A native modal <dialog>: it traps focus, closes on Escape and labels itself for screen readers.
export function ConfirmSwitch({ who, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const yes = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current!;
    const back = document.activeElement as HTMLElement | null;
    d.showModal();
    yes.current?.focus();
    return () => { if (d.open) d.close(); back?.focus({ preventScroll: true }); };
  }, []);

  return (
    <dialog
      ref={ref}
      className="confirm"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      onCancel={e => { e.preventDefault(); onCancel(); }}
      // A tap on the backdrop lands on the <dialog> itself; taps inside land on its contents.
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="confirm-body">
        <h2 id="confirm-title">View family tree as {who}?</h2>
        <p id="confirm-desc">Everyone's titles will be shown from their point of view.</p>
        <div className="confirm-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" ref={yes} onClick={onConfirm}>Switch</button>
        </div>
      </div>
    </dialog>
  );
}
