import { useState } from 'react';
import type { Person } from '../../engine/src/index.ts';
import type { Shown } from './display.ts';
import { spokenText } from './audio/speech.ts';
import type { SpeechState } from './audio/useSpeech.ts';
import { faceUrl, initials } from './faces.ts';
import { ageFor, HairBack, HairFront } from './Hair.tsx';
import { DEFAULT_LANG, langFor } from './lang.ts';
import type { LangId } from './lang.ts';

interface Props {
  person: Person;
  shown: Shown;
  caption?: string | null;
  isMe: boolean;
  gen: number;
  x: number;
  y: number;
  onPick: (id: string) => void;
  lang?: LangId;
  speech?: { state: SpeechState; speak: (text: string) => void };
}

export function PersonCard({ person, shown, caption, isMe, gen, x, y, onPick, speech, lang = DEFAULT_LANG }: Props) {
  const [broken, setBroken] = useState(false);
  const text = spokenText(shown, lang);
  const html = langFor(lang).html;
  const canPlay = speech?.state === 'ready' && text !== '';
  const two = shown.lines.length > 1;
  const age = ageFor(gen);
  return (
    <div data-id={person.id} className={`node sex-${person.sex}${isMe ? ' me' : ''}`} style={{ left: x, top: y }}>
      <div className="root-label" title={caption ?? undefined}>{caption && <span>{caption}</span>}</div>
      <button
        type="button"
        className="face-btn"
        onClick={() => onPick(person.id)}
        aria-label={`${caption ?? (person.sex === 'm' ? 'man' : 'woman')}: ${shown.lines.map(l => l.chars).join(' / ')}`}
        aria-current={isMe ? 'true' : undefined}
      >
        <HairBack sex={person.sex} age={age} />
        <span className="face">
          {broken
            ? <span className="initials">{initials(person.name, isMe, person.sex)}</span>
            : <img src={faceUrl(person.id)} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />}
        </span>
        <HairFront sex={person.sex} age={age} />
      </button>
      {/* Tapping the name plays it too; the play button stays as the keyboard and screen-reader control. */}
      <div className={`titles${two ? ' two' : ''}${langFor(lang).romanized ? '' : ' plain'}${canPlay ? ' playable' : ''}`} onClick={canPlay ? () => speech.speak(text) : undefined}>
        {shown.lines.map((l, i) => (
          <span key={i} className={`line${l.byName ? ' byname' : ''}${l.rank ? ' rank' : ''}`}>
            {l.label && <i className="age">{l.label}</i>}
            {l.rom && <b className="rom">{l.rom}</b>}
            <span className="zh" lang={l.bare ? undefined : html}>{l.chars}</span>
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
