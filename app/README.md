# Kinship app (slices 4a, 4b)

Vite + React + TypeScript. Imports the engine from `../engine/src` directly.

- `npm run typecheck`, `npm test`, `npm run build` (in this shared folder use `node node_modules/typescript/bin/tsc`, `node node_modules/vite/bin/vite.js build`; there are no `.bin` links).
- `?demo` in the address bar loads a sample family.
- `src/layout.ts` pure layout + link segments; `src/display.ts` card text from `resolve`; `src/TreeView.tsx` pan/zoom; `src/App.tsx` shell, side toggle (only when "me" is married), add-person sheet (`src/add/AddPerson`).
- Slice 4c: `src/persist.ts` wraps `../storage` (open/save/encodeFragment). App opens from the link (wins over saved), autosaves on every change and keeps the address bar on the current link; "Copy link" in the header; a bad link shows a dismissable notice and falls back to the saved tree. Tests: `test/persist.test.ts`.
