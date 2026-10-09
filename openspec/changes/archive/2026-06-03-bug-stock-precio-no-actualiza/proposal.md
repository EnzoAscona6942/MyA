# Proposal: bug-stock-precio-no-actualiza

## Intent
Propagate `precioUnitario` from `IngresoStockItem` to `Producto.precio` when a new price is provided in the ingreso form, keeping the existing product price unchanged when omitted.

## Scope

### In Scope
- Backend: conditional `Producto.precio` update in POST `/ingreso` transaction when `precioUnitario` is truthy and > 0
- Frontend: send `null` (not `0`) when price field is empty so backend can distinguish "not provided" from "explicitly zero"
- Delta spec: add price propagation requirement to `stock-management` spec

### Out of Scope
- `precioCompra` propagation (see Open Questions)
- Retroactive price updates on existing `IngresoStockItem` records
- Price audit trail or history tracking
- UI restructuring or new form fields

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `stock-management`: Ingreso MUST propagate `precioUnitario` to `Producto.precio` when a non-empty, non-zero price is provided

## Open Questions
1. **`precioCompra` update?** — `precioUnitario` is semantically the unit cost from the supplier. Should it also update `Producto.precioCompra`? Both fields were mentioned in the bug description. Decision needed: update only `precio`, only `precioCompra`, or both?
2. **Field naming clarity** — The frontend pre-fills `precioUnitario` as `prod.precio / 1.5` (derived from selling price). Is this field intended as the *selling* price or the *cost* price? If both are needed, separate fields may be required.

## Approach
**Backend** (`stock.js`, lines 52-57): Extend the Prisma `producto.update` inside the transaction loop. If `precioUnitario` is truthy and > 0, add `precio: parseFloat(item.precioUnitario)` to the update data. The existing `stock: { increment }` stays unchanged.

```js
// Conceptual diff
const updateData = { stock: { increment: cantidad } };
if (item.precioUnitario && parseFloat(item.precioUnitario) > 0) {
  updateData.precio = parseFloat(item.precioUnitario);
}
await tx.producto.update({ where: { id }, data: updateData });
```

**Frontend** (`Stock.jsx`, line 142): Change `parseFloat(i.precioUnitario) || 0` to return `null` when the field is empty/invalid, so the backend sees `null` instead of `0`.

## Affected Areas
| Area | Impact | Description |
|------|--------|-------------|
| `backend/src/routes/stock.js` | Modified | Conditional `precio` update in ingreso tx loop |
| `frontend/src/pages/Stock.jsx` | Modified | Send `null` for empty price field |
| `openspec/specs/stock-management/spec.md` | Modified | Add delta requirement for price propagation |

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `precioUnitario=0` conflates "skipped" with "free product" | Low | Backend only propagates when value > 0; IngresoStockItem stores 0 correctly regardless |
| Stale frontend bundle in browser cache sends old format | Low | Standard cache-busting on deploy; no state migration needed |

## Rollback Plan
Revert the single commit. No schema migrations, no data transformations — pure logic changes. A clean `git revert` restores original behavior.

## Dependencies
None

## Success Criteria
- [ ] POST /ingreso with `precioUnitario` > 0 updates `Producto.precio` for that item
- [ ] POST /ingreso without `precioUnitario` (null/empty/0) leaves `Producto.precio` unchanged
- [ ] IngresoStockItem always records the submitted `precioUnitario` regardless of propagation
- [ ] Existing ingreso flow continues working when price is omitted
