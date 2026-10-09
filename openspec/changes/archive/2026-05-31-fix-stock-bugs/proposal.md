# Proposal: fix-stock-bugs

## Intent

Fix 8 bugs in the stock module and related areas identified during exploration, prioritizing crashes and non-functional features that block core workflows (product search, caja detection, NaN propagation).

## Scope

### In Scope
- Fix product search in Stock ingreso form — `setSugerenciasProd(res)` → `setSugerenciasProd(res.data)`
- Fix caja activa detection in AuthContext — correct response destructuring
- Add format guard in Stock.jsx `fetchProductos` — `Array.isArray` check matching Productos.jsx/Ventas.jsx
- Add NaN validation in backend stock route — reject invalid parseInt results
- Migrate POS.jsx `fetch()` calls to `api` helper for consistency
- Fix raw SQL double-quoted identifier in backend productos route
- Improve error handling in Stock.jsx — cover `TypeError` (network errors)
- Add missing `fetchProductos` dependency in `useEffect`

### Out of Scope
- TypeScript migration
- Comprehensive test suite / E2E tests
- UI redesign or new feature additions
- Refactoring to shared pagination utilities

## Capabilities

No existing specs in `openspec/specs/`. Pure bug fixes — no new capabilities introduced, no spec-level behavior changes.

### New Capabilities
None

### Modified Capabilities
None

## Approach

Fix each bug individually with focused, small commits. Use format guard patterns already established in `Productos.jsx` and `Ventas.jsx` (defensive `Array.isArray` checks). Add backend input validation for NaN before data reaches Prisma. POS.jsx fetch replacement follows the existing `api` helper pattern used everywhere else.

| Severity | Bug | Fix Strategy |
|----------|-----|-------------|
| CRITICAL | Stock search breaks Ingreso | Access `res.data` instead of full response |
| CRITICAL | Caja activa always undefined | Fix destructuring — response IS the caja object |
| HIGH | Stock.jsx crashes on API format change | Add `Array.isArray` guard before `productos.length` |
| HIGH | NaN propagates to Prisma | Validate `parseInt` results, reject NaN with 400 |
| MEDIUM | POS.jsx uses raw fetch | Replace with `api.get`/`api.post` |
| LOW | Raw SQL fragile quotes | Fix double-quoted `stockMinimo` |
| LOW | Generic error handling | Add `TypeError` branch for network errors |
| LOW | Missing useEffect deps | Add `fetchProductos` to dependency array |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/pages/Stock.jsx` | Modified | 4 bugs: search, format guard, error handling, useEffect deps |
| `frontend/src/context/AuthContext.jsx` | Modified | Fix caja activa response destructuring |
| `backend/src/routes/stock.js` | Modified | NaN validation on parseInt inputs |
| `frontend/src/pages/POS.jsx` | Modified | Replace raw fetch with api helper |
| `backend/src/routes/productos.js` | Modified | Fix raw SQL double-quoted identifier |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing edge cases in NaN validation | Low | Reject NaN at route level before Prisma; verify with manual testing on malformed input |
| Regression in POS.jsx fetch → api migration | Low | Keep old `fetch` path temporarily until migration is confirmed working |
| Existing `stockMinimo` data with wrong casing breaks on raw SQL fix | Low | If raw SQL worked before despite the quoting issue, the fix is purely cosmetic — no data impact |

## Rollback Plan

Revert the single PR commit with `git revert <hash>`. All fixes are small and isolated — no schema migrations, no config changes, no data transformations. A clean revert restores original behavior.

## Dependencies

None

## Success Criteria

- [ ] Stock Ingreso form shows product suggestions on input
- [ ] Caja activa detected correctly in AuthContext (no longer always `null`)
- [ ] Stock.jsx handles paginated or non-paginated API responses without crash
- [ ] Backend rejects NaN quantity/cost values with 400 in stock ingreso
- [ ] POS.jsx uses `api` helper consistently (no direct `fetch()`)
- [ ] Raw SQL in productos.js uses valid identifier quoting
- [ ] Error handling in Stock.jsx covers network `TypeError` gracefully
- [ ] React hooks in Stock.jsx have complete dependency arrays (no lint warnings)
