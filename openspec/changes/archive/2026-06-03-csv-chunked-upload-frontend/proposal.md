# Proposal: csv-chunked-upload-frontend

## Intent
CSV upload with 15k+ products fails on Vercel Hobby due to 10s serverless timeout. The backend processes each product sequentially inside a single request (30,000 DB queries for 15k products), making it impossible to complete within the timeout. We need to split the upload on the frontend so each HTTP request fits within the timeout.

## Scope

### In Scope
- **Frontend-only**: split parsed CSV data into 250-product chunks, send each as a sequential POST to `/api/productos/bulk`
- **Progress UI**: bar + chunk counter (e.g., "Chunk 12/60") + percentage of total
- **Cancel button**: AbortController to stop mid-upload and show partial results
- **Error handling**: retry a failed chunk once automatically; if it fails again, show an error and let the user decide whether to continue, retry, or abort
- **Final summary**: show total creados, actualizados, errores across all chunks

### Out of Scope
- Backend `/api/productos/bulk` endpoint changes (remains as-is)
- Parallel chunk uploading (would cause race conditions since backend uses findUnique → create/update per row)
- Persistent batch state (surviving browser close)
- Backend timeout configuration (Hobby doesn't allow increasing 10s limit)
- Warm-up requests for cold start mitigation

## Approach
1. Parse CSV with SheetJS as currently done (no changes there)
2. Split the parsed array into chunks of 250 products
3. Create an AbortController + signal, pass to each `fetch` call
4. Send chunks sequentially using `for...of` with `await` (prevents race conditions)
5. On each chunk response, aggregate results (creados + actualizados + errores)
6. Update progress bar / counter state after each chunk
7. On error: retry once; if it fails again, pause and ask user via confirmation dialog
8. On cancel: show partial results aggregated so far
9. Show final summary when complete

### UI State Machine
```
IDLE → UPLOADING (with progress + cancel) → DONE | CANCELLED | ERROR
```

### Chunk Size Rationale
250 products → ~500 DB queries per chunk (findUnique + create/update per product) → estimated 7.5-10s per chunk → within Hobby 10s timeout. This gives a small safety margin for cold starts. For 15k products: ~60 chunks, ~10 minutes total.

## Affected Areas
- `frontend/src/pages/Productos.jsx` — **Modified**: `handleFileUpload` rewritten; new state for progress tracking, cancel, and chunked results
- `frontend/src/lib/api.js` — **Optional**: current `api.post()` doesn't accept AbortSignal. Either add signal support to the wrapper or use raw `fetch` inside `handleFileUpload`

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cold start on first chunk (Neon + Prisma) exceeds 10s | Medium | Accept that first chunk may timeout; user retries and it works on warm start. Could add a warm-up GET before uploading. |
| Browser closed mid-upload → progress lost | Low | Out of scope for now. Acceptable for initial version. |
| User's network drops mid-upload | Medium | Partial results shown on cancel/timeout. User can retry remaining products manually. |
| 250 products × 60 chunks = 60 sequential requests overwhelm browser | Low | Sequential with await — standard pattern, well within browser limits. |

## Chunk Size
**250 products per chunk** (Hobby: 10s timeout, ~7.5-10s per chunk with 500 DB queries)

## Rollback Plan
Revert changes to `frontend/src/pages/Productos.jsx` and `frontend/src/lib/api.js` (if modified). No backend changes to roll back.

## Success Criteria
- [ ] 15,282 products upload successfully in sequential chunks
- [ ] Progress bar shows real-time chunk status (current/total + percentage)
- [ ] Cancel button stops mid-upload and shows partial results
- [ ] Error handling: retry-once + user decision for persistent failures
- [ ] Summary shows total creados / actualizados / errores
- [ ] No changes to backend code
