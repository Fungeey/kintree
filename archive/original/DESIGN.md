# Cantonese Kinship Title App: Design and Status

## 1. Goal

A frontend-only web app that shows the Cantonese title a person should use for each relative, from the viewpoint of a chosen "me". Titles are played as audio. The family is stored as a graph in the URL, so a link opens the same tree and point of view on any device. No backend.

## 2. User-facing behaviour

Two modes:

**Blank mode (no tree yet)**
- The user picks options from dropdowns to build a chain from "me" to one relative, e.g. Mother → Elder brother → Wife.
- The app shows the title for that chain, with Jyutping and an audio play button.

**Tree mode**
- After the first relative, the user keeps adding people relative to "me". Each person is stored as a node in a graph.
- The user can switch "me" to any person in the tree. Titles are recomputed from that person's point of view.
- "Copy link" produces a URL that reopens the tree and the current point of view.
- Each relative shows its title and an audio button.

Out of scope for now: a backend, accounts, saving to a server, sharing controls.

## 3. Data model

### 3.1 People

```
person = { id, name, sex: 'm'|'f', birthOrder: int, parents?: [id, id], spouses?: [id] }
```

- `birthOrder` is an integer among the person's full siblings, 1 = eldest. It is not a birth year.
- Seniority is only meaningful inside one sibling group. Comparing a parent with the parent's siblings needs the parent's birthOrder within that sibling group too. This is an open question (see section 9).

### 3.2 Relations (graph edges)

- Parent → child (`parents` on the child).
- Spouse (`spouses` on both).
- Sibling links are derived from shared parents. They are not stored.

Half-siblings, adoption and step-parents are not modelled yet.

### 3.3 Graph storage in URL

- The graph is serialised to compact JSON, then base64url-encoded, into one query parameter.
- The viewpoint is a second parameter with the id of "me".
- Exact encoding is not finalised (see section 9).

## 4. Relationship engine

### 4.1 Path search

For a viewpoint V and target T:
1. Breadth-first search over the graph from V to T, using parent, child and spouse edges.
2. Prefer blood paths over marriage paths when both exist. Among equal-length blood paths, pick a fixed deterministic order (e.g. by person id) so the same view always gives the same title.
3. Convert the path into hop codes (section 5). Sibling hops get an age letter or rank from birthOrder.

### 4.2 Hop codes (chain encoding)

One letter per hop. Sibling and cousin hops also take an age letter: `o` older, `y` younger. The speaker's siblings use age relative to the speaker; a parent's siblings use age relative to the parent.

| Code | Hop | Code | Hop |
|---|---|---|---|
| F | father | B | brother (needs o/y) |
| M | mother | Z | sister (needs o/y) |
| S | son | H | husband |
| D | daughter | W | wife |
| A | maternal male cousin (o/y) | E | maternal female cousin (o/y) |
| P | paternal male cousin (o/y) | Q | paternal female cousin (o/y) |

Example: `MBoW` = mother → mother's elder brother → his wife.

### 4.3 Compact key

Seven characters, used to index the term table:

```
[gen+4][side][sex][lineal][sen][aff][anc]
```

- `gen+4`: 0–9, so gen −4 to +5.
- `side`: S (speaker), B/Z (speaker's brother/sister), P/M (paternal/maternal line).
- `sex`: m/f or `-`.
- `lineal`: 1 = direct line, 0 = collateral.
- `sen`: o/y or `-` (dropped when the term doesn't depend on it).
- `aff`: 1 = by marriage, 0 otherwise.
- `anc`: sex of the anchor for grandparents' siblings (m/f), else `-`.

Keys are canonicalised with a collapse list: if a wildcard form (sen replaced by `*`) is listed, the sen character is set to `-`.

Planned: an eighth character for rank (1, 2, 3, L) for family-specific terms. Not implemented.

### 4.4 Term lookup

`terms.json` maps canonical keys to `{ chars, jyutping, status, source, note }`. Status values: `supported`, `variant`, `conflict`, `unsourced`. Missing keys fall back to a generated description.

## 5. What is built (files in /home/claude/kinship/)

| File | Purpose | State |
|---|---|---|
| `kinship.js` | Hop definitions, `step()` (state transition), long-form `key()` | Working. Includes `anc`. |
| `codec.js` | Chain encode/decode, compact key, parse, canonical, collapse, `resolveChain`, `resolveParam`, `longToCompact` | Working. Tested on sample chains. |
| `walk.js` | Explicit list of real chains, expands sen values, writes `keys.csv` | Working. 72 keys, 64 canonical. |
| `keys.csv` | Walker output with empty term columns for review | Generated. |
| `terms.json` | 56 terms with status and sources; collapse list; source URLs | Working. Migrated to compact keys. 8 fallbacks remain. |
| `check.js` | Old coverage check on long keys | Superseded by codec-based check. Needs updating. |

Coverage: 56 of 64 canonical keys have a term. The 8 uncovered keys are grandparents' brothers (both lines, both sexes).

Term status: 36 supported, 10 variant, 6 conflict (source used), 4 unsourced (younger cousins' spouses and paternal cousins' husbands).

Sources used: [Omniglot Cantonese kinship page](https://omniglot.com/language/kinship/cantonese.htm); [Jyut Dictionary 姑婆](https://jyutdictionary.com/dictionary/entry/%E5%A7%91%E5%A9%86), [姨婆](https://jyutdictionary.com/dictionary/entry/%E5%A7%A8%E5%A9%86), [表嫂](https://jyutdictionary.com/dictionary/entry/%E8%A1%A8%E5%AB%82), [堂嫂](https://jyutdictionary.com/dictionary/entry/%E5%A0%82%E5%AB%82), [表姐夫](https://jyutdictionary.com/dictionary/entry/%E8%A1%A8%E5%A7%90%E5%A4%AB).

## 6. Known gaps in the terms

- Birth-order terms used in some families (二姨, 大姨 for mother's eldest sister) are not in the sources. They need the rank slot and a separate family table.
- The sourced terms are not checked for regional variation, and only one kinship reference was used.
- Tones for 媽媽 need a native speaker.
- Several spouse terms are unsourced (表弟妹, 堂弟妹, 堂姐夫, 堂妹夫).

## 7. Audio

Each title has a play button. Source of audio not decided. Options: text-to-speech with a Cantonese voice (Web Speech API, depends on browser voices), or recorded clips per term. Recorded clips are more accurate for Jyutping tones.

## 8. Implementation plan (not built)

1. Graph model + serialisation to URL.
2. Path search from viewpoint to target, producing hop codes.
3. Port `resolveChain` to work from a graph path.
4. Blank mode UI: dropdowns → chain → title.
5. Tree mode UI: add person relative to "me", list of people with titles.
6. Switch "me".
7. Copy link.
8. Audio playback.
9. Rank slot and family term table.

## 9. Review disposition (adversarial Opus review, 17 findings)

| # | Finding | Status | Notes |
|---|---|---|---|
| 1 | Spouse's relatives treated as speaker's own | **Fixed (partly)** | Speaker's spouse sets side H/W; `aff` persists; 12 in-law terms added from Omniglot. Residual: a sibling-in-law's spouse collides (`WBoW` = 大姨 = `WZo`). Open. |
| 2 | Path search can't produce sibling/cousin hops | Deferred | Needs the graph engine. Spec: normalise path → hops (parent→child pairs become siblings; uncle→child becomes cousin). |
| 3 | birthOrder can't rank cousins | Deferred | Design decision needed: add `born`, or ask older/younger and store as an override. |
| 4 | 堂 vs 表 decided by dropdown, not path | Deferred | Needs side rename (T/U) and normalisation. |
| 5 | Cousin beyond speaker overwrites side | Deferred | Needs a collateral-degree field in the key (8th character). Currently `MPo` gives the paternal-cousin term, which is wrong. |
| 6 | `MH` gives 姨丈 | Deferred | Belongs in normalisation: `MH` is not a valid path. |
| 7 | `SS`/`DS` collide; `PoS`/`QoS` collide | Deferred | Needs a descent-side field. |
| 8 | Generation out of range breaks key | **Fixed** | `compactKey` throws `RangeError`. `parseKey` regex validation not added. |
| 9 | One bad chain kills the parameter | **Fixed** | `resolveParam` returns an error entry per bad chain. |
| 10 | Tree mode needs grandparents for aunts/uncles | Deferred | Graph engine: placeholder parent nodes. |
| 11 | "Prefer blood" and id tie-break | Deferred | Graph engine: use the fixed preference order from the review. |
| 12 | Address forms vs terms of reference | Deferred | Add `form` field to terms, UI rule for juniors. |
| 13 | Walker missing common relations | Partly | Spouse-family chains added. A grammar-based generator is still needed. |
| 14 | Term consistency and notes | Partly | In-law terms added. Still open: 表弟婦 consistency, garbled 表阿 note, neoi2 variant, 舅姆/舅母 variants array. |
| 15 | Collapse rules may merge distinct terms | Deferred | Add startup check once findings 5 and 7 are fixed. |
| 16 | Small code errors | Partly | `encodeChain` and `resolveChain('')` fixed; header example fixed. Rank comments and `check.js` still to do. |
| 17 | URL size and privacy | Deferred | Fragment storage, `CompressionStream`, optional names: app build step. |

## 10. MVP decisions (supersede earlier sections where they conflict)

1. **No birth years anywhere.** Users don't know them. Age is captured only as older/younger/rank.
2. **People are added only through a direct link** to someone already in the tree: parent, child, spouse, or sibling. No general path search in the MVP.
3. **Ask once per sibling group, not per chain.**
   - Adding a sibling: ask "older or younger than you?"
   - Adding a parent's sibling: ask for rank among that parent's siblings (eldest, second, third, …, youngest). Rank counts from the eldest across the whole sibling group.
   - One answer orders the group, so the question is never repeated for another chain through it.
4. **Across sibling groups (cousins, and anyone whose age is not ordered with you), do not ask.** Show both variants with the condition, e.g. "older: 表哥, younger: 表弟", or the fallback blurb for complex cases.
5. **Rank terms** (大姨, 二姨, …) are the family-usage terms. They use the rank slot, which is added to the key as an eighth character. Family terms are kept in a separate table tagged by family, so they never override sourced terms.
6. **Normalisation is a small fixed rule set** applied to the link-based path (up then down through a parent → sibling; up, sideways, then down → cousin). Anything else falls back to a description.
7. **Conditional display** is the default when no age answer is stored. It collapses to one title once the answer is stored.

8. **One family of origin per graph.** The spouse is a node in both spouses' graphs. Switching "me" from husband to wife switches which family is shown. A spouse's own parents and siblings appear only in the graph where that spouse is "me". This removes the in-law collisions (e.g. `WBoW`) because one graph never mixes two families.
9. **Path normalisation: six rules, applied in order.** Moves are UP (parent), DOWN (child), SIDE (spouse).
   1. Single move → direct relation (parent, child, spouse).
   2. UP, then DOWN to someone other than you → sibling. Age from your sibling group.
   3. UP, UP, then DOWN to someone other than your parent → parent's sibling. Rank from your parent's sibling group.
   4. UP, DOWN (not you), DOWN → cousin. Side from the parent you went up through. Cross-group, so show both variants.
   5. DOWN, then SIDE (or DOWN, then UP to the child's other parent) → child's spouse (in-law title).
   6. Anything else → fallback description.
   Known edge case: a cousin reached through a step-parent matches rule 4 but should fall back. Each rule needs unit tests before use.

Answers to earlier open questions: Q1 (birth order across generations) and Q3 (edge types) are resolved by decisions 1 and 2. Q2 (path choice) is resolved by decision 6, with the direct-link rule.

## 11. Handoff

**Built and working:** `kinship.js` (steps, including spouse side H/W and persistent marriage flag), `codec.js` (chain and key encode/decode, canonical collapse, error handling), `walk.js` (84 keys, 76 canonical), `terms.json` (68 terms, 0 orphans, 8 fallbacks), `keys.csv`.

**Not built:** the graph and link model, the rank slot and family table, path normalisation, the UI (blank mode and tree mode), the URL format for the graph, audio.

**Next steps, in order:**
1. Add the rank slot to the key and codec. Migrate existing keys.
2. Implement the link model: people with sex and sibling-group membership, direct links, and stored older/younger/rank answers.
3. Implement the six normalisation rules, with tests.
4. Build blank mode, then tree mode, then switch-me, copy-link, and audio.

**Known issues to fix first:** `WBoW` (wife's elder brother's wife) collides with the wife's elder sister. Cousins beyond the speaker give the wrong side. `SS` and `DS` collide.

**Open questions:**
- The sibling-in-law collision: should the blurb cover it, or does the key need a finer split?
- The audio source: text-to-speech or recorded clips?
- The address-form field for juniors: needed in the MVP or later?

## 12. Open questions for review (superseded; see section 11)

1. **Birth order across generations.** A parent's birth order is needed to decide whether a parent's sibling is older or younger than the parent. Does the model store birthOrder for every person, and is the comparison always inside one sibling group?
2. **Path choice.** Blood-first BFS with a fixed tie-break. Is that enough to guarantee the same view always gives the same title? What happens when a spouse's sibling is also a blood relative through another path?
3. **Half-siblings, adoption, step-parents, multiple marriages.** Not modelled. What minimum set of edge types is needed?
4. **URL size.** How large can a graph get in one URL before it breaks? Is base64url of compact JSON enough?
5. **Privacy.** The URL contains every name in the tree. Should names be optional, or stored as ids only?
6. **Terms.** Is the 7-character key with a rank slot the right design, or should family tables be keyed separately?
7. **Audio.** Web Speech API or recorded clips?
8. **Walker.** `walk.js` enumerates chains from a fixed list. Should it be replaced by a generator that works from the graph?
9. **Viewpoint switch.** Does recomputing every relationship on each switch scale to a family of, say, 50 people?
10. **Scope.** Is the chain-based grammar in `walk.js` complete for the relations people actually need (cousins' children, spouses' siblings, in-laws' parents)?
