# Test report: journey foundation (phase 1)

Date: 2026-10-15 | Branch: main | Scope: Three.js journey foundation (src/journey/*, use-time-of-day, motion-preference, webgl-support)

## Results

| Check | Result |
|---|---|
| `npx vitest run` (run 1) | 28 files, 262 passed, 0 failed |
| `npx vitest run` (run 2) | 28 files, 262 passed, 0 failed (identical) |
| Baseline before this task | 21 files, 228 passed |
| `npm run lint` (oxlint) | exit 0, no warnings or errors |
| `npm run build` (`tsc -b` + `vite build`) | exit 0, type-check clean (tsconfig.app includes src and so the new tests) |

Build warning (pre-existing class, not a failure): `three.module` chunk 534.77 kB min / 133.51 kB gzip, above Vite's 500 kB warning. Journey code is split out (`start-journey` 3.74 kB, `corridor-scene` 5.16 kB); Three.js stays in its own chunk and is only loaded when WebGL is available and reduced motion is off.

Coverage: NOT measured. `@vitest/coverage-v8` is not installed (`MISSING DEPENDENCY`). Not installed here because it changes package.json.

Source under src/ not modified. Test files added (34 new tests):

| File | Tests | Covers |
|---|---|---|
| src/journey/journey-path.test.ts | 4 | z monotonic, endpoints (z 8 to -92 = JOURNEY_DEPTH), finite point/tangent at 0, 0.5, 1, forward tangent |
| src/journey/journey-engine.test.ts | 10 | on-demand loop (render once, stop when idle, restart on invalidate), continuous scene keeps loop, resize 0 ignored, FPS governor drops one tier after warmup, idle gaps >250ms ignored, no drop below low, context lost → onContextLost after 3s, restored in time → no error, dispose order |
| src/journey/start-journey.test.ts | 8 | initial tier by pointer/cores/RAM/width, fit on start and resize, progress → invalidate, dispose unsubscribes, context-lost → onFail reason, onTierChange forwarded |
| src/journey/journey-canvas.fallback.test.tsx | 3 | startJourney throws → html, onFail → html and canvas removed, unmount disposes |
| src/journey/journey-canvas.import-failure.test.tsx | 1 | chunk import() rejects → data-journey=html, no canvas |
| src/lib/motion-preference.test.ts | 3 | reduce → true, no match → false, no matchMedia → false |
| src/lib/webgl-support.test.ts | 5 | webgl2, webgl1 fallback, none, getContext throws, result cached |

Existing tests unchanged. Existing journey tests (quality-tier, scroll-progress, time-of-day, use-time-of-day, journey-canvas) pass with no stderr noise.

## Determinism

Two full runs: identical counts and no failures. Journey subset run three times: stable. Timers are faked in hook and engine tests. Module-level state (webgl-support cache, journeyProgress singleton, listeners) is reset per test via `vi.resetModules`, `dispose` in afterEach, or `vi.clearAllMocks`.

## Coverage gaps (by inspection, no coverage tool)

- use-time-of-day: resize and ResizeObserver retarget path untested (jsdom has no ResizeObserver; the `typeof ResizeObserver === 'undefined'` branch is hit, the observer branch is not).
- use-time-of-day calm test asserts `--tod` in {0.000, 0.250, 0.500}. Exact expected value at progress 0.5 is 0.250. Loose assertion, not wrong.
- probe-scene.ts: no test. Throwaway phase-1 scene, replaced in later phases.
- journey-progress.ts: only exercised indirectly through start-journey and use-time-of-day tests.
- Scene-level behaviour (quality setQuality density rebuild on tier change) only tested through the mocked engine, not with a real scene.
- quality-tier and scroll-progress and time-of-day: already well covered (happy path, clamping, boundaries, WCAG AA contrast of --ink across all colour stops).

## Manual test gaps (cannot be verified in jsdom or with a mocked renderer)

- Real WebGL rendering: frame appearance, camera path visually, alpha over the HTML background.
- Real FPS governor behaviour on a low-end phone under load.
- Real context loss and restore (tab backgrounded for long time, GPU reset).
- iOS Safari and in-app browsers: WebGL availability and matchMedia behaviour.
- Reduced motion toggled in the OS at runtime (only the query result is tested, not live change events; motion-preference reads once per call).
- Chunk load failure over a real network (simulated only).

## Critical issues

None blocking. All checks green.

## Recommendations (priority)

1. Install `@vitest/coverage-v8` (needs approval, package.json change) and set a threshold for src/journey and src/hooks/use-time-of-day.ts.
2. Tighten use-time-of-day calm assertion to exact '0.250' (test owner decision; not changed).
3. Add a resize/ResizeObserver test for use-time-of-day.
4. Manual device pass on one low-end Android and one iOS Safari before phase 2 visual work.

## Unresolved questions

- Should coverage tooling be added to devDependencies? Needed for real numbers.
- Is the calm-mode assertion in use-time-of-day.test.tsx meant to be exact? Left as-is.
- Is the 500 kB Three.js chunk warning acceptable, or should `build.chunkSizeWarningLimit` be raised? Left as-is.
