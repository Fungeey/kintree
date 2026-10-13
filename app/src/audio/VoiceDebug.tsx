// ?voices: lists the voices this browser reports and which one each language would use, for when the play button is missing.
import { useEffect, useState } from 'react';
import { pickVoice } from './speech.ts';
import { LANG_IDS, langFor } from '../lang.ts';

export function VoiceDebug() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!supported) return;
    const s = window.speechSynthesis;
    const read = () => setVoices([...s.getVoices()]);
    read();
    s.addEventListener?.('voiceschanged', read);
    const t = setInterval(read, 1000);   // some Chrome builds fill the list late and never say so
    return () => { s.removeEventListener?.('voiceschanged', read); clearInterval(t); };
  }, [supported]);

  return (
    <main className="start" style={{ fontFamily: 'monospace', fontSize: '.8rem' }}>
      <h1 style={{ fontSize: '1.1rem' }}>Voices</h1>
      <p>speechSynthesis: {supported ? 'yes' : 'no'} · {voices.length} voices · {navigator.userAgent}</p>
      {LANG_IDS.map(id => {
        const v = pickVoice(voices, id);
        return <p key={id}><b>{langFor(id).label}</b>: {v ? `${v.name} (${v.lang})` : 'no matching voice'}</p>;
      })}
      <ul>
        {voices.map((v, i) => <li key={i}>{v.lang} · {v.name}{v.localService ? ' · local' : ''}{v.default ? ' · default' : ''}</li>)}
      </ul>
    </main>
  );
}
