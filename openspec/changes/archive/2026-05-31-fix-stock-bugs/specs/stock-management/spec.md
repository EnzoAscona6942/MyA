# Delta for stock-management

## ADDED Requirements

### Requirement: Product suggestions MUST extract data payload

The Ingreso form MUST read `res.data`, not the full Axios response, when populating suggestions.

#### Scenario: Suggestions populate on search
- GIVEN the user types a search term in Ingreso
- WHEN the API responds successfully
- THEN suggestions SHALL come from `res.data`
- AND SHALL NOT be empty due to response wrapper passed as data

### Requirement: Caja activa MUST use correct response property

AuthContext MUST assign the response body directly as `cajaActiva`. The response IS the caja object, not nested.

#### Scenario: Caja activa detected on login
- GIVEN a user logs in with an active caja
- WHEN AuthContext processes the response
- THEN `cajaActiva` MUST be the response body
- AND SHALL NOT be undefined from wrong property access

#### Scenario: No active caja
- GIVEN login with no active caja
- WHEN AuthContext processes the response
- THEN `cajaActiva` MAY be null
- AND the app SHALL NOT crash

### Requirement: API responses MUST have format guard before access

`fetchProductos` MUST validate response with `Array.isArray` before calling `.length`.

#### Scenario: Non-array API response
- GIVEN the API returns `{ data: [...] }` (objects) OR a plain array
- WHEN `fetchProductos` processes it
- THEN `Array.isArray` guard prevents crash on `.length`
- AND products SHALL render in either format

### Requirement: Stock route MUST reject NaN inputs

| # | Condition | Behavior |
|---|-----------|----------|
| 4a | `parseInt(productoId)` is NaN | MUST respond 400 |
| 4b | `parseInt(cantidad)` is NaN | MUST respond 400 |
| 4c | `parseInt(costo)` is NaN | MUST respond 400 |
| 4d | All inputs valid | SHALL proceed to Prisma |

#### Scenario: Non-numeric ID sent to ingreso
- GIVEN POST to `/api/stock/ingreso` with non-numeric ID
- WHEN the route validates inputs
- THEN SHALL return 400 before any database call
- AND NaN SHALL NOT reach Prisma

### Requirement: POS MUST use api helper

POS.jsx SHALL use the shared `api` helper, not raw `fetch()`.

#### Scenario: Component fetches data
- GIVEN POS.jsx mounts
- WHEN it makes an HTTP call
- THEN SHALL use `api.get()` or `api.post()`

### Requirement: Raw SQL MUST use valid quoting

Raw SQL in productos.js SHALL avoid double-quoted identifiers that PostgreSQL rejects on case mismatch.

#### Scenario: Column reference executes cleanly
- GIVEN a raw SQL query referencing `stockMinimo`
- WHEN executed against PostgreSQL
- THEN SHALL NOT throw syntax error

### Requirement: Error handler MUST cover TypeError

Stock.jsx SHALL catch network `TypeError` separately from HTTP errors.

#### Scenario: Network unreachable
- GIVEN Stock page is loaded
- WHEN `fetchProductos` throws TypeError
- THEN UI SHALL show a network error message
- AND SHALL NOT crash

### Requirement: useEffect MUST list all dependencies

Stock.jsx `useEffect` SHALL include `fetchProductos` in its dependency array.

#### Scenario: Lint check passes
- GIVEN `fetchProductos` is used in `useEffect`
- WHEN the component renders
- THEN it SHALL be listed as a dependency
- AND react-hooks/exhaustive-deps SHALL not warn

## REMOVED Requirements

| # | Removed Behavior | Reason |
|---|-----------------|--------|
| 1 | `setSugerenciasProd(res)` passes full Axios response | Bug — suggestions always empty |
| 2 | AuthContext destructures `response.caja` instead of response | Bug — `cajaActiva` always null |
| 3 | `productos.length` called without type check | Bug — crashes on paginated API |
| 4 | NaN from parseInt reaches Prisma | Bug — blocks valid requests |
| 5 | POS.jsx uses raw `fetch()` | Inconsistency — misses auth interceptor |
| 6 | Raw SQL uses `"stockMinimo"` double quotes | Bug — PostgreSQL rejects it |
| 7 | Error handler only covers response errors | Gap — TypeError crashes silently |
| 8 | useEffect missing `fetchProductos` dep | Defect — stale closure, lint warning |
