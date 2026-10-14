import { useCallback, useEffect, useRef, useState } from 'react';
import { pickVoice, utteranceLang } from './speech.ts';
import type { LangId } from '../lang.ts';

const synth = (): SpeechSynthesis | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    ? window.speechSynthesis
    : null;

export type SpeechState = 'unsupported' | 'no-voice' | 'ready';

export interface Speech {
  state: SpeechState;
  // `who` names the card being read, so it can show a talking mouth until the speech ends.
  speak: (text: string, who?: string) => void;
  speaking: string | null;
}

export function useSpeech(lang: LangId): Speech {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | undefined>();
  const [speaking, setSpeaking] = useState<string | null>(null);
  const current = useRef<SpeechSynthesisUtterance | null>(null);
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
  // Only the latest utterance may clear the mouth: cancel() fires the previous one's end event after the new one began.
  const speak = useCallback((text: string, who?: string) => {
    if (!s || !text) return;
    const v = pickVoice(s.getVoices(), lang) ?? voice;
    if (!v) return;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = v;
    u.lang = utteranceLang(v);
    current.current = u;
    setSpeaking(who ?? null);
    const done = () => { if (current.current === u) { current.current = null; setSpeaking(null); } };
    u.onend = done;
    u.onerror = done;
    if (s.speaking || s.pending) {
      s.cancel();
      setTimeout(() => s.speak(u), 60);
    } else {
      s.speak(u);
    }
  }, [s, voice, lang]);

  // Some engines never fire end or error (Android Chrome after a voice change), so the mouth also stops once the
  // engine has gone quiet. The first check waits long enough to cover the delayed speak() above.
  useEffect(() => {
    if (!s || speaking === null) return;
    const id = setInterval(() => { if (!s.speaking && !s.pending) { current.current = null; setSpeaking(null); } }, 1000);
    return () => clearInterval(id);
  }, [s, speaking]);

  return { state: !s ? 'unsupported' : voice ? 'ready' : 'no-voice', speak, speaking };
}
