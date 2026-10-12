import { useState } from 'react';
import type { Person } from '../../engine/src/index.ts';
import type { Shown } from './display.ts';
import { spokenText } from './audio/speech.ts';
import type { SpeechState } from './audio/useSpeech.ts';
import { faceUrl, initials } from './faces.ts';
import { HairBack, HairFront } from './Hair.tsx';

interface Props {
  person: Person;
  shown: Shown;
  isMe: boolean;
  x: number;
  y: number;
  onPick: (id: string) => void;
  speech?: { state: SpeechState; speak: (text: string) => void };
}

export function PersonCard({ person, shown, isMe, x, y, onPick, speech }: Props) {
  const [broken, setBroken] = useState(false);
  const text = spokenText(shown);
  const canPlay = speech?.state === 'ready' && text !== '';
  const two = shown.lines.length > 1;
  return (
    <div className={`node sex-${person.sex}${isMe ? ' me' : ''}`} style={{ left: x, top: y }}>
      <button
        type="button"
        className="face-btn"
        onClick={() => onPick(person.id)}
        aria-label={`${person.name ?? (person.sex === 'm' ? 'man' : 'woman')}: ${shown.lines.map(l => l.chars).join(' / ')}`}
        aria-current={isMe ? 'true' : undefined}
      >
        <HairBack sex={person.sex} />
        <span className="face">
          {broken
            ? <span className="initials">{initials(person.name, isMe, person.sex)}</span>
            : <img src={faceUrl(person.id)} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />}
        </span>
        <HairFront sex={person.sex} />
      </button>
      <div className={`titles${two ? ' two' : ''}`}>
        {shown.lines.map((l, i) => (
          <span key={i} className={`line${l.byName ? ' byname' : ''}`}>
            {l.label && <i className="age">{l.label}</i>}
            <b className="zh">{l.chars}</b>
            {l.jyutping && <small className="jp">{l.jyutping}</small>}
          </span>
        ))}
      </div>
      {canPlay && (
        <button type="button" className="play" onClick={() => speech.speak(text)} aria-label={`Play ${text}`} title="Play">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5c1.6 1.6 1.6 5.4 0 7M18.5 6c3 3 3 9 0 12" fill="none" /></svg>
        </button>
      )}
    </div>
  );
}
