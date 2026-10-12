# Design review: Cantonese kinship title app

Review of `DESIGN.md` as uploaded (`kinship/original/DESIGN.md`), 2026-10-12. Findings are ranked by how much they change the plan. Each one says whether it was checked against a source, read from the code, or is my own judgement.

## Summary

The goal and the MVP decisions (no birth years, add people by direct link, ask age once per sibling group, show both cousin variants) are sound. Four problems should be fixed before more code is written:

1. **Decision 8 (one family of origin per graph) breaks the main use case.** A child needs both grandfathers, 爺爺 and 外公, in one view.
2. **The path rules in decision 9 mislabel common relatives.** A nephew is reported as a cousin, grandparents fall back to a description, and the child's other parent is treated as the child's spouse.
3. **堂 vs 表 is wrong for the father's sister's children.** They are 表, but the design gives them 堂.
4. **The term table gives the wrong register and the wrong tones.** Most entries are terms of reference (伯父, 太太) rather than what you call someone, and the Jyutping uses dictionary tones without the spoken tone changes. That matters most for audio.

There is also a structural point. The compact key is a lossy summary of the path, and each collision fixed so far has needed one more field. A table keyed by the normalised path itself would avoid collisions by construction (see A1).

## A. Structure

**A1. Key the term table by normalised path patterns, not a derived 7- or 8-character key.** (Judgement.)
Chinese kinship terms are indexed by the path: which parent you went up through, the sex of each link, relative age at the branch point, and marriages at either end. The compact key compresses this through a state machine (`step()`) and loses information, so `WBoW`, `MPo` and `SS` collided. Every fix so far has added a field (anc, aff count, coll, descent side, rank), and `PoS`/`QoS` still collides. A table keyed by readable patterns such as `F B(o)` → 伯父, `M Z(y)` → 阿姨, `F Z * (o)` → 表哥 has these advantages:
- It cannot collide, because distinct paths are distinct keys.
- A native speaker can review it without decoding positional characters.
- The collapse list becomes `*` wildcards in the pattern.
- Rank is just a richer age annotation, such as `M Z(#1)` → 大姨 in a family table.

Honest note: the rank-slot and collision fixes I made in this thread extend the current key. If you adopt A1, most of that code gets replaced, though the tests and the term data carry over.

**A2. Model sibling groups explicitly as family units.** (Judgement; this is the standard genealogy model, the FAM record in GEDCOM.)
A unit holds up to two parents, which may be placeholders, and an ordered list of children. This gives you:
- Birth order and rank as positions in the list, so one answer orders the group (decision 3).
- Siblings without having to enter their parents (finding 10).
- Half-siblings, as children who share one unit parent but not the unit.
- Step-parents, as a spouse of a parent who is not a parent in your unit.

Right now section 3.2 derives siblings from shared parents, while decision 2 lets the user add a sibling directly. The two can't both hold without placeholder parents.

**A3. Use one engine for blank mode and tree mode.** (Judgement.)
Blank mode's dropdown chain can be a temporary graph built one link at a time. Then there is one path → term engine, and the hop-code grammar (A/E/P/Q cousin hops, `walk.js`) is no longer needed. As written, the two modes use two input models, and only the chain one is built.

**A4. The document contradicts itself.** (Read from the doc.)
Sections 3.1 (`birthOrder` integer), 4.1 (BFS with blood preference), 8 and 12 are superseded by section 10, but only section 12 says so. A fresh reader can't tell what is current. I recommend consolidating into one current spec plus a decisions log.

## B. MVP decisions (section 10)

**B1. Decision 8, one family of origin per graph: reverse it.** (Read from the doc.)
- A child of the marriage needs both the father's family (爺爺, 伯父, 姑媽) and the mother's family (外公, 舅父, 姨媽) in one view. Under decision 8, the mother's parents only exist in the graph where the mother is "me".
- In-law titles (老爺, 奶奶, 外父, 大伯, 姑仔…) are already in the term table, but a married "me" could never see them.
- `WBoW` was the reason for the decision, and it has an easier fix (a marriage count or a distinct path pattern).

Recommendation: one graph holds everyone, and the engine labels whatever path exists.

**B2. Decision 9, the normalisation rules, has errors and gaps.** (Read from the doc; the kinship facts are standard.)
- Rule 4, "UP, DOWN (not you), DOWN", is your sibling's child (侄, 外甥), not a cousin. A cousin is UP, UP, DOWN (not your parent), DOWN.
- Rule 5's alternative, "DOWN, then UP to the child's other parent", is your co-parent (your spouse or ex), not your child's spouse.
- Rule 1 only covers single moves, so these common relatives fall through to "fallback":
  - grandparents (UP UP) and grandchildren (DOWN DOWN)
  - a sibling's spouse (UP DOWN SIDE)
  - an aunt or uncle by marriage (UP UP DOWN SIDE)
  - all of your spouse's family (SIDE UP, SIDE UP DOWN)
  - great-grandparents
- Rule 2 treats a half-sibling (one shared parent) the same as a full sibling. That is fine for terms, but say so explicitly.
- UP, SIDE (a parent's spouse who is not your parent) is a step-parent. It needs its own rule or an explicit fallback.

Recommendation: drop the six fixed rules and use the general form, which covers everything above. Find the closest common ancestor's unit, then describe the path as (up-steps with sexes, down-steps with sexes, age order at the branch, marriage at the start or end). Then look up patterns as in A1.

**B3. Decision 2 still needs a path search.** (Judgement.)
Adding people only by direct link keeps input simple. But switching "me" means computing a path from the new "me" to everyone, so a BFS or common-ancestor search is needed anyway. For 50 people this is trivial (question 9).

**B4. Decision 3 needs more than one bit for siblings.** (Judgement.)
"Older or younger than you?" can't place a third sibling between two others. Ask for a position in the ordered list, such as "after 阿明", or drag to order. That is the same question as rank, asked once per group.

**B5. Decision 4 is fine, with one addition.** (Judgement.)
Showing both cousin variants is a good default. People do know whether a particular cousin is older than them, so let them store that pairwise answer. Decision 7 already allows for this.

## C. Term correctness

**C1. 堂 vs 表.** (Standard Chinese kinship; matches Omniglot's split.)
堂 is only for agnatic cousins: father's brother's children. Father's sister's children are 表, as are all cousins on the mother's side. The design's "paternal cousin" (P/Q hops, rule 4 "side from the parent you went up through") gives 堂 to father's sister's children. The deciding factor is that both linking parents are brothers, not which parent you go up through. Finding 4 in the old review touched this but deferred it.

**C2. Register: the app needs address forms, not terms of reference.** (Judgement; examples are common usage.)
The app's purpose is "the title a person should use". Many entries are how you refer to someone, not what you call them:

| Relation | Entry | What you call them |
|---|---|---|
| Father's elder brother | 伯父 | 伯伯 / 阿伯 |
| Father's younger brother | 叔父 | 阿叔 / 叔叔 |
| Spouse | 太太, 先生 | Name, 老婆 / 老公 |
| Son, daughter, nephew, niece | 仔, 女, 侄 | Name; juniors are addressed by name |
| Siblings | 哥哥, 弟弟 | 阿哥, 家姐, 細佬, 細妹 (more colloquial than the reduplicated forms) |

Finding 12 deferred the address field to "later". It should be in the MVP, with juniors shown as "by name" plus the reference term. This reverses what I recommended in my earlier reply.

**C3. Tones: Jyutping lacks spoken tone changes (變調).** (Checked against jyutdictionary.com where noted.)
Cantonese kinship terms routinely shift tone in speech:
- 阿姨 is aa3 ji**1** (words.hk); the table has ji4.
- 舅父 is kau5 fu**2**; the table has fu6.
- 奶奶 (husband's mother) is naai4 naai2 (words.hk); the table has naai5 naai4, which words.hk gives for *grandmother*.
- 侄 is **zat6**, or zat2 at the end of a word; the table has jat6, which is a romanisation error.
- Likely the same, but unchecked: 姑丈 and 姨丈 (zoeng2), 外婆 (po2), 爺爺 (je4 je2), 外父 and 外母 (fu2, mou2), 姑姐 (ze1), and 女 as daughter (neoi2).

Every Jyutping entry needs a pass against words.hk, plus a native speaker. This must happen before audio. TTS reads characters with dictionary tones, so it will mispronounce exactly these terms, which argues for recorded clips (section 11 open question), at least for the common ~30 terms.

**C4. Gaps that are easy to fill.** (Common usage; unsourced.)
- Grandparents' brothers: 伯公 / 叔公 (paternal grandfather's elder / younger brother), 舅公 (grandmother's brother).
- A spouse's sibling's spouse: varies by family; the fallback is acceptable.
- Aunts' and uncles' address forms (see C2).

**C5. Old status labels overstate certainty.** (Read from the data.)
"Supported" means one web page matched, and some entries are marked "variant" by analogy (姑婆 on the maternal side). With the tone errors above, I'd treat the whole table as unverified until a native-speaker pass.

## D. Scope and other questions

- **URL storage (questions 4 and 5).** For 50 people with short names, compact JSON is about 3–5 KB, which is fine in a URL fragment (`#`). The fragment isn't sent to servers, which also helps privacy. Make names optional, and allow initials.
- **Audio (section 7).** Web Speech has zh-HK voices on iOS, macOS, Windows and Android Chrome, but it can't be relied on for the tones in C3. Recommendation: clips for the common terms, TTS as a fallback.
- **Speaker sex.** It barely matters once in-law sides (H/W) are modelled. A few terms differ by speaker sex in some families (弟婦 vs 弟妹). Keep a speaker-sex input in the descriptor so the table can use it.
- **Out of scope, and fine to leave there:** adoption and multiple marriages. Half-siblings and step-parents become cheap with A2.

## Suggested order if you agree

1. Rewrite the spec: family-unit model (A2), one shared graph (B1), common-ancestor descriptor (B2), pattern-keyed term table with address and reference fields (A1, C2).
2. Write the descriptor engine with graph-fixture tests for every relation in the current walker.
3. Port the term data to patterns, fixing 堂/表 (C1). Do a tone pass (C3) and get a native-speaker review.
4. Then build the UI as planned.

## Decisions from discussion with aaron

1. **Family shown (replaces decision 8, settles B1).** An unmarried user sees both parents' sides in one view. A married user sees either their own family or their spouse's family, one at a time.
2. **Titles on the spouse's side.** They are the user's own in-law titles (老爺 / 奶奶 or 外父 / 外母, 大伯, 姑仔, 大舅…), not the spouse's titles.
3. **Path to relationship (replaces decision 9, settles B2).** Use the general common-ancestor method instead of the six fixed rules.
4. **Title table keys (settles A1).** The table is keyed by readable path patterns. No compact or short codes.
5. **Sibling storage (settles A2).** Family groups: up to two parents (either may be unknown) plus children in birth order.
6. **Spoken and formal forms (settles C2).** The MVP shows both: the spoken form you'd say to the person, with the formal term underneath. Younger relatives show "by name".
7. **Audio (settles section 7).** The MVP uses browser text-to-speech only. Recorded clips can come later and aren't critical for the MVP.
8. **Sibling order input (settles B4).** Pick a slot: the existing siblings are shown in order and the user taps where the new one goes. Rank and older/younger are both read from the position.
9. **Cousin age (settles B5).** Cousins always show both titles with the condition (older: 表哥, younger: 表弟). No stored answer. This supersedes design decision 7 for cousins.
10. **One engine (settles A3).** Blank mode builds a temporary family tree as the user picks, and uses the same engine as tree mode. The hop-code chains, walker and 8-character key are retired.
11. **Names and link storage (settles D, questions 4 and 5).** Names are optional (a nickname, initials, or none). The tree is stored after the # in the link.
12. **Language.** TypeScript, not plain JavaScript, for the rewrite.
13. **Half-siblings and step-parents.** Out of the MVP. The link format carries a version number so they can be added later without breaking shared links.
14. **Term checking (settles C3, C5).** Claude checks every entry against words.hk and flags doubts, then aaron or a Cantonese-speaking relative confirms the list before the MVP ships.

Not a decision, just a correction: 堂 is used only for the children of the father's brothers. All other cousins are 表 (C1).

## Future work (out of MVP, noted to revisit)

- **Half-siblings:** a parent in more than one family group; children of different groups share one parent. Titles are usually the same as for full siblings, so mostly a data-model change.
- **Step-parents and a parent's later spouse:** reached as a parent's spouse who is not your own parent. Needs its own titles or a fallback description.
- **Adoption** and **multiple marriages** in general.
- **Recorded audio clips** for the common titles (decision 7).
- **Stored cousin age** (older/younger than me), if showing both titles proves noisy (decision 9).
- **Family rank titles** (大姨, 二姨, 細姨) as a per-family table, read from sibling order.
15. **Married view (refines decision 1, agreed approach).** One tree holds everyone, and adding a spouse's relative is never an error. Each person is tagged by side: **shared** (the couple, their descendants and the descendants' spouses), **husband's side**, or **wife's side**. The side toggle is only a display filter: it hides the other side's people at the couple's generation and above, and the descendants always show. The perspective toggle is the existing "switch me" (husband or wife). Titles are always from "me", so the spouse's side shows in-law titles. MVP: both toggles included. Distant in-laws (e.g. the spouse's grandmother) may show the fallback description until their titles are in the table. A child's spouse's family (親家) is a later item.
16. **Sides are computed from "me", never stored (refines 15).** The data holds only people, family groups and marriages. On every "switch me", a view function `sides(me)` labels each person:
    - If "me" has no spouse, there is one side and no toggle.
    - If "me" has a spouse: **shared** = me, the spouse, their descendants and those descendants' spouses. **My side** = everyone reached from my parents without passing through me (search starting at my parents, with me blocked). **Spouse's side** = the same, starting from the spouse's parents with the spouse blocked. Anyone reached from both (e.g. relatives who married each other) is labelled both, and shows under either toggle.
    - The toggle appears only when "me" is married, and resets to my side on each switch. Example: switching to a married child makes the child's side the whole upper tree (both of the child's parents' families), and the other side is the child's spouse's family.
17. **Blank mode is tree mode with an empty tree.** It is not a separate mode or screen.
18. **Autosave.** The tree is autosaved to the browser's localStorage as well as being stored in the link.
19. **Unknown parents.** Adding a relative whose parents aren't in the tree (e.g. an aunt) creates a family group with unknown parents. The parents can be filled in later.
