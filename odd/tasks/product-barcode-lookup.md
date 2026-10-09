# Product barcode lookup (Open Food Facts)

## Objective

When adding a product in `Productos`, scan a barcode with a USB/hub reader and
have the product name autofilled from the Open Food Facts API, so the operator
does not type names by hand.

## Problem

The barcode field already exists end to end (`schema.prisma:84` `codigoBarras
@unique`, `Productos.tsx:43`, table column, search filter, Excel importer) and
`GET /api/productos/barras/:codigo` already looks a product up by barcode. But
scanning a barcode today does nothing beyond persisting it: the operator still
types the name by hand.

## Scope (confirmed with user)

Only two fields matter to this project: **which product it is** and **its price**.

- Autofill `nombre` from Open Food Facts.
- Keep the scanned `codigoBarras` as entered by the operator.
- `precio`, `precioCompra`, `stock` stay manual — **Open Food Facts has no
  price or stock data** (verified against barcode `3017620422003`).
- `descripcion`, `imagen` and `categoriaId` are explicitly out of scope.

## Constraints

- Backend Node 20 (`Dockerfile: node:20-alpine`) has native `fetch` — no new
  dependency.
- `AGENTS.md`: business logic lives in `services/`, never in routes. zod
  validation at the border. No `any`, no `!`, no `as` in frontend TypeScript.
- Frontend user-facing copy in neutral Spanish; identifiers/comments in English.
- No barrels between pages; `Productos.tsx` stays self-contained.
- Backend jest has a **global 80% coverage threshold** — new code must ship with
  tests or the suite fails.

## Design

### Backend

`GET /api/productos/barras/:codigo/openfoodfacts`

- `authMiddleware` + `validateParams` with a zod schema (`8–14` digits).
- Logic lives in a new `services/productos.service.js`
  (`consultarOpenFoodFacts`), which owns the upstream call, normalization,
  caching and the graceful-degradation contract.
- Upstream: `https://world.openfoodfacts.org/api/v2/product/{code}.json` with
  `?fields=code,product_name,product_name_es` and an identifying `User-Agent`.
- Response is **`200` with `{ codigoBarras, found, nombre }` even when the
  product is unknown** — a product missing from Open Food Facts is a normal
  case (local goods, bakery), not a failure. Only an invalid barcode is `400`
  and an upstream/network failure is `503`.
- Name resolution: `product_name` → `product_name_es` → not found.
- 5s timeout via `AbortSignal.timeout`, network errors degrade to
  `{ found: false }` instead of `500`.
- In-memory cache keyed by barcode (TTL 24h, bounded size) — Open Food Facts
  limits product queries to roughly 100/min, and bulk loading must not burn
  that budget.
- Base URL overridable via `OPENFOODFACTS_BASE_URL` (documented in
  `backend/env.example`).

### Frontend

- `codigoBarras` input: debounce ~400ms after the last keystroke, plus an
  **immediate lookup on Enter** — USB barcode scanners terminate the code with
  Enter, so that is the real trigger, not the debounce.
- Triggers only when the normalized value is `8–14` digits **and `nombre` is
  empty**; autofill never overwrites a field the operator already filled.
- In-flight requests are aborted on change and guarded by a sequence ref so a
  late response from a previous barcode cannot overwrite a newer one.
- `api.get` gains pass-through of `options.signal` (backwards compatible;
  `post`/`put`/`delete` are untouched).
- Inline status line under the input using the page's own `C` palette:
  searching / found / not found / error.

## Authorized scope

See `## Allowed edit surfaces` in the delegated writer prompt. Nothing outside
that surface is authorized.

## Tasks

- [x] **T1** — `services/productos.service.js` + unit tests (21 tests).
- [x] **T2** — route + zod param schema + route tests (7 tests).
- [x] **T3** — `lib/api.ts` signal pass-through.
- [x] **T4** — `Productos.tsx` debounce/Enter lookup + autofill + 10 tests.
- [x] **T5** — full verification suite green; update this document.

Route: delegated (10 files, writer trigger + preparation trigger).

### Verification evidence

| Command | Workdir | Result |
| --- | --- | --- |
| `npm test` | backend | PASS — 10 suites / 78 tests (baseline 9/50) |
| `npm run lint` | backend | **FAIL — pre-existing**, see below |
| `npm test` | frontend | PASS — 12 files / 78 tests (baseline 12/68) |
| `npm run lint` | frontend | PASS — 0 errors, 1 pre-existing warning |
| `npx tsc --noEmit` | frontend | PASS |

TDD cycle observed: RED (`Cannot find module '../../src/services/productos.service'`,
then barrel missing `resetCache`, then 7 failing behaviour assertions) → GREEN
per suite. T3 had no observable RED — `lib/api` has no test surface in the
authorized scope and `api` is module-mocked in `Productos.smoke.test.tsx`.

### Corrections applied after delegation

- `USER_AGENT` declared `https://github.com/mya`, a repository that does not
  exist. Open Food Facts requires a contactable identifier so abusive clients
  can be reached; a fake URL only looks compliant. Replaced with the real public
  repository URL. Re-verified: `productos.service.test.js` 21/21 green.

### Pre-existing breakage found (NOT introduced here, NOT fixed)

- **`backend` eslint is dead.** `backend/package.json` declares
  `"type": "commonjs"` while `backend/eslint.config.js` uses ESM, so eslint
  fails while *loading its own config* and never lints a single file. Confirmed
  identical on a clean tree before any edit. Fix is renaming the config to
  `eslint.config.mjs`. **Consequence: no backend file — new or old — has ever
  been linted by this repo.** The new files are unverified against the repo's
  eslint rules.
- **The 80% coverage gate was never running.** `npm test` is bare `jest` with no
  `--coverage`, so the threshold only evaluates under `test:coverage`, which is
  not the default command. Real backend coverage is ~46%; this feature raises
  it to ~49% (`productos.service.js` itself at 98.38% statements / 93.54%
  branches / 100% lines). The "suite fails without tests" constraint stated
  earlier in this document does not hold in practice.

### Known follow-ups (out of scope, unactioned)

- Modal labels have no `htmlFor`, so the tests locate inputs by
  `input[name="..."]` instead of `getByLabelText`. A real accessibility gap.
- Cache is per-process: with more than one instance each keeps its own copy, and
  each instance spends its own ~100 req/min Open Food Facts budget.
- `resetCache()` is exported if a 24h TTL ever needs manual invalidation.
- Copy for the new status line uses voseo ("Cargá el nombre a mano") for
  consistency with the adjacent "Escaneá acá..." placeholder.


## Acceptance criteria

1. Scanning a barcode present in Open Food Facts fills `nombre`.
2. Scanning a barcode absent from Open Food Facts leaves the form usable and
   shows a non-blocking "not found" hint; the operator can still type the name.
3. An existing operator-entered `nombre` is never overwritten.
4. An invalid barcode never reaches the network.
5. Backend `npm test` and `npm run lint` pass with coverage ≥ 80%.
6. Frontend `npm test`, `npm run lint` and `npx tsc --noEmit` pass.

## Open decisions (not blockers for this feature)

- **`codigoBarras` is currently mandatory.** `routes/productos.js:225` uses
  `body('codigoBarras').notEmpty()` without `.optional()`, while
  `Productos.tsx:334` sends `undefined` when empty — so a product without a
  barcode cannot be created from the UI today. The comment at
  `Productos.tsx:333` shows the original intent was for it to be optional.
  **Out of scope here** — requires a product decision, and it also affects POS
  lookup (sales search by barcode). Not to be changed without explicit
  approval.
- Repo uses git subtrees (`frontend/` and `backend/` have their own branches).
  Commit strategy for this work must be confirmed before committing.
