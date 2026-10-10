# POS UI legibility and density

## Objective

Make the POS module practical to operate on a desktop PC: readable typography, a
cart panel that does not feel cramped, and click targets that are comfortable to
hit with a mouse.

## Problem

The operator reports that the cart is too small and the fonts are too small. The
investigation found that **the reported symptom is caused by a bug, not a design
choice**.

### Root cause: the webfonts are never loaded

`pages/pos/styles.ts` exports `initStyles()`, which injects the Google Fonts
`<link>` for Sora and DM Mono. **That function is never called.** Verified:

- `initStyles` has zero occurrences across `frontend/src`.
- `frontend/index.html` has no font `<link>` and no `preconnect`.
- `frontend/src/index.css` has no `@import` and no `@font-face`.
- The built output confirms it: `dist/index.html` ships no font link and
  `dist/assets/index-*.css` is 1.01 kB — only `index.css`.

`pages/POS.tsx:6` does `import './pos/styles'` intending a side effect, but the
module only declares a function; importing it does not call it.

Therefore `body { font-family: 'DM Mono', monospace }` (`index.css:28`) and the
29 inline `fontFamily: "'DM Mono', monospace"` declarations in the POS resolve
to the generic `monospace` fallback (Courier New on Windows). A monospace face
renders perceptually smaller than a proportional face at the same `font-size`,
which is exactly the reported "fonts look tiny".

### Second symptom: every POS animation is dead

`slideIn`, `fadeIn`, `scanPulse` and `flashGreen` are declared in the same
never-called `initStyles()`. They are not in `index.css` either. So
`item-enter` (`render.tsx:208`), the scanner pulse (`render.tsx:48`), the modal
fade (`components.tsx:137`) and the ticket check animation
(`components.tsx:263`) all animate names that do not exist.

### Secondary findings

| # | Finding | Evidence |
|---|---------|----------|
| 1 | Two sources of truth for the same 15 colors | `index.css:1-18` defines `:root` tokens the POS never reads; `pages/pos/types.ts:8-25` re-implements them as a hardcoded `C` object |
| 2 | No typographic scale | Arbitrary sizes: 10, 11, 12, 13, 14, 15, 18, 20, 22, 32 |
| 3 | Cart is a fixed 340px | `render.tsx:162` — never grows with the monitor |
| 4 | Undersized click targets | 24px quantity buttons (`render.tsx:227,235`) and a 12px delete icon (`render.tsx:254`) |
| 5 | Hover-only affordances | Frequent products and search results rely on `onMouseEnter`/`onMouseLeave` with no focus-visible equivalent |
| 6 | Wasted grid | Frequent products use `repeat(2, 1fr)` (`render.tsx:137`) inside the widest panel |
| 7 | Barrel | `pages/pos/index.ts` re-exports all modules, against the `AGENTS.md` "no barrels" rule (Stock was already de-barreled) |

## Scope (confirmed with user)

- Target device is a **desktop PC**, confirmed by the user. Therefore: **no touch
  mode, no touch breakpoint, no density toggle**. Click targets still grow to a
  mouse-comfortable ~34px (Fitts's law applies to mouse pointing too), but the
  44px touch minimum does not drive the design.

## Constraints

- `AGENTS.md`: `strict` + `noUncheckedIndexedAccess` +
  `noPropertyAccessFromIndexSignature`. No `any`, no `!`, no `as` to silence the
  compiler. User-facing copy in neutral Spanish; identifiers/comments in English.
  Conventional Commits, Spanish description, one commit = one coherent work unit.
  Tests ship in the same commit as the behavior they verify.
- `POS.smoke.test.tsx:50-63` asserts the copy "Punto de Venta", "Carrito",
  "Escaneá un producto", "Productos frecuentes", "Scanner listo". Copy changes must
  update this test in the same work unit.
- Layout is inline styles; extracting to CSS is out of scope for this feature
  except for the stylesheet that carries the fonts and keyframes.

## Test policy

`jsdom` does not load webfonts and does not evaluate animation names, so there is
no meaningful runnable RED for "the font renders". The exception is documented
here and covered instead by a deterministic structural test that reads the shipped
`index.html` and the POS stylesheet from disk and asserts the font link, the
`preconnect` hints and every `@keyframes` name are present. That test goes RED
before the fix and GREEN after it, and it guards against the exact regression.

Functional checks for every work unit: `npx tsc --noEmit`, `npm run lint`,
`npx vitest run`, `npm run build`.

## Baseline (verified on `feat/pos-ui-legible`, clean tree)

- `npx tsc --noEmit` — exit 0
- `npm run lint` — exit 0 (1 pre-existing warning inside generated `coverage/`)
- `npx vitest run` — 78/78 passing
- `npm run build` — exit 0

## Tasks

### WU1 — Fix the webfont and animation loading (bugfix, standalone)

- Add `preconnect` + font `<link>` to `index.html`.
- Introduce `pages/pos/pos.css` carrying the four `@keyframes` and the
  `item-enter` / `flash-green` classes; import it from the POS entry.
- Delete the dead `pages/pos/styles.ts` and its import in `pages/POS.tsx`.
- Add the structural regression test described above.
- Ships alone so a future visual regression is attributable.

### WU2 — Typographic scale, font roles and cart width

- Add a type scale and size tokens to `pages/pos/types.ts`.
- Move the base font to a Sora-first stack in `index.css`, exposed as
  `--font-sans` / `--font-mono` custom properties.
- Switch text to Sora and keep DM Mono for figures only (prices, quantities,
  totals) across `render.tsx` and `components.tsx`.
- Make the cart width responsive instead of the fixed 340px.

The cart width ships inside WU2 rather than WU3 on purpose: raising the type scale
~25% inside a fixed 340px column truncates product names, so the intermediate
commit would render worse than the one before it. Every commit must render sanely
on its own.

### WU3 — Self-hosted font delivery (closes `R3-cdn-render-blocking`)

- Vendor the latin-subset `woff2` files into `frontend/public/fonts/` so the POS
  has **zero** third-party runtime dependency and renders with no network at all.
- Only the weights the code actually declares are vendored: `fontWeight` in use
  across the POS is exactly 400, 500, 600 and 700 — the 300 in the original Google
  Fonts URL was dead weight. Sora 400/500/600/700 plus DM Mono 400/500 = 6 files.
- Declare them with `@font-face` in `index.css`, `font-display: swap`, keeping the
  `unicode-range` so the browser never requests another subset.
- Remove the `preconnect` hints and the Google Fonts `<link>` from `index.html`.
- Give `FONT.sans` / `FONT.mono` a fallback inside `var()`
  (closes `R3-font-token-no-fallback`), so a missing stylesheet degrades instead of
  silently erasing the typography contract.
- Invert the corresponding test assertions: no third-party origin in
  `index.html`, `@font-face` present for both families, all six files on disk.

### WU4 — Targets, grid and focus affordances

- Apply `SZ.target` to the quantity and delete controls, which also closes
  `R3-sz-target-dead-token`.
- `auto-fill` grid for frequent products.
- Add `focus-visible` equivalents to the hover-only affordances.

### WU5 — Close the review's test guard gaps

- `R3-css-wiring-unguarded`: assert the POS entry still imports the stylesheet and
  that every animation name used by a POS component is a declared `@keyframes`.
- `R3-scale-adoption-unasserted`: assert no `fontSize` outside the `FS` scale and
  no raw monospace literal in the POS modules, so the scale cannot drift.
- `R3-test-cwd-root`: resolve fixture paths independently of the launch directory.
- `R3-negative-body-font-guard`: make the negative assertion reject any hardcoded
  family, not just a single-quoted literal directly after the colon.

### WU6 — Consolidate the token source of truth

- Resolve the `index.css :root` vs `pages/pos/types.ts` `C` duplication so the
  palette has one documented owner.
- Remove the `pages/pos/index.ts` barrel in favour of direct module imports.

## Forecast

Roughly 250-300 authored changed lines across the four work units — under the
400-line delivery budget, so a single branch and a single PR.

## Progress

### WU2 — Typographic scale, font roles and cart width — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`), 5 files touched.
- The POS declared `fontFamily: "'DM Mono'"` on 29 elements, so product names,
  buttons and nav labels all rendered monospace. Text is now `FONT.sans` (Sora
  via `--font-sans`) and figures stay `FONT.mono`.
- 62 `fontSize` declarations moved onto the `FS` scale. Parent-verified: **0**
  sizes outside the scale, **0** raw `'DM Mono'` literals, **0** hand-written
  `fontFamily: 'var(...)'` remain in `render.tsx` / `components.tsx`.
- Cart width `340` → `clamp(${SZ.cartMin}px, 30vw, ${SZ.cartMax}px)`.
- Parent corrected one worker slip: `SZ.cartMin` / `SZ.cartMax` were exported but
  unused (the clamp had been written as a literal), leaving the exact kind of dead
  export that caused WU1. Fixed inline by interpolating the tokens.
- Test policy exception applied as documented: jsdom has no font metrics, so the
  scale itself is unobservable. Three deterministic structural assertions were
  added to `pos-fonts.test.ts` (6/6 → 9/9). The worker **explicitly did not claim
  a RED run** for those three because they were written after the implementation.
- Parent spot check: `tsc` 0, **87/87** tests, `build` 0.
- Commit: `0fd1b6f`.
- Native assessment: **medium**, `executable_change` on `frontend/index.html`;
  `review_due: true`, reason `slice_budget_reached` (542 lines).
- Native review ran and was **approved**. Lineage `review-93d2bbfcc3f6ee39`,
  one lens (`review-reliability`), correction budget 200 lines, zero corrections
  consumed. Acknowledgement burned the authority
  (`gentle-ai.review-acknowledged/v1`, `authority: burned`).
- Reviewed boundary advanced to `0fd1b6f`.

### Advisory findings from the native review (none blocking)

- `R3-cdn-render-blocking` — **worth acting on.** The font stylesheet is a
  synchronous `<link>` to a third-party origin in the document head, so first
  paint is blocked on that request. On a POS terminal with restricted or flaky
  egress the application holds blank until the request fails or times out: a
  cosmetic font choice becomes an availability dependency for checkout. This is
  the same class of fragility that caused the original bug. Raised with the user
  as a decision, not actioned unilaterally.
- `R3-font-token-no-fallback` — `FONT.sans` / `FONT.mono` are bare `var()`
  references with no fallback inside the call, so a missing stylesheet erases the
  typography contract silently at computed-value time.
- `R3-sz-target-dead-token` — `SZ.target` is still unreferenced; WU3 consumes it.
  The reviewer flagged exactly the dead-export class already corrected once in
  this slice.
- `R3-css-wiring-unguarded` — the structural test proves the `@keyframes` exist
  but never that the POS entry imports the stylesheet or that every used
  animation name is a declared one. The original regression could return green.
- `R3-scale-adoption-unasserted` — the no-sizes-outside-the-scale invariant is
  verified by hand, not by a test; a new literal size will not turn the suite red.
- `R3-test-cwd-root` — fixture paths resolve from `process.cwd()`, so a runner
  started outside `frontend/` errors with ENOENT instead of failing on behavior.
- `R3-negative-body-font-guard` — the "body never hardcodes a family" assertion
  only rejects a single-quoted literal directly after the colon; double quotes or
  extra whitespace satisfy it.

### WU6 — Palette ownership, dead code and the barrel — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`) + one parent cleanup.
- **The obvious fix was rejected on purpose.** Making `C` hold `var(--accent)`
  strings would have put `var()` into three contexts no test here can observe:
  SVG presentation attributes (`stroke={C.textLight}`), CSSOM assignment from
  hover handlers (`e.currentTarget.style.border = '1px solid ' + C.accent`), and
  inline concatenation. `C` keeps literal values; drift is made *detectable*
  instead of making the value indirect.
- 41 palette-duplicating literals replaced with `C.*` across `components.tsx`
  (`render.tsx` already used tokens throughout). `#FEE2E2` and `#0A0A0A` had zero
  occurrences, so nothing was replaced for them.
- Three sites needed a form change rather than a substitution: backtick border
  templates, two CSSOM handlers, and one SVG `stroke` attribute.
- Left deliberately, and each for a reason: `#F9FAFB`, `#6B7280`, `#4B5563`,
  `#9CA3AF` and the `rgba(255,255,255,0.0x)` scrims are sidebar-specific with no
  `:root` entry; `#D1D5DB` is the disabled-button grey; `rgba(0,0,0,0.45)` is the
  modal scrim and is distinct from `C.border`'s `0.15`; `#16A34A` is a gradient
  stop; `#FECACA` is the error border.
- Drift guard added in both directions: every `C` token must equal its `:root`
  value, and every `:root` colour must exist in `C` with only `--font-sans` /
  `--font-mono` excluded as font stacks. Proven with five independent mutations,
  each failing exactly its own guard, and each reverted hash-identically. A third
  guard fails if any `C` value contains `var(`, so nobody is tempted back.
- Barrel `pos/index.ts` deleted. Three importers repointed at `./types` and
  `./icons`. **17 unused imports dropped**, each verified by a case-sensitive body
  scan — `tsc` has no `noUnusedLocals`, so it would not have caught a mistake.
- Dead `@keyframes flashGreen` / `.flash-green` removed. The two test assertions
  were **inverted**, not deleted, so reintroducing dead CSS now fails the suite.
- **Parent cleanup:** `C.blue` and `C.blueBg` were dead inside the POS — zero
  usages, and the sibling pages each declare their own literal `C`, so nothing
  reads `var(--blue)`. Verified zero references across the whole frontend, then
  removed from both `types.ts` and `index.css`. The drift guard stayed coherent
  because both owners moved together.
- Parent verification: `tsc` 0, **104/104** tests (101 + 3), `build` 0,
  `index.ts` absent, zero `from './index'`, zero palette literals, zero
  `fontSize: \d`, zero raw `'DM Mono'`, zero `blue` residuals.

### WU5 — Close the review's test guard gaps — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`).
- **90 → 101 tests** across 13 → 14 files. Nothing deleted, skipped or weakened.
- Every gap closed with an observed **RED proof**: the guard was broken on
  purpose, the failure recorded, and the file restored byte-identical.
  - Wiring: removing the `./pos/pos.css` import from `POS.tsx` fails only the
    wiring assertion while the `@keyframes`-exist assertions stay green — which
    is exactly the blind spot. A triangulation case with an invented animation
    name also fails.
  - Scale: a `fontSize: 13` literal fails; so does `fontFamily: "'DM Mono'"`; so
    does referencing a token `types.ts` does not declare.
  - Body guard: a double-quoted `font-family` in the `body` rule fails, and the
    **old** guard was replayed against that same break to confirm it would have
    passed — proving the replacement is genuinely stronger.
- Every negative assertion carries a non-vacuity check first, so a broken regex
  cannot read as a passing guard. The `transition:`-vs-`animation:` extraction
  hazard has its own self-test on a synthetic snippet.
- Root resolution moved to `src/__tests__/posTestRoot.ts`: a marker-file walk
  over `vite.config.js` + `package.json`, searching up *and* down from three
  anchors, throwing the list of directories it probed instead of a bare ENOENT.
- **Parent corrected the review's premise.** `R3-test-cwd-root` asserted that
  `import.meta.url` is unusable under jsdom. The worker measured it instead of
  assuming: on Vitest 3.2.7 both `import.meta.dirname` and a `file:` 
  `import.meta.url` resolve correctly and the http behaviour does **not**
  reproduce. The resolver still guards with a `file:` check because it is free,
  but the parent reworded a comment that had stated the disproved claim as fact.
- **Parent could not reproduce the cross-directory GREEN.** Launching vitest from
  the monorepo root fails with `Failed to start forks worker` for **every** test
  file, including pre-existing ones like `api.test.ts` — an environment/pool
  failure unrelated to this change. The project runs its suite from
  `frontend/`, where **101/101 pass**. The resolver's monorepo-root benefit is
  therefore unverified in this environment and is claimed as designed, not proven.

### WU4 — Targets, grid and focus affordances — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`) + one parent correction.
- `SZ.target` (34) now drives the minus, plus and delete controls. The delete hit
  area went from roughly 16px tall to 34, with the glyph from 12 to 16.
- Frequent products: `repeat(2, 1fr)` → `repeat(auto-fill, minmax(200px, 1fr))`.
- `hover-surface` / `hover-card` added to `pos.css` so keyboard focus shows the
  same feedback as hover. `R3-sz-target-dead-token` closed.
- **Parent correction, two parts.** First: the spec I wrote was dead code. Both
  buttons paint their resting background and border as inline styles, and a
  style-attribute declaration outranks any normal author rule, so a plain
  `:focus-visible` rule could never win. The writer added `!important` and flagged
  it correctly — that part is load-bearing and `index.css` already uses the idiom
  for the same reason. Second: the worker had left the `onMouseEnter` /
  `onMouseLeave` handlers in place alongside the new CSS, which would write the
  same state from two owners that must stay in sync or hover flickers. Parent
  removed the four redundant handlers so **CSS is the single owner** of the hover
  and focus states and only the resting values stay inline. The two remaining
  handler pairs in the file are a colour change on delete and a conditional
  background on `Cobrar`; both are out of this work unit's scope.
- Cart-row fit at the 360px minimum was walked through the box model: roughly
  110px is left for the product name (about 130px before), which is still
  positive, so nothing shrinks and nothing overflows. The absorber is the
  already-`flex: 1, minWidth: 0` product column. The gap values were left alone —
  the brief made shrinking them conditional on overflow, and there is none. If
  the name column needs more room, `SZ.cartMin` is the lever, not the targets.
- `C.bg` / `C.accent` / `C.accentBg` were checked against the `index.css`
  custom properties: all three match, and `pos.css` hardcodes no colour that
  `index.css` owns.
- Parent verification: `tsc` 0, **90/90** tests (unchanged, as required),
  `build` 0, `fontSize: \d` still returns 0, and the hover rules survive
  minification in the built CSS.

### WU3 — Self-hosted font delivery — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`), then one parent
  correction.
- Six latin-subset `woff2` files fetched from `fonts.gstatic.com` (public,
  unauthenticated) into `frontend/public/fonts/`, each verified to start with the
  bytes `wOF2` and exceed 1 kB so a truncated download or an error page turns the
  suite red.
- Only the `latin` subset (`U+0000-00FF`) was vendored; it covers Spanish
  (á é í ó ú ñ ü ¿ ¡ ° $). The `latin-ext` blocks were discarded.
- The `preconnect` hints and the Google Fonts `<link>` are gone from `index.html`.
  `FONT.sans` / `FONT.mono` gained in-`var()` fallbacks.
- **Parent correction:** the writer vendored Sora 400/500/600/700 as four files
  and flagged the duplication. Parent verified all four are byte-identical
  (`sha256:811E1196…`, 25284 bytes) — Google serves Sora as a variable font — while
  DM Mono 400/500 differ, proving DM Mono is the static one. Collapsed Sora to one
  `sora-var.woff2` declared over `font-weight: 100 800`.
  **127.9 kB in 6 files → 53.8 kB in 3 files**, 76 kB of exact duplication removed.
- Parent verification: `tsc` 0, **90/90** tests (87 baseline + 3), `build` 0.
  On the built artifact: `dist/fonts` holds the 3 files, `dist/assets/*.css` has 3
  `@font-face` and 3 `/fonts/` references, and **0** matches for `fonts.g`.
- Writer self-reported RED 5 failed / 7 passed before the implementation, then
  GREEN 12/12.

### WU1 — Webfont and animation loading — DONE

- Route: **delegated** (one writer, `gentle-ai-worker`), 6 files touched, so the
  2+ non-trivial-file writer trigger applied.
- RED observed: `npx vitest run src/__tests__/pos-fonts.test.ts` exit 1, 6/6
  failing against the pre-fix tree (no font link, no `pos.css`, `styles.ts` still
  on disk). The writer self-reported an earlier invalid RED caused by resolving
  paths via `import.meta.url` under jsdom, and corrected the harness before
  claiming the valid RED.
- GREEN observed: same command exit 0, 6/6 passing.
- Baseline 78 tests → **84 passing**.
- Parent spot check: re-ran the suite (6/6 green), and confirmed on the built
  artifact that `dist/index.html` carries the font link and the built CSS now
  contains **4** `@keyframes` (it was 0 before the fix).
- `tsc` 0, `lint` 0 (known pre-existing coverage warning), `build` 0.
- Native assessment: **medium**, `executable_change` on `frontend/index.html`;
  `review_due: false`, reason `under_budget`. No native review ran; the candidate
  stays pending in this slice. Reviewed boundary: `main`.
- Commits: `02a899f` (docs), `948c7b3` (fix).
- Running authored changed lines: **287** (132 doc + 155 fix). Remaining slice
  budget to the 400-line delivery boundary: **113**.

### Known environment findings

- The `grep` and `glob` tools are broken in this environment (`Expand-Archive`
  cannot autoload `Microsoft.PowerShell.Archive`). Use `Select-String` via bash.
- `.opencode/` is untracked tooling and must be declared excluded to
  `gentle-ai review assess`, otherwise it returns `unassessable` → `high`.
- `frontend/index.html` references `/src/main.jsx` while the file is `main.tsx`.
  Verified harmless: Vite's resolver handles the extension and `npm run build`
  emits a correct bundle. Explicitly **out of scope**, left untouched.
