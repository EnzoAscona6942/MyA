# Tasks: csv-chunked-upload-frontend

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280–350 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: Create useChunkedUpload hook

- [x] 1.1 Create `frontend/src/hooks/useChunkedUpload.js` — 6-state machine (`idle`/`uploading`/`paused`/`done`/`cancelled`/`error`), progress/results/error state shape, exported interface
- [x] 1.2 Implement `upload(products)`: validate empty → abort early; create `AbortController`; split into `CHUNK_SIZE=250` chunks; compute `totalChunks`/`totalProducts`
- [x] 1.3 Implement sequential for-await loop: raw `fetch(POST /api/productos/bulk)` per chunk with `AbortSignal`, aggregate results, update progress reactively
- [x] 1.4 Implement auto-retry: on fetch failure, retry same chunk once; if retry also fails, set error and transition to `paused`
- [x] 1.5 Implement `cancel()` (calls `controller.abort()`, catches `AbortError` → `cancelled`) + `retryChunk()`/`skipChunk()`/`reset()` with state guards

## Phase 2: Integrate into Productos.jsx

- [x] 2.1 Replace `isUploading` + `api.post()` with `useChunkedUpload({ apiUrl, headers })` hook and `hook.upload(products)`
- [x] 2.2 Add progress bar + chunk counter (`Lote X/Y · N productos`) when `hook.state === 'uploading'`
- [x] 2.3 Add Cancel button visible only during `uploading`, calls `hook.cancel()`
- [x] 2.4 Add native `confirm()` chain on `paused`: retry → skip → cancel, wired to `hook.retryChunk()`/`hook.skipChunk()`/`hook.cancel()`
- [x] 2.5 Add summary display for `done` (success counts + chunks) and `cancelled` (partial results); update upload button disabled logic

## Phase 3: Verification

- [x] 3.1 Test small file (<250 products) — single chunk, verify summary without chunk progress UI
- [x] 3.2 Test large file (mock ≥250 products) — multiple chunks, progress bar updates, final summary correct
- [x] 3.3 Test cancel mid-upload — verify `AbortController.abort()`, partial results shown, re-enabled upload
- [x] 3.4 Test network failure — verify auto-retry succeeds silently; verify double-failure → confirm dialog → skip/cancel works
