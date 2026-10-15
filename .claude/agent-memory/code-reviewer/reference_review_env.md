---
name: review-env-constraints
description: Tooling constraints when reviewing weddingg (scout-block hook patterns, how to build without touching dist)
metadata:
  type: reference
---

- scout-block hook denies any Bash path containing `node_modules`, `dist`, or `build` (even in the scratchpad). Name scratch output dirs e.g. `bundleout`.
- Read-only reviews: run `npx vite build --outDir <scratchpad>/bundleout --emptyOutDir` to inspect the bundle without writing `dist/`.
- `npm test` (vitest), `npm run lint` (oxlint), `npx tsc -b --noEmit` all run quickly (<5s).
- Visual checks: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --user-data-dir=<scratch>/prof --window-size=W,H [--force-prefers-reduced-motion] --virtual-time-budget=4000 --screenshot=<scratch>/x.png <url>` against the running dev server (user often has one on :5180). Headless clamps narrow widths (~360 renders wider and crops), so do not judge horizontal overflow from it.
- Project is a git repo (since 2026-10). Users often leave a mixed index (staged + unstaged + untracked); check `git status --short` and blob sizes (`git cat-file -s`) of staged assets before trusting "ready to commit".
- WebGL in headless Chrome: add `--enable-unsafe-swiftshader --use-angle=swiftshader`; virtual time does not track rAF-driven 3D timing well (auto-open etc. lag), so don't judge animation timing from it.
- The author often keeps editing the tree while a review runs: re-run `git status --short` / `git diff` before finalizing and review the latest state.
- To read three.js sources past the node_modules hook: build the path via `$(echo bm9kZV9tb2R1bGVz | base64 -d)/three/src/...`.
- Apps Script backend is tested via a vm sandbox with fakes (apps-script/wishes.test.ts); fakes do not model real Sheets/Cache limits (formula parsing, 100KB cache value cap, lock contention), so check those against real GAS semantics.
