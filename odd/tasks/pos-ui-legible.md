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

### WU2 — Typographic scale and sizing tokens

- Add a type scale and target/spacing tokens to `pages/pos/types.ts`.
- Replace the arbitrary sizes across `render.tsx` and `components.tsx`.
- Switch the POS from the monospace-for-everything default to Sora for text and
  keep DM Mono only for figures (prices, quantities, totals).

### WU3 — Cart panel density and layout

- Responsive cart width instead of the fixed 340px.
- Grow the quantity and delete targets.
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

_(updated as each work unit closes)_
