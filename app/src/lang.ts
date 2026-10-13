// The languages the titles can be shown in. The family tree is language-neutral; the choice is the viewer's.
import { loadTable, RANK_CMN, RANK_YUE } from '../../engine/src/index.ts';
import type { Generic, RankData, Table, Title, TitleEntry } from '../../engine/src/index.ts';
import yueTitles from '../../engine/data/yue/titles.json' with { type: 'json' };
import yueGeneric from '../../engine/data/yue/generic.json' with { type: 'json' };
import cmnTitles from '../../engine/data/cmn/titles.json' with { type: 'json' };
import cmnGeneric from '../../engine/data/cmn/generic.json' with { type: 'json' };
import vieTitles from '../../engine/data/vie/titles.json' with { type: 'json' };
import vieGeneric from '../../engine/data/vie/generic.json' with { type: 'json' };

export type LangId = 'yue' | 'cmn' | 'vie';

export interface Lang {
  id: LangId;
  label: string;          // in its own script, for the picker
  heading: string;        // the app title
  html: string;           // BCP 47 tag for the lang attribute, which picks the right glyph shapes
  table: Table;
  generic: Generic;
  rank: RankData | null;  // null where the language has no rank titles
  joiner: string;         // links the pieces of a fallback description: 嘅 / 的 / " của "
  reverse: boolean;       // description puts the nearest relative last
  romanized: boolean;     // titles come with a reading (jyutping, pinyin); false for Vietnamese, which is already Latin script
  me: Title;
  voice: (v: { lang: string; name: string }) => boolean;
  voicePrefer: string[];  // normalised tags (see tag) tried first, exactly
  sep: string;            // joins several spoken titles
}

// Browsers write tags differently: Chrome on Android gives "zh_CN_#Hans" and "yue_HK_#Hant", desktop gives "zh-CN".
// Normalised to lowercase with '-' between parts, so those read "zh-cn-hans" and "yue-hk-hant".
export const tag = (v: { lang: string }) => v.lang.toLowerCase().split(/[_#-]+/).filter(Boolean).join('-');

// Mainland Mandarin: Chinese or Mandarin, simplified or unmarked script, and a region of mainland China, Singapore or Malaysia
// (or none). Hong Kong, Macao and Taiwan voices, traditional-script voices and Cantonese are not.
function isMainlandMandarin(v: { lang: string }): boolean {
  const parts = tag(v).split('-');
  if (parts[0] !== 'zh' && parts[0] !== 'cmn') return false;
  const region = parts.find((p, i) => i > 0 && p.length === 2);
  return !parts.includes('hant') && (region === undefined || ['cn', 'sg', 'my'].includes(region));
}

const LANGS: Record<LangId, Omit<Lang, 'table' | 'generic'> & { titles: unknown; generic: unknown }> = {
  yue: {
    id: 'yue', label: '粵語', heading: '家庭稱呼', html: 'zh-HK',
    titles: yueTitles, generic: yueGeneric, rank: RANK_YUE, joiner: '嘅', reverse: false, romanized: true, me: { chars: '我', rom: 'ngo5' },
    voice: v => tag(v) === 'zh-hk' || tag(v).startsWith('yue') || /cantonese|粵|粤|sin-?ji/i.test(v.name),
    voicePrefer: ['zh-hk'], sep: '，',
  },
  cmn: {
    id: 'cmn', label: '普通话', heading: '家庭称呼', html: 'zh-CN',
    titles: cmnTitles, generic: cmnGeneric, rank: RANK_CMN, joiner: '的', reverse: false, romanized: true, me: { chars: '我', rom: 'wǒ' },
    voice: isMainlandMandarin,
    voicePrefer: ['zh-cn', 'zh-cn-hans', 'cmn-cn', 'cmn-hans-cn'], sep: '，',
  },
  vie: {
    id: 'vie', label: 'Tiếng Việt', heading: 'Xưng hô gia đình', html: 'vi-VN',
    titles: vieTitles, generic: vieGeneric, rank: null, joiner: ' của ', reverse: true, romanized: false, me: { chars: 'tôi' },
    voice: v => tag(v).split('-')[0] === 'vi',
    voicePrefer: ['vi-vn'], sep: ', ',
  },
};

export const LANG_IDS = Object.keys(LANGS) as LangId[];
export const DEFAULT_LANG: LangId = 'yue';
export const isLangId = (x: unknown): x is LangId => typeof x === 'string' && x in LANGS;

const built = new Map<LangId, Lang>();
export function langFor(id: LangId): Lang {
  let l = built.get(id);
  if (!l) {
    const { titles, generic, ...rest } = LANGS[id];
    l = { ...rest, table: loadTable(titles as unknown as TitleEntry[]), generic: generic as unknown as Generic };
    built.set(id, l);
  }
  return l;
}

const KEY = 'kinship:lang';

/** The language to open in: ?lang= on the link, else the saved choice, else Cantonese. */
export function initialLang(search: string, store: { getItem(k: string): string | null } | null): LangId {
  const q = new URLSearchParams(search).get('lang');
  if (isLangId(q)) return q;
  try {
    const saved = store?.getItem(KEY);
    if (isLangId(saved)) return saved;
  } catch { /* blocked storage */ }
  return DEFAULT_LANG;
}

export function saveLang(store: { setItem(k: string, v: string): void } | null, id: LangId): void {
  try { store?.setItem(KEY, id); } catch { /* blocked storage */ }
}
