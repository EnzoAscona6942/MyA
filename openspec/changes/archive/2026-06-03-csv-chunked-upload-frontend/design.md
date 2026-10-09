# Design: csv-chunked-upload-frontend

## Architecture

### Component Diagram

```
Productos.jsx
│
├── useChunkedUpload({ apiUrl, headers })  ← custom hook
│   ├── state machine (idle → uploading → done|cancelled|error|paused)
│   ├── AbortController + signal
│   └── sequential for-await loop
│
├── File input (hidden) → triggers upload()
├── Progress UI (bar + "Lote X/Y" + %)     ← reads hook.progress
├── Cancel button                           ← calls hook.cancel()
├── Error dialog (native confirm chain)     ← reads hook.error
└── Summary / partial results               ← reads hook.results + hook.state
```

The hook is the single source of truth for upload state, progress, results, and errors.
`Productos.jsx` renders UI based on `hook.state` and delegates all logic to the hook.

### Data Flow

```
1. User selects file → onChange fires
2. SheetJS parses file → array of producto objects
3. validateEmpty(payloadProductos) → if 0, show inline error, return
4. Create AbortController
5. Split array into chunks of 250
6. For each chunk (sequential for-await):
   a. fetch POST /api/productos/bulk with controller.signal
   b. On success: aggregate results (creados + actualizados + errores)
   c. Update progress: currentChunk++, percent = (currentChunk/totalChunks)*100
   d. On failure:
      - Auto-retry ONCE (same chunk, same fetch)
      - If retry succeeds → continue (user never knows)
      - If retry fails → transition to PAUSED, show native confirm chain
7. On cancel (controller.abort()): show partial aggregated results
8. On all chunks done: show final summary
9. Reactively update progress/results in UI via hook state
```

## Hook: `useChunkedUpload`

### Interface

```javascript
useChunkedUpload({ apiUrl, headers }) => {
  // State
  state: 'idle' | 'uploading' | 'paused' | 'done' | 'cancelled' | 'error'
  progress: {
    currentChunk: number,   // 0-based, which chunk is about to be sent
    totalChunks: number,
    processedProducts: number,
    totalProducts: number,
    percent: number         // 0–100
  }
  results: {
    creados: number,
    actualizados: number,
    errores: number,
    chunksCompletados: number,
    totalChunks: number
  }
  error: {
    chunkIndex: number,
    message: string,
    canRetry: boolean
  } | null

  // Actions
  upload(products: Array<Object>): Promise<void>
  cancel(): void
  retryChunk(): void
  skipChunk(): void
  reset(): void
}
```

### Implementation Notes

#### Raw Fetch + AbortController
- The hook uses **raw `fetch()`** directly — NOT the `api.js` wrapper — because `api.post()` doesn't accept AbortSignal.
- Creates an `AbortController` per upload cycle (stored in a ref).
- Passes `signal: controller.signal` to every `fetch()` call.
- Aborting an in-progress `fetch()` throws an `AbortError`. The hook catches this and transitions to `cancelled`.

#### Headers
- `headers` param provides the Authorization token and Content-Type.
- Construction: `{ "Content-Type": "application/json", "Authorization": "Bearer <token>" }`.
- Passed down from `Productos.jsx` using the same `getHeaders()` from `api.js` (or inline equivalent).

#### Sequential for-await Loop
- Chunks are iterated with a standard `for (let i = 0; i < chunks.length; i++)` loop.
- Each iteration `await`s the fetch call. This guarantees chunks execute one-at-a-time.
- After each successful response, aggregated results are updated via `setState(prev => ...)`.
- If a chunk fails: auto-retry flag is set. On second failure, the loop `break`s and state transitions to `paused`.

#### Auto-Retry Logic
- Each chunk has an internal `retryCount` per upload cycle.
- `retryCount` starts at 0. On failure: increment, if `retryCount < 2`, re-fetch the same chunk.
- The retry uses the same fetch URL/body but a **new AbortController signal** (the old one is aborted).
- If retry succeeds, `retryCount` resets for the next chunk, upload continues.

#### Error Object Shape
```javascript
{
  chunkIndex: 3,         // which chunk failed
  message: "Error de red: timeout",  // user-friendly message
  canRetry: true         // always true when PAUSED (user can always retry manually)
}
```

#### State Transitions (see full diagram below)
- `upload()`: can only be called from `idle` or `done` or `cancelled` or `error`.
- `cancel()`: only meaningful in `uploading` or `paused`.
- `retryChunk()`: only from `paused`.
- `skipChunk()`: only from `paused`.
- `reset()`: from any terminal state (`done`, `cancelled`, `error`).

## Productos.jsx Changes

### What Changes

| Aspect | Current | New |
|--------|---------|-----|
| State | `isUploading` (boolean) | `hook.state` + `hook.progress` + `hook.results` + `hook.error` |
| Upload call | `api.post('/productos/bulk', ...)` | `hook.upload(products)` |
| Import | `{ api } from '../lib/api'` | `useChunkedUpload` from new hook |
| Fetch method | `api.post()` wrapper | Raw `fetch()` inside hook |
| Error handling | Single `alert()` | `confirm()` chain for retry/skip/cancel |
| Post-upload | Single `setSuccess()` line | Summary or partial results component |
| Upload button | `disabled={isUploading}` | `disabled={hook.state === 'uploading'}` |
| Cancel button | None | Shown when `hook.state === 'uploading'` |

### New State

```javascript
// Replace:
const [isUploading, setIsUploading] = useState(false);

// With:
const chunkedUpload = useChunkedUpload({ apiUrl: API_URL, headers: getHeaders() });
```

### Error Handling (Native confirm chain)

When `hook.state === 'paused'` and `hook.error` is set:

```
Step 1: confirm("El lote N falló: [mensaje]. ¿Reintentar?")
  - OK → hook.retryChunk()
  - Cancel → Step 2

Step 2: confirm("¿Saltar este lote y continuar con el siguiente?")
  - OK → hook.skipChunk()
  - Cancel → hook.cancel()
```

This restores the three required actions (Reintentar, Saltar, Cancelar) using only native browser dialogs, without adding a custom modal component.

### Progress UI

Rendered when `hook.state === 'uploading'` or `hook.state === 'paused'`:

```
[===========>---------]  52%
Lote 31/60 · 7,750/15,000 productos
```

- Bar: inline `div` with dynamic width based on `hook.progress.percent`
- Text: uses `Intl.NumberFormat` for product count
- Cancel button: visible only during `uploading` state

### Summary Display

Rendered when `hook.state === 'done'`:

```
✓ Carga completada
  1,250 creados · 13,800 actualizados · 232 errores
  60/60 lotes procesados
```

Rendered when `hook.state === 'cancelled'`:

```
⚠ Carga cancelada (resultados parciales)
  1,250 creados · 13,800 actualizados · 232 errores
  29/60 lotes procesados
```

Both are dismissable; dismissed by calling `hook.reset()` or starting a new upload.

## State Machine

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    v                                      │
  ┌──────┐   upload()   ┌──────────┐                      │
  │ IDLE │─────────────>│ UPLOADING│─── cancel() ──────┐  │
  └──────┘              └──────────┘                   │  │
     ▲                   │    │     │                   │  │
     │            all    │    │     │  chunk fails      │  │
     │          chunks   │    │     │  (retry also      │  │
     │           done    │    │     │   fails)          │  │
     │                   v    │     v                   v  │
     │              ┌───────┐│┌─────────┐          ┌───────┐
     │              │ DONE  │││ PAUSED  │          │CANCELLED│
     │              └───────┘│└─────────┘          └───────┘
     │                       │   │  │   │              │
     │                reset()│   │  │   │──── reset() ─┘
     │                       │   │  │                  │
     │                       │   │  └── skipChunk() ───┘
     │                       │   │         (resumes UPLOADING)
     │                       │   │
     │                       │   └── retryChunk() ───────┐
     │                       │          (resumes          │
     │                       │         UPLOADING)         │
     │                       v                            │
     │                  ┌───────┐                         │
     │                  │ ERROR │  (non-retriable, not    │
     │                  └───────┘   used in this design)  │
     │                       │                           │
     └────── reset() ────────┘                           │
                                                          │
              └───────────────────────────────────────────┘
```

### Transition Rules

| From | To | Trigger | Notes |
|------|----|---------|-------|
| `idle` | `uploading` | `upload()` called | Products array non-empty (validated before) |
| `uploading` | `done` | All chunks succeeded | Aggregated results contain full counts |
| `uploading` | `cancelled` | `cancel()` called | `controller.abort()`; partial results shown |
| `uploading` | `paused` | Chunk fails after 2 attempts | Error object set; loop break |
| `paused` | `uploading` | `retryChunk()` or `skipChunk()` | Retry: re-send same chunk. Skip: increment chunk index |
| `done` | `idle` | `reset()` or new upload starts | Clears results/progress |
| `cancelled` | `idle` | `reset()` or new upload starts | Clears results/progress |
| `error` | `idle` | `reset()` or new upload starts | Currently unused; reserved for truly non-recoverable errors |

## Progress Calculation

```javascript
const CHUNK_SIZE = 250;

// On mount / upload() call:
totalChunks   = Math.ceil(products.length / CHUNK_SIZE);
totalProducts = products.length;

// After each successful chunk response:
currentChunk++;  // 1-based for display
processedProducts = Math.min(currentChunk * CHUNK_SIZE, totalProducts);
percent          = Math.round((currentChunk / totalChunks) * 100);
```

- For a single chunk (products.length <= 250): `totalChunks = 1`, `currentChunk` becomes 1 after success, `percent = 100%`.
- The progress bar is **reactive** — updated via `setState` in the `for` loop after each response.
- Progress is NOT optimistic; it only updates after the server responds.

## File Changes

| File | Change |
|------|--------|
| `frontend/src/hooks/useChunkedUpload.js` | **New** — custom hook with state machine, AbortController, sequential loop |
| `frontend/src/pages/Productos.jsx` | **Modified** — replace `isUploading` + single `api.post` with `useChunkedUpload`; add progress bar, cancel button, error dialog, summary |

### No Changes To

- `frontend/src/lib/api.js` — the wrapper stays unchanged; we bypass it with raw fetch
- `backend/` — all changes are frontend-only

## Key Constraints Enforced

1. **No parallel chunks** — `for` loop with `await` guarantees sequential execution, preventing DB race conditions
2. **No persistent state** — all state is in-memory React state; browser refresh resets
3. **No warm-up** — first-chunk cold start mitigated by auto-retry (user retries once and warm instance succeeds)
4. **No `api.js` wrapper** — raw `fetch` with `AbortController.signal` for cancel support
5. **No custom modal** — native `confirm()` chain for error recovery (retry → skip → cancel)
