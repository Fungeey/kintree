// Text-to-speech for titles using the browser's voice for the chosen language.
import type { Shown } from '../display.ts';
import { DEFAULT_LANG, langFor, tag as tagOf } from '../lang.ts';
import type { LangId } from '../lang.ts';

export interface VoiceLike { lang: string; name: string }

// The voice for a language (Cantonese: zh-HK or yue; Mandarin: zh-CN, zh-Hans or cmn), preferring its exact tags,
// or undefined when the browser has none.
export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: LangId = DEFAULT_LANG): T | undefined {
  const L = langFor(lang);
  for (const want of L.voicePrefer) {
    const hit = voices.find(v => tagOf(v) === want);
    if (hit) return hit;
  }
  return voices.find(L.voice);
}

// The spoken form of a card: titles you'd say aloud, including the formal term shown for relatives who are
// called by name. Only the bare "by name" placeholder has nothing to say.
export function spokenText(shown: Shown, lang: LangId = DEFAULT_LANG): string {
  return shown.lines.filter(l => !l.bare && !l.rank && l.chars).map(l => l.chars).join(langFor(lang).sep);
}
