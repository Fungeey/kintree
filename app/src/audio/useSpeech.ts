import { useCallback, useEffect, useState } from 'react';
import { pickVoice, utteranceLang } from './speech.ts';
import type { LangId } from '../lang.ts';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

export type SpeechState = 'unsupported' | 'no-voice' | 'ready';

export function useSpeech(lang: LangId): { state: SpeechState; speak: (text: string) => void } {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  const s = synth();

  useEffect(() => {
    if (!s) return;
    const update = () => setVoice(pickVoice(s.getVoices(), lang));
    update();
    s.addEventListener?.('voiceschanged', update);
    return () => s.removeEventListener?.('voiceschanged', update);
  }, [s, lang]);

  // The voice is looked up again at play time, so a language switch can never speak with the previous language's voice.
  // Android Chrome picks by the utterance's lang and can ignore .voice, so both are set, and speak() waits a tick after
  // cancel() because a speak() issued straight after it can be dropped or run with the engine's last voice.
  const speak = useCallback((text: string) => {
    if (!s || !text) return;
    const v = pickVoice(s.getVoices(), lang) ?? voice;
    if (!v) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = utteranceLang(v);
    if (s.speaking || s.pending) {
      s.cancel();
      setTimeout(() => s.speak(u), 60);
    } else {
      s.speak(u);
    }
  }, [s, voice, lang]);

  return { state: !s ? 'unsupported' : voice ? 'ready' : 'no-voice', speak };
}
