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

// The tag to put on the utterance. Android Chrome reports plain voices as "fil_PH" and picks the speaking voice from the
// utterance's lang, which it may not accept with an underscore (a Filipino card was read by the wrong voice), so those
// become "fil-PH". Tags with a script, like "yue_HK_#Hant" and "zh_CN_#Hans", are left as the browser wrote them.
export function utteranceLang(voice: VoiceLike): string {
  return /^[a-z]{2,3}_[A-Z]{2}$/.test(voice.lang) ? voice.lang.replace('_', '-') : voice.lang;
}

// The spoken form of a card: titles you'd say aloud, including the formal term shown for relatives who are
// called by name. Only the bare "by name" placeholder has nothing to say.
export function spokenText(shown: Shown, lang: LangId = DEFAULT_LANG): string {
  // Japanese speaks the kana reading, since kanji can be misread.
  return shown.lines.filter(l => !l.bare && l.chars).map(l => l.kana ?? l.chars).join(langFor(lang).sep);
}
