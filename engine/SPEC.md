# Kinship engine: matching-rule spec (spike)

Scope: the engine only. Given a family tree, a "me" and a target person, work out the path between them, match it to a title, or produce a fallback. No UI, no URL encoding, no side filter (those come later). TypeScript, run directly by Node 22 (type stripping), tested with `node:test`.

Decisions this follows are in `../REVIEW.md` ("Decisions from discussion with aaron"), in particular 3 (common-ancestor method), 4 (readable path patterns), 5 (family groups), 6 (spoken and formal forms), 9 (cousins show both), 13 (no half-siblings or step-parents), 19 (unknown parents).

## 1. Data model

```ts
type Sex = 'm' | 'f';
interface Person { id: string; sex: Sex; name?: string }
interface Family { id: string; parents: string[]; children: string[] } // parents: 0-2 ids; children: birth order, eldest first
interface Tree { version: 1; people: Person[]; families: Family[] }
```

- A **family group** is a couple (or one or zero known parents) plus their children in birth order.
- A marriage is a family with two parents. It may have no children.
- **Unknown parents:** a family may have 0 or 1 parents. Siblings are linked through the family, not through the parent people, so an aunt can be added with no grandparents in the tree.
- MVP limits (decision 13): each person is a child in at most one family and a parent in at most one family.

`validateTree(tree)` throws an `Error` when:
- an id is unknown or duplicated;
- a family has more than 2 parents;
- a person is a child in two families or a parent in two families;
- a person is both parent and child in the same family;
- a family id is duplicated, a person is listed twice in one family, or a sex isn't `m` or `f`.

## 2. Moves and tokens

From a person X there are four kinds of move. Each move emits one token:

| Move | Token |
|---|---|
| X → a parent in X's birth family | `F` (male) / `M` (female) |
| X → another child of X's birth family | `B` (male) / `Z` (female), plus age `e` (elder) if earlier in `children` than X, else `y` |
| X → a child in X's own family | `S` (male) / `D` (female) |
| X → the other parent in X's own family | `H` (male) / `W` (female) |

A **path** is the space-separated token string from me to the target, e.g. `F Be S` (father's elder brother's son). Self is the empty string `''`. This is standard kin-type notation with an age suffix on siblings. The age is always relative to the person before the sibling token: in `F Be`, the brother is elder than the father.

There is no token for "parent's child". Moving to a sibling is one token, so a shortest path never goes up and straight back down.

## 3. Choosing the path: `kinPath(tree, me, target): string | null`

Among all paths from me to the target, pick the minimum by these criteria, in order:
1. Fewest tokens.
2. Fewest marriage tokens (`H`, `W`).
3. Lexicographic order of the token letters, using F < M < B < Z < S < D < H < W. Ages are ignored for this comparison.
4. If the letters are equal too, compare ages position by position, with `e` before `y`. This keeps the result deterministic. It probably can't happen in an MVP tree, and no fixture pair hits it.

`kinPath` throws on an unknown person id.

Return `null` if the target can't be reached (unrelated). Return `''` if `me === target`.

Rule 3 makes ties deterministic and prefers blood-first paths. Example: if my younger brother married my wife's younger sister, she is `By W` (弟婦), not `W Zy` (姨仔).

## 4. Title table

Stored in `data/titles.json` as an array of entries:

```ts
interface Title { chars: string; jyutping: string }
type Spoken = Title | 'by-name';
interface Forms { formal: Title; spoken: Spoken }
interface TitleEntry {
  pattern: string;            // e.g. "F Be", "M Z*", "F B* S"
  en: string;                 // English gloss, also used in fallback descriptions
  formal: Title;              // reference term; for byAge entries a neutral term (表兄弟)
  spoken?: Spoken;            // what you say to them; required unless older/younger are given
  older?: Forms;              // byAge entries: target older than me
  younger?: Forms;            //                target younger than me
  status: string;             // 'unverified' for everything until the native-speaker check
  note?: string;
}
```

**Pattern grammar.** A pattern is space-separated tokens, as in section 2. A `B` or `Z` token takes an age of `e`, `y` or `*` (either); other letters take no age.

**Matching.** A pattern matches a path when:
- both have the same number of tokens;
- the letters are equal at each position;
- each age is equal, or the pattern's age is `*`.

**Specificity** is the number of non-`*` ages. When several patterns match, the most specific one wins.

`loadTable(entries)` validates the table and returns a `Table`. It throws on:
- a malformed pattern;
- a duplicate pattern;
- an entry with neither `spoken` nor both `older` and `younger`;
- two patterns with equal specificity that can both match some path. Example: `F Be Z*` and `F B* Ze` both match `F Be Ze`.
- an entry that gives only one of `older` / `younger`;
- a missing base pattern. Some pattern must match every single-token path, `F M S D H W Be By Ze Zy`, so a description can always be built. A wildcard such as `B*` counts.

`matchPattern(table, path): TitleEntry | null`.

## 5. Resolving: `resolve(tree, table, generic, me, target): Resolution`

```ts
type Resolution =
  | { kind: 'self' }
  | { kind: 'unrelated' }
  | { kind: 'title'; path: string; pattern: string; en: string; forms: Forms }
  | { kind: 'byAge'; path: string; pattern: string; en: string; older: Forms; younger: Forms }
  | { kind: 'fallback'; path: string; generic: Spoken | { older: Spoken; younger: Spoken }; describe: { yue: string; en: string } };
```

- `self` when `me === target`; `unrelated` when `kinPath` returns `null`.
- If the path matches an entry that has `older` and `younger`, the result is `byAge`. The app always shows both (decision 9).
- If it matches an entry with `spoken`, the result is `title`, with `forms = { formal, spoken }`.
- Otherwise the result is `fallback`.

## 6. Fallback

**Generic spoken title.** Generation `g` = (count of `F`/`M`) − (count of `S`/`D`) in the path. Look it up in `data/generic.json`:

```ts
interface Generic {
  above2: { m: Spoken; f: Spoken };            // g >= 2
  above1: { m: Spoken; f: Spoken };            // g == 1
  same:   { m: { older: Spoken; younger: Spoken }; f: { older: Spoken; younger: Spoken } }; // g == 0
  below:  Spoken;                              // g <= -1
}
```

The target's sex picks `m` or `f`.

**Description.** Split the path into consecutive segments so that each segment matches a table pattern. Each segment is read from the view of the person where it starts.
- Choose the split with the fewest segments.
- On a tie, compare segment lengths from left to right and prefer the shorter one first. This puts the closest relative first ("mother's cousin" rather than "grandfather's son").
- A split always exists, because every single token is in the table.

Render each segment with its entry's `formal.chars` (for `yue`) and its `en`:
- `yue` joins the segments with `嘅`, e.g. `爸爸嘅堂兄弟`.
- `en` joins them with `'s `, e.g. `father's paternal cousin`.

## 7. Public API (`src/index.ts`)

```ts
export type { Sex, Person, Family, Tree, Title, Spoken, Forms, TitleEntry, Table, Generic, Resolution };
export function validateTree(tree: Tree): void;
export function kinPath(tree: Tree, me: string, target: string): string | null;
export function loadTable(entries: TitleEntry[]): Table;
export function matchPattern(table: Table, path: string): TitleEntry | null;
export function resolve(tree: Tree, table: Table, generic: Generic, me: string, target: string): Resolution;
```

`Table` is opaque to callers. `npm test` and `npm run typecheck` must both pass.

## 8. Not in this spike

- The side filter (decision 16).
- URL and localStorage storage.
- Family rank titles (大姨, 二姨): now in `src/rank.ts`.
- Half-siblings and step-parents.
- The UI.

The table data is a starter set for testing the engine. Every entry is `unverified` until the words.hk and native-speaker check (decision 14).
