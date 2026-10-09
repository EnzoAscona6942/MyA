# Delta for stock-management

## ADDED Requirements

### Requirement: Ingreso MUST propagate precioUnitario to Producto.precio

The system MUST update `Producto.precio` with the submitted `precioUnitario` when the value is provided and greater than 0. When `precioUnitario` is null, empty, or 0, `Producto.precio` MUST remain unchanged.

| # | Condition | Behavior |
|---|-----------|----------|
| 1a | `precioUnitario` > 0 | MUST update `Producto.precio` to that value |
| 1b | `precioUnitario` is null/omitted | MUST keep `Producto.precio` unchanged |
| 1c | `precioUnitario` = 0 | MUST keep `Producto.precio` unchanged; MUST store 0 in `IngresoStockItem.precioUnitario` |

#### Scenario: Price provided updates selling price

- GIVEN POST /ingreso with `precioUnitario` = 1500 for a product
- WHEN the transaction completes
- THEN `Producto.precio` for that product SHALL be 1500
- AND `IngresoStockItem.precioUnitario` SHALL be 1500

#### Scenario: Price omitted keeps existing price

- GIVEN POST /ingreso without `precioUnitario` (field absent or null)
- WHEN the transaction completes
- THEN `Producto.precio` SHALL NOT change
- AND `IngresoStockItem.precioUnitario` SHALL be null

#### Scenario: Zero price does not propagate

- GIVEN POST /ingreso with `precioUnitario` = 0
- WHEN the transaction completes
- THEN `Producto.precio` SHALL NOT change
- AND `IngresoStockItem.precioUnitario` SHALL be 0

### Requirement: Ingreso form MUST send null for empty price

When the Ingreso form's price field is left empty by the user, the frontend MUST send `null` as `precioUnitario` in the POST payload (not `0`).

#### Scenario: Empty field submits null

- GIVEN the Ingreso form with an empty price input
- WHEN the user submits the form
- THEN the payload SHALL include `precioUnitario: null`

#### Scenario: Filled field submits the value

- GIVEN the Ingreso form with `precioUnitario` = 2000
- WHEN the user submits the form
- THEN the payload SHALL include `precioUnitario: 2000`

## Non-goals

- `Producto.precioCompra` SHALL NOT be updated by this change
- No retroactive updates to existing `Producto.precio` from historical ingresos
- No schema changes to any table or model
- No price audit trail or price history tracking
