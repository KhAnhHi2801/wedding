# Test report: hero 3D gate (phase 2)

Scope: uncommitted gate code in src/journey, src/sections/hero-section.tsx, journey-engine/start-journey/canvas changes. Full suite run (not diff-aware).

## Results

| Check | Result |
|---|---|
| `npx vitest run`, run 1 (before new tests) | 31 files, 305 passed, 0 failed |
| `npx vitest run`, runs 2-3 (before new tests) | 31 files, 305 passed each (deterministic) |
| `npx vitest run`, after new tests | 32 files, 318 passed, 0 failed (x2) |
| `npx vitest run`, final snapshot | 33 files, 328 passed, 0 failed |
| `npx oxlint` (npm run lint) | exit 0, no warnings or errors printed |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0, built in ~0.5s |

Counts rose between runs because other work landed in the tree during this session (new `prepare-journey.ts`, `gate.loading()` state, `hero-section.test.tsx` loading case). Final snapshot is the current tree.

Build warning: `Some chunks are larger than 500 kB` (three.module ~559 kB, minified). Not a failure. Not compared against the base commit.

No coverage tool run. No per-test timing data gathered; total suite ~7-9s.

## New tests added (new files or additions to new file only)

- `src/journey/scenes/gate-scene.test.ts` (new, 11 tests). Real three.js objects, fake SceneContext (no WebGL), `./gate-textures` mocked (canvas 2D absent). Covers:
  - init closes gate; init with progress > 0.004 leaves gate open and hides root; boundary 0.004 stays closed
  - auto-open at AUTO_OPEN_SECONDS (2.5s accumulated); scroll progress 0.005 opens immediately
  - opening finishes at OPEN_SECONDS (2.6s): still `opening` at 2.5s, `open` + `gate.finish` called at 2.6s, root hidden
  - double `requestOpen` skips animation
  - `continuous` true while closed/opening; after gate gone it stays true until INTRO_SECONDS, then false
  - dispose: gate back to `open`, root removed from scene, material/geometry/texture dispose called
  - setQuality: instanced count matches `instanceCounts(density)` (1320 at high, 404 at low); after gate gone it does not throw and does not rebuild
- `src/sections/hero-section.test.tsx` (existing new file, 2 cases added): native `<button type="button">` check for "Mở thiệp"; CTA link click when open leaves state `open`.

All new tests pass. Existing tests were not modified.

## Keyboard activation

Not tested as real keyboard input. jsdom does not turn Enter/Space keydown into click. Existing "Mở thiệp" test dispatches a click, which is what browsers emit for keyboard activation of a native button. Added test asserts the element is a native button so the keyboard path holds. Real keyboard check is manual.

## Failures

None. Three of my first-draft assertions failed (wrong expectations in my test, not code defects): off-by-one in the opening frame count, `continuous` expectation before intro done, and setQuality test not having gated the gate yet. Fixed in the test files; no source change.

## Coverage gaps (not tested, manual or future)

- TextureLoader success path with a real `heroSrc` (cover fit, sRGB, anisotropy, photo fade). Only `heroSrc: null` covered.
- `gate-textures.ts` canvas drawing: mocked out, output not checked.
- `use-gate-state.ts` React hook subscription in isolation (covered indirectly via hero-section).
- Visual result of bloom/petals/door animation, GPU performance, WebGL context loss in gate scene. Manual.
- Real keyboard activation in browser. Manual.

## Critical issues

None blocking.

## Recommendations

1. Add a TextureLoader test with a stubbed loader (`vi.mock('three', ...)` on TextureLoader.load) to cover photo fit and the error callback.
2. Manual pass in Safari/Chrome for keyboard focus ring and Enter/Space on "Mở thiệp".
3. Low priority: when the gate is skipped at t=0, `continuous` keeps the render loop running for hidden parts until 1.5s. Harmless but wasteful; consider `introDone` short-circuit if gate is gone.

## Next steps

1. Decide on the open questions below.
2. Add TextureLoader coverage if photo path changes again.

Status: DONE_WITH_CONCERNS

## Unresolved questions

- Who is editing the tree concurrently? `gate.loading()`, `prepare-journey.ts`, and staged changes appeared mid-session; test counts moved 305 → 318 → 328. Results above reflect the final snapshot only.
- Intended behavior: clicking "Xem thời gian & địa điểm" while the gate is closed opens the gate and also navigates to `#events`. Not covered by tests, not asked for.
- Is `continuous: true` until INTRO_SECONDS after a skipped gate intended (hidden parts keep updating)?
- Is the >500 kB chunk warning pre-existing on `main`? Not checked.
