# kintree

A family tree that tells you what to call each relative in Cantonese, Mandarin, Vietnamese, Japanese, Korean or Tagalog. Pick yourself, add parents, siblings, spouses and children, and every card shows the title (characters and Jyutping, pinyin, rōmaji or Revised Romanization; Japanese kanji carry furigana; Vietnamese and Tagalog are shown as is), with spoken and formal forms and audio. The language is the viewer's choice from the picker; a link carries `?lang=yue`, `?lang=cmn`, `?lang=vie`, `?lang=jpn`, `?lang=kor` or `?lang=tgl`, and defaults to Cantonese without one.

**Live:** https://fungeey.github.io/kintree/ (add `?demo` to load a sample family)

> **The Cantonese, Mandarin, Vietnamese, Japanese, Korean and Tagalog titles have not yet been checked by a native speaker.** Some were checked against words.hk; the rest are unverified. Every title and its status is listed in [`engine/data/FLAGGED.md`](engine/data/FLAGGED.md). Please treat the titles as a draft until that list is reviewed. The Mandarin table (simplified, mainland usage) and the Vietnamese table (northern usage) are all `unverified`; its regional variants are in each entry's `note`.
>
> The Japanese, Korean and Tagalog tables (`engine/data/jpn`, `kor`, `tgl`) are also all `unverified` and are not yet in `FLAGGED.md`. Korean covers close family and in-laws; distant relatives (cousins' spouses, a mother's cousins, spouse's uncles and aunts) fall back to a generic title and a description. Korean titles depend on the viewer's sex (a man says 형, a woman 오빠), taken from the sex of the person the tree is viewed as. The scope behind these three is in the project's `kinship/LANGUAGES-KO-JA.md`.

## Layout

- `app/` – the web app (Vite + React + TypeScript). See [`app/README.md`](app/README.md).
- `engine/` – works out the relationship path between two people and matches it to a title. Spec in [`engine/SPEC.md`](engine/SPEC.md); titles in `engine/data/<language>/`.
- `storage/` – saving the tree locally and encoding it into a shareable link.
- `DESIGN.md`, `REVIEW.md`, `PLAN.md` – design notes, review decisions and the build plan.
- `archive/` – the first JavaScript prototype (`original/` as first written, `legacy/` as later edited), kept for reference. Not used by the app.

## Develop

```sh
npm ci --prefix engine && npm ci --prefix app
cd app
npm run dev      # local server
npm test         # app tests (engine and storage: `npm test` in their folders)
npm run build    # production build in app/dist
```

Pushing to `main` runs the tests, builds the app with base path `/kintree/` and deploys it to GitHub Pages (`.github/workflows/pages.yml`).
