import { useId, useState } from 'react';
import type { Person } from '../../engine/src/index.ts';
import type { Shown } from './display.ts';
import { spokenText } from './audio/speech.ts';
import type { Speech } from './audio/useSpeech.ts';
import { faceUrl, initials } from './faces.ts';
import { ageFor, HairBack, HairFront, toneFor } from './Hair.tsx';
import { DEFAULT_LANG, langFor } from './lang.ts';
import type { LangId } from './lang.ts';

interface Props {
  person: Person;
  shown: Shown;
  caption?: string | null;
  isMe: boolean;
  focused?: boolean;   // their popup is open
  more?: number;
  gen: number;
  x: number;
  y: number;
  onPick: (id: string) => void;
  lang?: LangId;
  speech?: Speech;
  bare?: boolean;   // language "None": no titles; the name goes in the title row, the caption above the face stays empty
}

export function PersonCard({ person, shown, caption, isMe, focused = false, more = 0, gen, x, y, onPick, speech, lang = DEFAULT_LANG, bare = false }: Props) {
  const [broken, setBroken] = useState(false);
  const text = spokenText(shown, lang);
  const html = langFor(lang).html;
  const canPlay = speech?.state === 'ready' && text !== '';
  const play = canPlay ? () => speech.speak(text, person.id) : undefined;
  const talking = speech?.speaking === person.id && !broken;
  const two = shown.lines.length > 1;
  const age = ageFor(gen);
  const tone = toneFor(gen);
  return (
    <div data-id={person.id} className={`node sex-${person.sex}${isMe ? ' me' : ''}${focused ? ' focused' : ''}${more > 0 ? ' more' : ''}${bare ? ' bare' : ''}`} style={{ left: x, top: y }} title={more > 0 ? `${more} more relatives hidden` : undefined}>
      <div className="root-label" title={caption ?? undefined}>{!bare && caption && <span>{caption}</span>}</div>
      <button
        type="button"
        className="face-btn"
        onClick={() => onPick(person.id)}
        aria-label={`${caption ?? (person.sex === 'm' ? 'man' : 'woman')}${bare ? '' : `: ${shown.lines.map(l => l.chars).join(' / ')}`}${more ? `. ${more} more relatives are hidden; switch to them to see` : ''}`}
        aria-current={isMe ? 'true' : undefined}
      >
        <HairBack sex={person.sex} age={age} tone={tone} />
        <span className="face">
          {broken
            ? <span className="initials">{initials(person.name, isMe, person.sex)}</span>
            : <img src={faceUrl(person.id)} alt="" loading="lazy" draggable={false} onError={() => setBroken(true)} />}
          {talking && <TalkingMouth src={faceUrl(person.id)} />}
        </span>
        <HairFront sex={person.sex} age={age} tone={tone} />
      </button>
      {/* With no titles the name takes their place. Tapping a title plays it too; the play button stays as the keyboard and screen-reader control. */}
      {bare ? <div className="titles bare-name" title={caption ?? undefined}>{caption && <span>{caption}</span>}</div> : <div className={`titles${two ? ' two' : ''}${langFor(lang).romanized ? '' : ' plain'}${canPlay ? ' playable' : ''}`} onClick={play}>
        {shown.lines.map((l, i) => (
          <span key={i} className={`line${l.byName ? ' byname' : ''}${l.rank ? ' rank' : ''}`}>
            {l.label && <i className="age">{l.label}</i>}
            {l.rom && <b className="rom">{l.rom}</b>}
            <span className="zh" lang={l.bare ? undefined : html}>
              {l.kana && l.kana !== l.chars ? <ruby>{l.chars}<rt>{l.kana}</rt></ruby> : l.chars}
            </span>
          </span>
        ))}
      </div>}
      {canPlay && (
        <button type="button" className="play" onClick={play} aria-label={`Play ${text}`} title="Play">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 8.5c1.6 1.6 1.6 5.4 0 7M18.5 6c3 3 3 9 0 12" fill="none" /></svg>
        </button>
      )}
    </div>
  );
}

// Drawn over the face's own mouth (DiceBear line-face puts it around 33-73 across and 64-78 down, out of 100, with the
// wide smiles ending in an upward flick) while the card is read aloud. A pill cut from the blank chin of the same face
// image hides that mouth in the face's own skin colour, whatever it is, and four black outlines take turns on it:
// a flat line, a small O, a wide flat opening and a big O.
function TalkingMouth({ src }: { src: string }) {
  const clip = 'talk-clip' + useId().replace(/\W/g, '');
  return (
    <svg className="talk" viewBox="0 0 100 100" aria-hidden="true">
      <clipPath id={clip}><rect x="25" y="62" width="54" height="24" rx="12" /></clipPath>
      {/* The blank chin at x 40-60, y 86-98 of the face image, stretched over the pill. */}
      <g clipPath={`url(#${clip})`}>
        <image href={src} width="100" height="100" transform="matrix(2.7 0 0 2 -83 -110)" />
      </g>
      <path className="talk-f talk-line" d="M38 76h28" />
      <ellipse className="talk-f talk-small" cx="52" cy="76" rx="6.5" ry="5.5" />
      <ellipse className="talk-f talk-big" cx="52" cy="76" rx="15" ry="10.5" />
      <ellipse className="talk-f talk-wide" cx="52" cy="76" rx="19" ry="5" />
    </svg>
  );
}
