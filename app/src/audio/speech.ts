// Text-to-speech for titles using the browser's Cantonese voice.
import type { Shown } from '../display.ts';

export interface VoiceLike { lang: string; name: string }

const isCantonese = (v: VoiceLike) => {
  const lang = v.lang.replace('_', '-').toLowerCase();
  return lang === 'zh-hk' || lang.startsWith('yue') || /cantonese|粵|粤|sin-?ji/i.test(v.name);
};

// A zh-HK / yue voice, or undefined when the browser has none.
export function pickVoice<T extends VoiceLike>(voices: readonly T[]): T | undefined {
  return voices.find(v => v.lang.replace('_', '-').toLowerCase() === 'zh-hk') ?? voices.find(isCantonese);
}

// The spoken form of a card: titles you'd say aloud, including the formal term shown for relatives who are
// called by name. Only the bare "by name" placeholder (no jyutping) has nothing to say.
export function spokenText(shown: Shown): string {
  return shown.lines.filter(l => !(l.byName && !l.jyutping) && !l.rank && l.chars).map(l => l.chars).join('，');
}
