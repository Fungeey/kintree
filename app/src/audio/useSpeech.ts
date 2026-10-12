import { useCallback, useEffect, useState } from 'react';
import { pickVoice } from './speech.ts';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

export type SpeechState = 'unsupported' | 'no-voice' | 'ready';

export function useSpeech(): { state: SpeechState; speak: (text: string) => void } {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  const s = synth();

  useEffect(() => {
    if (!s) return;
    const update = () => setVoice(pickVoice(s.getVoices()));
    update();
    s.addEventListener?.('voiceschanged', update);
    return () => s.removeEventListener?.('voiceschanged', update);
  }, [s]);

  const speak = useCallback((text: string) => {
    if (!s || !voice || !text) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    s.speak(u);
  }, [s, voice]);

  return { state: !s ? 'unsupported' : voice ? 'ready' : 'no-voice', speak };
}
