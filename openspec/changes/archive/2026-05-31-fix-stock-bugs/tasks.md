# Tasks: fix-stock-bugs

## Review Workload Forecast

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

| Field | Value |
|-------|-------|
| Estimated changed lines | 20–50 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

## Phase 1: Backend Fixes (independent)

- [x] 1.1 `backend/src/routes/stock.js` — Add `isNaN()` validation on `parseInt(productoId)`, `parseInt(cantidad)`, `parseFloat(precioUnitario)`; return 400 before Prisma
- [x] 1.2 `backend/src/routes/productos.js` — Fix double-quoted `"stockMinimo"` identifier in raw SQL (line 39) to match established pattern from line 102

## Phase 2: Frontend Foundation (AuthContext + POS)

- [x] 2.1 `frontend/src/context/AuthContext.jsx` — Change `const { caja } = response` to `const caja = response` (response IS the caja object)
- [x] 2.2 `frontend/src/pages/POS.jsx` — Import `api` from `../lib/api`; replace 4 raw `fetch()` calls with `api.get`/`api.post`; keep old imports to minimize diff

## Phase 3: Stock.jsx Fixes (same file, apply together)

- [x] 3.1 **Bug 1** — `fetchProductos` suggestions: change `setSugerenciasProd(res)` → `setSugerenciasProd(res.data)`
- [x] 3.2 **Bug 3** — Add `Array.isArray` guard before `productos.length` in `fetchProductos` (match Productos.jsx:108-115 pattern)
- [x] 3.3 **Bug 7** — Add `TypeError` branch in error handler for network errors; show "Error de red" message
- [x] 3.4 **Bug 8** — Add `fetchProductos` to `useEffect` dependency array (fix react-hooks/exhaustive-deps warning)

## Phase 4: Verification

- [ ] 4.1 Manual: Type 2+ chars in Stock Ingreso search → suggestions appear
- [ ] 4.2 Manual: Login with active caja → `cajaActiva` is non-null
- [ ] 4.3 Manual: Stock listado handles both paginated and array responses without crash
- [ ] 4.4 Manual: POST `/api/stock/ingreso` with invalid quantity → 400, not 500
- [ ] 4.5 Manual: POS product search, barcode scan, venta creation work via api helper
- [ ] 4.6 Manual: Stock-bajo filter returns correct results
- [ ] 4.7 Manual: Network disconnect during Ingreso → "Error de red" message
- [ ] 4.8 Manual: No React lint warnings for exhaustive-deps
