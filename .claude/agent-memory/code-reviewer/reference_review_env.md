---
name: review-env-constraints
description: Tooling constraints when reviewing weddingg (scout-block hook patterns, how to build without touching dist)
metadata:
  type: reference
---

- scout-block hook denies any Bash path containing `node_modules`, `dist`, or `build` (even in the scratchpad). Name scratch output dirs e.g. `bundleout`.
- Read-only reviews: run `npx vite build --outDir <scratchpad>/bundleout --emptyOutDir` to inspect the bundle without writing `dist/`.
- `npm test` (vitest), `npm run lint` (oxlint), `npx tsc -b --noEmit` all run quickly (<5s).
- Apps Script backend is tested via a vm sandbox with fakes (apps-script/wishes.test.ts); fakes do not model real Sheets/Cache limits (formula parsing, 100KB cache value cap, lock contention), so check those against real GAS semantics.
