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
- Project dir is NOT a git repo: no `git diff`; relocation/behaviour-change claims must be checked by reading current files only (say so in the report).
- Apps Script backend is tested via a vm sandbox with fakes (apps-script/wishes.test.ts); fakes do not model real Sheets/Cache limits (formula parsing, 100KB cache value cap, lock contention), so check those against real GAS semantics.
