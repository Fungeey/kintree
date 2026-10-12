# Build plan: remaining slices

Status on 2026-10-12: the matching engine spike is done (`engine/`, 12 tests passing). It covers the path, the title match and the fallback. Decisions are in `REVIEW.md`; the engine spec is `engine/SPEC.md`.

Each slice ends with passing tests. Each one is small enough to review in one sitting.

## Slices

| # | Slice | Depends on | Can run in parallel with | Needs from aaron |
|---|---|---|---|---|
| 1 | **Tree editing and sides.** Add parent, child, spouse and sibling (with a birth-order slot). Creating unknown-parent family groups. Remove a person. `sides(me)` for the married view (decision 16). Pure TypeScript with tests, no UI. | engine | 2, 3 | Nothing |
| 2 | **Storage.** Versioned tree format, compressed into the link after `#`, with "me" in the link. Autosave to localStorage and restore on open. If the link and the saved tree differ, the link wins and the saved one is kept as "recent". | engine types | 1, 3 | Nothing |
| 3 | **Title table.** Port all titles to patterns and add spoken forms. Check every entry against words.hk and flag doubts. Fill the gaps (grandparents' brothers, in-law grandparents). | engine | 1, 2, 4, 5 | A native-speaker pass on the flagged list at the end (decision 14) |
| 4a | **App shell and drawn tree.** A drawn family tree (generations as rows, couples joined, children under their family group), centred on "me". Each person card shows the spoken title (large), the formal title, Jyutping, the both-ages view for cousins, or the fallback. Tap a person to switch "me". Side toggle when "me" is married. Must work on a phone (pan and zoom). | 1 | 3, 4b | Nothing |
| 4b | **Add-person flow.** Start from someone in the tree, then pick a relation, sex and optional name. Siblings are placed by tapping a slot (decision 8). An empty tree starts with "me" (decision 17). | 1 | 3, 4a | Nothing |
| 4c | **Copy link.** Wire up storage: copy-link button, open from link, autosave. | 2, 4a | 5 | Nothing |
| 5 | **Text-to-speech.** Play button using the browser's Cantonese (zh-HK) voice, hidden when the browser has none. Reads the spoken form. | 4a | 3, 4c | Nothing |
| 6 | **Ship.** Native-speaker sign-off on titles, a final test pass, and deploy. | all | none | Final title sign-off, and where to host |

Order of work: start 1, 2 and 3 now. Then 4a and 4b once 1 lands. Then 4c and 5. Then 6. Slice 3 runs alongside everything, because it is data plus a dictionary check and touches no code paths.

## Defaults I'm picking (say if you want different)

- **Framework:** Vite + React + TypeScript, static site, no backend.
- **Hosting:** GitHub Pages from the app repo.
- **People view:** a drawn family tree in the MVP (aaron, 2026-10-12). The layout is our own code over family groups, which keeps it light and testable; a layout library is a fallback if that proves hard.
- **Old JavaScript files** (`kinship.js`, `codec.js`, `walk.js`, `terms.json`, `check.js`): retired once slice 3 has ported the titles. I'll move them to `legacy/` rather than delete them.

## Where the code lives

Everything is built in `/mnt/project-files/kinship/`: the engine in `engine/`, and the app in `app/` from slice 4. aaron will create the GitHub repo at the end. At that point the code moves into it, and slice 6 deploys from it.

## Who builds

The project coordinator runs the build with Sonnet agents, one per slice, in the order above (aaron, 2026-10-12).
