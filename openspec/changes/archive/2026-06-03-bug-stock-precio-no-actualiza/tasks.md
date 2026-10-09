# Tasks: bug-stock-precio-no-actualiza

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 10–30 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Backend + frontend + tests | PR 1 | Single PR — change is <30 lines |

## Phase 1: Backend Logic

- [ ] 1.1 **Modify** `backend/src/routes/stock.js` — Inside the `for (const item of items)` loop (line 52–57), merge conditional `precio` update into the Prisma `data` object: only add `precio: parseFloat(item.precioUnitario)` when `item.precioUnitario` is truthy and the parsed value is > 0. Keep stock increment unchanged.
- [ ] 1.2 **Verify** existing tests still pass: run `npx jest tests/routes/` from `backend/` — auth, productos, ventas, caja tests must all green.

## Phase 2: Frontend Logic

- [ ] 2.1 **Modify** `frontend/src/pages/Stock.jsx` line 112 — Change `precioUnitario: prod.precio ? prod.precio / 1.5 : 0` to `precioUnitario: ''` (empty string default when adding product).
- [ ] 2.2 **Modify** `frontend/src/pages/Stock.jsx` line 142 — Change `parseFloat(i.precioUnitario) || 0` to `i.precioUnitario ? parseFloat(i.precioUnitario) : null` so empty price sends `null` in the payload.
- [ ] 2.3 **Verify** frontend compiles: run `npm run build` or `npm run dev` (lint + no crash).

## Phase 3: Backend Tests

- [ ] 3.1 **Create** `backend/tests/routes/stock.test.js` — Follow `productos.test.js` / `ventas.test.js` pattern (supertest, `resetMockPrisma`, `generateTestToken`). Mock `$transaction` to provide a `tx` object that includes `ingresoStock` (absent from `setup.js` mocks) and `producto`. Cover 5 scenarios:
  - `precioUnitario > 0` → `producto.update` called with `precio` field
  - `precioUnitario = null` → `producto.update` called WITHOUT `precio` field
  - `precioUnitario = 0` → `producto.update` called WITHOUT `precio` field
  - `precioUnitario = 150.50` (string) → `parseFloat` produces correct decimal update
  - Auth: non-admin gets 403
- [ ] 3.2 **Run** backend tests: `npx jest tests/routes/stock.test.js` from `backend/` — all green.

## Phase 4: Frontend Tests (if applicable)

- [ ] 4.1 **Optionally add** frontend unit test in `frontend/src/__tests__/` for the ingreso payload shape: mock `api.post`, exercise `handleIngresoSubmit`-equivalent logic to verify empty price → `null`, filled price → value. Skip if component architecture makes extraction impractical.
- [ ] 4.2 **Run** frontend tests: `npm test` from `frontend/` — all green.

## Phase 5: End-to-End Verification

- [ ] 5.1 **Manual smoke test**: start backend + frontend, create an ingreso with a filled price, verify `Producto.precio` updated. Create another ingreso with empty price, verify `Producto.precio` unchanged. Confirm `IngresoStockItem.precioUnitario` always stores the submitted value.
