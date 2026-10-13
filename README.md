# kintree

A family tree that tells you what to call each relative in Cantonese or Mandarin. Pick yourself, add parents, siblings, spouses and children, and every card shows the title (characters and Jyutping or pinyin), with spoken and formal forms and audio. The language is the viewer's choice from the picker; a link can carry `?lang=cmn`.

**Live:** https://fungeey.github.io/kintree/ (add `?demo` to load a sample family)

> **The Cantonese and Mandarin titles have not yet been checked by a native speaker.** Some were checked against words.hk; the rest are unverified. Every title and its status is listed in [`engine/data/FLAGGED.md`](engine/data/FLAGGED.md). Please treat the titles as a draft until that list is reviewed. The Mandarin table (simplified, mainland usage) is all `unverified`; its regional variants are in each entry's `note`.

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
