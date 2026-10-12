// Public data types (spec section 1, 4, 5).

export type Sex = 'm' | 'f';

export interface Person { id: string; sex: Sex; name?: string }

// parents: 0-2 ids; children: birth order, eldest first.
export interface Family { id: string; parents: string[]; children: string[] }

export interface Tree { version: 1; people: Person[]; families: Family[] }

export interface Title { chars: string; jyutping: string }

export type Spoken = Title | 'by-name';

export interface Forms { formal: Title; spoken: Spoken }

export interface TitleEntry {
  pattern: string;
  en: string;
  formal: Title;
  spoken?: Spoken;
  older?: Forms;
  younger?: Forms;
  status: string;
  note?: string;
}

export interface Generic {
  above2: { m: Spoken; f: Spoken };
  above1: { m: Spoken; f: Spoken };
  same: { m: { older: Spoken; younger: Spoken }; f: { older: Spoken; younger: Spoken } };
  below: Spoken;
}

export type Resolution =
  | { kind: 'self' }
  | { kind: 'unrelated' }
  | { kind: 'title'; path: string; pattern: string; en: string; forms: Forms }
  | { kind: 'byAge'; path: string; pattern: string; en: string; older: Forms; younger: Forms }
  | { kind: 'fallback'; path: string; generic: Spoken | { older: Spoken; younger: Spoken }; describe: { yue: string; en: string } };
