# Design: fix-stock-bugs

## Technical Approach

Eight targeted one-liner or small-block fixes across 5 files. No schema changes, no new dependencies, no new features. Each fix follows an existing pattern already established in the codebase — either the `Array.isArray` guard from Productos.jsx/Ventas.jsx, or the `api` helper pattern from `lib/api.js`.

## Architecture Decisions

### Decision: Use established format-guard pattern from Productos.jsx

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Create shared utility for API response parsing | Overengineered for 3 call sites; Stock.jsx is the last holdout | Adopt inline `Array.isArray` guard matching Productos.jsx:108-115 & Ventas.jsx:62-68 |
| Skip guard, assume API always returns paginated format | Fragile; a change in API pagination strategy would crash Stock.jsx | Guard is defensive and costs ~5 LOC |

### Decision: Migrate POS fetch to api helper

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep raw fetch calls | Code smell; inconsistent error handling (no auto-JSON-throw) | Replace with `api.get`/`api.post` — the helper already handles JSON parsing, error throwing, and auth headers |
| Remove old `API_URL`/`getHeaders` imports | Cleaner imports but more changes | Keep imports temporarily to avoid cascading changes in unused imports scope |

### Decision: Validate NaN at route level, not middleware

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Global NaN middleware | Overkill for one route | Inline `isNaN()` checks in `stock.js` POST handler before Prisma calls |
| Rely on Prisma validation | Prisma throws 500 on NaN, not 400 | Return 400 `{ error: 'Cantidad inválida' }` early — better UX and no crash |

## Data Flow

```
┌─ Bugs 1,3,8 (Stock.jsx) ──────────────────────┐
│                                                 │
│  api.get('/productos?...')  ──→  res.data       │
│  (returns {data[], pagination})  └── Array.isArray guard
│                                      └── setProductos()
│
│  api.get('/productos?busqueda=...') ──→ res.data
│    (was res — full obj)       └── setSugerenciasProd()
│
│  useEffect deps: add fetchProductos
│
└─────────────────────────────────────────────────┘

┌─ Bug 2 (AuthContext.jsx) ──────────────────────┐
│  api.get('/caja/activa')  ──→  caja (direct)   │
│    (was {caja} — destructuring from non-existent│
│     property → always undefined)               │
└─────────────────────────────────────────────────┘

┌─ Bug 4 (stock.js) ─────────────────────────────┐
│  req.body.items[]                              │
│    └─ parseInt(cantidad) ──→ isNaN? → 400      │
│    └─ parseFloat(precioUnitario) ──→ isNaN?→400│
│    └─ parseInt(productoId) ──→ isNaN? → 400    │
│    ✓ All valid → Prisma transaction            │
└─────────────────────────────────────────────────┘

┌─ Bug 5 (POS.jsx) ──────────────────────────────┐
│  Raw: fetch(`${API_URL}/...`, {headers})        │
│  Fixed: api.get/post(...)                       │
│  (same endpoint, same payload shape)            │
└─────────────────────────────────────────────────┘

┌─ Bug 6 (productos.js) ─────────────────────────┐
│  $queryRaw: fix double-quoted identifier to     │
│  match the pattern in `stock-bajo` query (L102) │
└─────────────────────────────────────────────────┘

┌─ Bug 7 (Stock.jsx:148) ────────────────────────┐
│  catch(e)                                       │
│    ├─ TypeError (network) → "Error de red"      │
│    └─ Server error → e.error || generic         │
└─────────────────────────────────────────────────┘
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/pages/Stock.jsx` | Modify | **Bug 1**: `res` → `res.data` on line 91. **Bug 3**: Add `Array.isArray` guard in `fetchProductos` matching Productos.jsx pattern. **Bug 7**: Add `TypeError` branch in error handler. **Bug 8**: Add `fetchProductos` to useEffect deps |
| `frontend/src/context/AuthContext.jsx` | Modify | **Bug 2**: Remove destructuring `{ caja }` → `const caja` — response IS the caja object |
| `backend/src/routes/stock.js` | Modify | **Bug 4**: Add `isNaN()` validation on `parseInt(productoId)`, `parseInt(cantidad)`, `parseFloat(precioUnitario)`. Return 400 on invalid values |
| `frontend/src/pages/POS.jsx` | Modify | **Bug 5**: Replace 4 raw `fetch()` calls with `api.get`/`api.post`. Import `api` from `../lib/api` |
| `backend/src/routes/productos.js` | Modify | **Bug 6**: Fix double-quoted identifier `"stockMinimo"` in `$queryRaw` (line 39) to match established pattern from line 102 |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | All 8 bugs | Verify each scenario from the proposal's success criteria. No automated tests added per proposal scope |

Testing steps per bug:
1. Type 2+ chars in Stock ingreso search → suggestions appear
2. Login → cajaActiva is non-null if an active caja exists
3. Stock listado handles both paginated and array responses
4. POST `/stock/ingreso` with invalid quantity → 400, not 500
5. POS product search, barcode scan, and venta creation all work via `api` helper
6. Productos stock-bajo filter returns correct results
7. Network disconnect during ingreso → "Error de red" message
8. No React lint warnings for exhaustive-deps

## Migration / Rollout

No migration required. Each fix is idempotent and scoped to one file. Rollback: `git revert` the single commit.

## Open Questions

None. All fixes are well-understood with clear before/after states confirmed by reading the actual codebase.
