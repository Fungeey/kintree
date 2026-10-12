import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Tree } from '../../engine/src/index.ts';
import { CARD_H, CARD_W, coupleHearts, layoutTree, linkSegments } from './layout.ts';
import { showFor } from './display.ts';
import { PersonCard } from './PersonCard.tsx';
import { useSpeech } from './audio/useSpeech.ts';

interface Props {
  tree: Tree;
  me: string;
  show: (id: string) => boolean;
  onPick: (id: string) => void;
}

interface Cam { x: number; y: number; k: number }
const MIN_K = 0.25, MAX_K = 2;

export function TreeView({ tree, me, show, onPick }: Props) {
  const layout = useMemo(() => layoutTree(tree, me, show), [tree, me, show]);
  const segs = useMemo(() => linkSegments(layout), [layout]);
  const hearts = useMemo(() => coupleHearts(layout), [layout]);
  const shown = useMemo(() => {
    const m = new Map<string, ReturnType<typeof showFor>>();
    for (const id of layout.pos.keys()) m.set(id, showFor(tree, me, id));
    return m;
  }, [tree, me, layout]);

  const speech = useSpeech();
  const box = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, k: 1 });
  const camRef = useRef(cam);
  camRef.current = cam;

  const centreOn = (id: string, k = camRef.current.k) => {
    const el = box.current, p = layout.pos.get(id);
    if (!el || !p) return;
    setCam({ k, x: el.clientWidth / 2 - (p.x + CARD_W / 2) * k, y: el.clientHeight / 2 - (p.y + CARD_H / 2) * k });
  };

  // Recentre on "me" when who "me" is, or the people shown, change.
  const key = `${me}|${layout.pos.size}`;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const k = Math.min(1, Math.max(0.6, el.clientWidth / 520));
    centreOn(me, k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Pan (one pointer), pinch (two) and wheel zoom.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, dist: 0 });

  const zoomAt = (cx: number, cy: number, factor: number) => {
    const c = camRef.current;
    const k = Math.min(MAX_K, Math.max(MIN_K, c.k * factor));
    const f = k / c.k;
    setCam({ k, x: cx - (cx - c.x) * f, y: cy - (cy - c.y) * f });
  };

  useEffect(() => {
    const el = box.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const down = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = false;
    gesture.current.dist = 0;
  };
  const move = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const ps = pointers.current;
    if (ps.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (!gesture.current.moved && Math.hypot(dx, dy) < 5) return;
      gesture.current.moved = true;
      setCam(c => ({ ...c, x: c.x + dx, y: c.y + dy }));
    } else if (ps.size === 2) {
      gesture.current.moved = true;
      ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...ps.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.dist) {
        const r = box.current!.getBoundingClientRect();
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, dist / gesture.current.dist);
      }
      gesture.current.dist = dist;
      return;
    }
    ps.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const up = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current.dist = 0;
  };

  const pick = (id: string) => { if (!gesture.current.moved) onPick(id); };
  const btnZoom = (f: number) => {
    const el = box.current!;
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, f);
  };

  return (
    <div className="viewport" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>
      <div className="world" style={{ transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`, width: layout.width, height: layout.height }}>
        <svg className="links" width={layout.width} height={layout.height} aria-hidden="true">
          {segs.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeDasharray={s.dashed ? '4 4' : undefined} />
          ))}
        </svg>
        {hearts.map((h, i) => (
          <svg key={i} className="heart" style={{ left: h.x - 6.5, top: h.y - 6 }} viewBox="0 0 24 22" aria-label="married">
            <path d="M12 20 C-4 9 5 -1 12 6 C19 -1 28 9 12 20Z" />
          </svg>
        ))}
        {tree.people.filter(p => layout.pos.has(p.id)).map(p => {
          const pos = layout.pos.get(p.id)!;
          return <PersonCard key={p.id} person={p} shown={shown.get(p.id)!} isMe={p.id === me} gen={layout.gens.get(p.id) ?? 0} x={pos.x} y={pos.y} onPick={pick} speech={speech} />;
        })}
      </div>
      {speech.state !== 'ready' && (
        <p className="nospeech" onPointerDown={e => e.stopPropagation()}>
          {speech.state === 'unsupported' ? 'Audio isn’t available in this browser.' : 'No Cantonese voice found on this device, so audio is off.'}
        </p>
      )}
      <div className="zoom" onPointerDown={e => e.stopPropagation()}>
        <button type="button" aria-label="Zoom in" onClick={() => btnZoom(1.25)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => btnZoom(0.8)}>−</button>
        <button type="button" aria-label="Centre on me" onClick={() => centreOn(me)}>◎</button>
      </div>
    </div>
  );
}
