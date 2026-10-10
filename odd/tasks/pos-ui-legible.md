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

### WU3 — Targets, grid and focus affordances

- Grow the quantity and delete targets to a mouse-comfortable size.
- `auto-fill` grid for frequent products.
- Add `focus-visible` equivalents to the hover-only affordances.

### WU4 — Consolidate the token source of truth

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
- Native assessment and commit: pending.

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
