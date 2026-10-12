import type { Person } from '../../engine/src/index.ts';
import type { Shown } from './display.ts';
import { spokenText } from './audio/speech.ts';
import type { SpeechState } from './audio/useSpeech.ts';
import { CARD_W } from './layout.ts';

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
  const text = spokenText(shown);
  const canPlay = speech?.state === 'ready' && text !== '';
  const two = shown.lines.length > 1;
  return (
    <>
    <button
      type="button"
      className={`card sex-${person.sex}${isMe ? ' me' : ''}`}
      style={{ left: x, top: y }}
      onClick={() => onPick(person.id)}
      aria-label={`${person.name ?? (person.sex === 'm' ? 'man' : 'woman')}: ${shown.lines.map(l => l.chars).join(' / ')}`}
      aria-current={isMe ? 'true' : undefined}
    >
      <span className="who">{person.name || (isMe ? 'Me' : person.sex === 'm' ? '♂' : '♀')}</span>
      <span className={`titles${two ? ' two' : ''}`}>
        {shown.lines.map((l, i) => (
          <span key={i} className={`line${l.byName ? ' byname' : ''}`}>
            {l.label && <i className="age">{l.label}</i>}
            <b className="zh">{l.chars}</b>
            {l.jyutping && <small className="jp">{l.jyutping}</small>}
          </span>
        ))}
      </span>
      {shown.formal && <span className="formal">{shown.formal.chars} <small>{shown.formal.jyutping}</small></span>}
      {shown.describe && <span className="formal">{shown.describe}</span>}
      {shown.gloss && <span className="gloss">{shown.gloss}</span>}
    </button>
    {canPlay && (
      <button type="button" className="play" style={{ left: x + CARD_W - 28, top: y + 3 }}
        onClick={() => speech.speak(text)} aria-label={`Play ${text}`} title="Play">🔊</button>
    )}
    </>
  );
}
