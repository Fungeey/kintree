// Public data types (spec section 1, 4, 5).

export type Sex = 'm' | 'f';

export interface Person { id: string; sex: Sex; name?: string }

// parents: 0-2 ids; children: birth order, eldest first.
export interface Family { id: string; parents: string[]; children: string[] }

// root: the person who created the tree; their name labels everyone's relation on the cards. Optional so older trees still load.
export interface Tree { version: 1; people: Person[]; families: Family[]; root?: string }

// rom: the reading in the language's romanization (jyutping, pinyin, romaji); absent where the script needs none.
// kana: Japanese only. The kana reading of kanji terms, shown as furigana and the text that is spoken aloud, because
// browsers misread kanji (伯父 and 叔父 are both おじ). Omitted where chars is already kana.
export interface Title { chars: string; rom?: string; kana?: string }

export type Spoken = Title | 'by-name';

export interface Forms { formal: Title; spoken: Spoken }

// What changes when the speaker ("me") is a man or a woman. Korean: a man calls his older brother 형, a woman 오빠.
// Only the fields given replace the entry's own; the speaker's sex is the sex of "me" in the tree.
export interface SpeakerForms { formal?: Title; spoken?: Spoken; older?: Forms; younger?: Forms }

export interface TitleEntry {
  pattern: string;
  en: string;
  formal: Title;
  spoken?: Spoken;
  older?: Forms;
  younger?: Forms;
  speaker?: { m?: SpeakerForms; f?: SpeakerForms };
  status: string;
  note?: string;
}

export interface GenericForms {
  above2: { m: Spoken; f: Spoken };
  above1: { m: Spoken; f: Spoken };
  same: { m: { older: Spoken; younger: Spoken }; f: { older: Spoken; younger: Spoken } };
  below: Spoken;
}

// speaker: replacements for a man or woman speaker, as for entries (Korean: the generic older brother is 형 or 오빠).
export interface Generic extends GenericForms { speaker?: { m?: Partial<GenericForms>; f?: Partial<GenericForms> } }

export type Resolution =
  | { kind: 'self' }
  | { kind: 'unrelated' }
  | { kind: 'title'; path: string; pattern: string; en: string; forms: Forms }
  | { kind: 'byAge'; path: string; pattern: string; en: string; older: Forms; younger: Forms }
  | { kind: 'fallback'; path: string; generic: Spoken | { older: Spoken; younger: Spoken }; describe: { text: string; en: string } };
