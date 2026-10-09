# Design: bug-stock-precio-no-actualiza

## Technical Approach

Three coordinated changes to propagate `precioUnitario` from ingreso form to `Producto.precio`:
1. **Backend**: Inside the Prisma transaction, add a conditional `precio` update to the product when `precioUnitario > 0`
2. **Frontend**: Remove the auto-calculate `prod.precio / 1.5` pre-fill, default to empty string
3. **Frontend payload**: Send `null` (not `0`) when price field is empty so the backend correctly detects "no price provided"

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Update location | Inside the existing `$transaction` loop, alongside stock increment | Separate query after transaction | Keeps atomicity — stock + price update succeed or fail together |
| Condition check | `pu !== null && pu > 0` on the parsed float | Separate flag in payload | Self-contained; re-uses existing parsing, no contract changes |
| Empty price sent as | `null` from frontend | Omitting the field | Explicit is safer — backend can distinguish "not sent" from "set to 0" |

## Data Flow

```
Frontend form
  │
  │  addProductoToIngreso(prod):
  │    precioUnitario: ''        ← WAS: prod.precio / 1.5
  │
  │  handleIngresoSubmit():
  │    items.map(i => ({
  │      precioUnitario: validFloat(i.precioUnitario) ?? null   ← WAS: parseFloat || 0
  │    }))
  │
  ▼
POST /api/stock/ingreso  { items: [{ productoId, cantidad, precioUnitario }], ... }
  │
  ▼
Backend validation (lines 16-23)
  │  parseFloat per item, defaults null → 0 for validation
  │
  ▼
Prisma $transaction
  │
  ├── tx.ingresoStock.create  (stores precioUnitario per item)
  │
  └── for each item:
        ├── tx.producto.update({ stock: { increment: cant } })
        └── tx.producto.update({ precio: pu })   ← NEW: only if pu > 0
```

Both updates hit the same `producto.update` call — we merge into a single `data` object per item.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/src/routes/stock.js` | Modify | Add conditional `precio` update inside the transaction loop (lines 52-56) |
| `frontend/src/pages/Stock.jsx` | Modify | Line 112: remove `/ 1.5` auto-fill. Line 142: send `null` instead of `0` for empty prices |
| `backend/tests/routes/stock.test.js` | Create | New test file following `productos.test.js` pattern (supertest + mocked Prisma) |

## Interfaces / Contracts

No API contract changes — the `precioUnitario` field already exists in both request and response. The behavioral change is internal:

- **Old**: `precioUnitario` was stored in `IngresoStockItem` but never propagated to `Producto.precio`
- **New**: `precioUnitario` is propagated to `Producto.precio` when `> 0`; skipped when `null`, `0`, or negative

## Backend Change Detail (`stock.js`)

Current loop (lines 52-56):
```javascript
for (const item of items) {
  await tx.producto.update({
    where: { id: parseInt(item.productoId) },
    data: { stock: { increment: parseInt(item.cantidad) } }
  })
}
```

Replace with:
```javascript
for (const item of items) {
  const pu = item.precioUnitario ? parseFloat(item.precioUnitario) : null
  const updateData = { stock: { increment: parseInt(item.cantidad) } }

  if (pu !== null && pu > 0) {
    updateData.precio = pu
  }

  await tx.producto.update({
    where: { id: parseInt(item.productoId) },
    data: updateData
  })
}
```

## Frontend Change Detail (`Stock.jsx`)

**Line 112** — remove auto-calculate:
```javascript
// OLD:
precioUnitario: prod.precio ? prod.precio / 1.5 : 0

// NEW:
precioUnitario: ''
```

**Line 142** — send `null` instead of `0`:
```javascript
// OLD:
precioUnitario: parseFloat(i.precioUnitario) || 0

// NEW:
precioUnitario: i.precioUnitario ? parseFloat(i.precioUnitario) : null
```

The `<input>` field (line 377) already uses `value={it.precioUnitario}` with `type="number"` and `step="0.01"` — no change needed there. The empty string will render as an empty input.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Backend — Unit | `POST /api/stock/ingreso` with `precioUnitario > 0` | Mock Prisma, assert `producto.update` called with `precio` field |
| Backend — Unit | `POST /api/stock/ingreso` with `precioUnitario = null` | Mock Prisma, assert `producto.update` called WITHOUT `precio` field |
| Backend — Unit | `POST /api/stock/ingreso` with `precioUnitario = 0` | Same as null — price not updated |
| Backend — Unit | `POST /api/stock/ingreso` with mixed items (some with price, some without) | Each item's update is independent |
| Backend — Unit | Auth — non-admin gets 403 | Existing pattern from `productos.test.js` |
| Frontend — Unit | `addProductoToIngreso` sets `precioUnitario` to `''` | Check state after calling the function |
| Frontend — Unit | `handleIngresoSubmit` payload sends `null` for empty price | Mock `api.post`, inspect `items[0].precioUnitario` |

New backend test file: `backend/tests/routes/stock.test.js` — follows the same pattern as `productos.test.js`:
- Import `supertest`, `mockPrisma` utils, `generateTestToken`
- `beforeEach` resets mocks and generates tokens
- Tests use `mockPrismaSuccess`/`mockPrismaError` to control Prisma behavior
- Note: `$transaction` currently passes the mock `prisma` instance as the `tx` argument — the loop inside the route calls `tx.producto.update`, which maps to `mockPrisma.producto.update`

## Edge Cases

| Case | Expected Behavior |
|------|------------------|
| `precioUnitario = 0` | Skipped — `Producto.precio` unchanged |
| `precioUnitario = null` | Skipped — `Producto.precio` unchanged |
| `precioUnitario = undefined` | Skipped — `item.precioUnitario` is falsy, `parseFloat` never called |
| `precioUnitario = ""` (empty string from frontend) | Falsy → `null` sent in payload → skipped on backend |
| Multiple items, mixed prices | Each iteration is independent; items with `pu > 0` get updated, others don't |
| `precioUnitario` sent as string (e.g., `"150.50"`) | `parseFloat` parses it correctly on both ends |
| `precioUnitario = -5` | Negative — condition `pu > 0` is false, skipped (intentional: no negative prices) |

## Open Questions

- None. The change is minimal and self-contained.
