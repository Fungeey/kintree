// The languages the titles can be shown in. The family tree is language-neutral; the choice is the viewer's.
import { loadTable, RANK_CMN, RANK_YUE } from '../../engine/src/index.ts';
import type { Generic, RankData, Table, Title, TitleEntry } from '../../engine/src/index.ts';
import yueTitles from '../../engine/data/yue/titles.json' with { type: 'json' };
import yueGeneric from '../../engine/data/yue/generic.json' with { type: 'json' };
import cmnTitles from '../../engine/data/cmn/titles.json' with { type: 'json' };
import cmnGeneric from '../../engine/data/cmn/generic.json' with { type: 'json' };

export type LangId = 'yue' | 'cmn';

export interface Lang {
  id: LangId;
  label: string;          // in its own script, for the picker
  heading: string;        // the app title
  html: string;           // BCP 47 tag for the lang attribute, which picks the right glyph shapes
  table: Table;
  generic: Generic;
  rank: RankData;
  joiner: string;         // links the pieces of a fallback description: 嘅 / 的
  me: Title;
  voice: (v: { lang: string; name: string }) => boolean;
  voicePrefer: string[];  // exact tags tried first, lowercase with '-'
  sep: string;            // joins several spoken titles
}

const tag = (v: { lang: string }) => v.lang.replace('_', '-').toLowerCase();

const LANGS: Record<LangId, Omit<Lang, 'table' | 'generic'> & { titles: unknown; generic: unknown }> = {
  yue: {
    id: 'yue', label: '粵語', heading: '家庭稱呼', html: 'zh-HK',
    titles: yueTitles, generic: yueGeneric, rank: RANK_YUE, joiner: '嘅', me: { chars: '我', rom: 'ngo5' },
    voice: v => tag(v) === 'zh-hk' || tag(v).startsWith('yue') || /cantonese|粵|粤|sin-?ji/i.test(v.name),
    voicePrefer: ['zh-hk'], sep: '，',
  },
  cmn: {
    id: 'cmn', label: '普通话', heading: '家庭称呼', html: 'zh-CN',
    titles: cmnTitles, generic: cmnGeneric, rank: RANK_CMN, joiner: '的', me: { chars: '我', rom: 'wǒ' },
    // Mainland Mandarin: zh-CN, zh-Hans, cmn. Not Hong Kong, Taiwan or Cantonese voices.
    voice: v => {
      const t = tag(v);
      if (t === 'zh-hk' || t === 'zh-tw' || t.startsWith('yue') || t.includes('hant')) return false;
      return t === 'zh-cn' || t === 'zh-sg' || t === 'zh' || t.startsWith('cmn') || t.startsWith('zh-hans');
    },
    voicePrefer: ['zh-cn', 'cmn-cn', 'zh-hans-cn'], sep: '，',
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
