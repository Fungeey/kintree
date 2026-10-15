import { useEffect, useRef, useState } from 'react';

interface Props {
  onSave: () => void;
  onOpen: () => void;
  onClear: () => void;
  note?: string | null;   // brief result of the last save ("Saved"), shown in place of the label
}

// The header's "File" button: Save file / Open file / Clear this device.
export function FileMenu({ onSave, onOpen, onClear, note }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const pick = (f: () => void) => () => { setOpen(false); f(); };
  return (
    <div className="file-menu" ref={box}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{note ?? 'File'}</button>
      {open && (
        <div className="file-pop" role="menu">
          <button type="button" role="menuitem" onClick={pick(onSave)}>Save file</button>
          <button type="button" role="menuitem" onClick={pick(onOpen)}>Open file…</button>
          <button type="button" role="menuitem" className="danger-item" onClick={pick(onClear)}>Clear this device…</button>
        </div>
      )}
    </div>
  );
}
