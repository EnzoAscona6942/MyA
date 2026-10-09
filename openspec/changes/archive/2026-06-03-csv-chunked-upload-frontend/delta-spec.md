# Delta Spec: csv-chunked-upload-frontend

## Capability
- **Name**: bulk-product-upload
- **Change**: Frontend chunked upload for CSV files — split a single large POST into sequential 250-product chunks with progress, cancel, and error recovery

## Requirements (Delta)

### R1: Sequential Chunked Upload
- The system MUST split parsed CSV products into chunks of 250 products each
- Each chunk MUST be sent as a sequential `POST` to `/api/productos/bulk` via the existing `api.post()` wrapper or raw `fetch` (with `AbortSignal`)
- The system MUST wait for the previous chunk's response (success or failure) before sending the next chunk
- Aggregated results (`creados`, `actualizados`, `errores`) MUST be accumulated across all chunks in local state

### R2: Progress Indication
- During upload, the system MUST display:
  - Current chunk number / total chunks (e.g., "Lote 12/60")
  - Percentage of total products processed (`(currentChunk / totalChunks) * 100`)
  - A visual progress bar reflecting the percentage
- Progress MUST update reactively after each chunk response is received (not optimistically)

### R3: Cancel
- The user MUST be able to cancel an in-progress upload via a Cancel button visible only during the `UPLOADING` state
- Cancel MUST use an `AbortController` — calling `controller.abort()` on the next pending request so no further chunks are sent
- On cancel, the system MUST display partial aggregated results from the completed chunks (creados, actualizados, errores, chunks completados / total)

### R4: Error Handling — Per-Chunk
- If a chunk's `POST` fails (network error, non-2xx response, or exception), the system MUST retry that chunk ONCE automatically
- If the retry also fails, the system MUST pause the upload and present a dialog to the user with three options:
  - **Reintentar**: retry the same chunk again (manual retry)
  - **Saltar**: discard this chunk's data and continue with the next chunk (the skipped chunk does NOT count as completed)
  - **Cancelar**: abort the entire upload and show partial results
- Results from chunks that succeeded before the failure MUST NOT be lost

### R5: Final Summary
- On successful completion (all chunks processed), the system MUST display a summary showing:
  - Total `creados` across all chunks
  - Total `actualizados` across all chunks
  - Total `errores` across all chunks
  - `Chunks completados / total` (e.g., "60/60 lotes procesados")
- The summary MUST persist on screen until the user dismisses it or starts a new upload

### R6: Edge Cases
- **Small files** (fewer products than chunk size): A single POST request with no visible chunk progress; final summary is shown directly
- **Empty / invalid files**: If `payloadProductos.length === 0` after parsing, the system MUST show an inline error ("No se encontraron productos válidos") and MUST NOT send any network requests
- **Single-request error propagation**: If the backend response includes `errores` (e.g., duplicate codes), those are aggregated into the final count; the upload continues with remaining chunks

### R7: UI States
The upload flow MUST manage these UI states and transitions:

```
IDLE → UPLOADING → DONE | CANCELLED | ERROR
         ↕
      PAUSED (user decision)
```

- **IDLE**: initial state; upload button enabled, no progress UI visible
- **UPLOADING**: progress bar + chunk counter + Cancel button visible; upload button disabled
- **PAUSED**: progress paused at failed chunk; dialog with Reintentar/Saltar/Cancelar
- **DONE**: final summary shown; upload button re-enabled
- **CANCELLED**: partial results shown; upload button re-enabled
- **ERROR**: (non-retriable) error message shown; upload button re-enabled

## Scenarios

### S1: Happy Path — 15,000 products
Given a CSV with 15,000 valid products
When the user selects the file and clicks the upload button
Then ~60 POST requests (`15,000 / 250`) are sent sequentially to `/api/productos/bulk`
And each request processes 250 products
And the progress bar updates after each chunk completes
And the cancel button is visible during the upload
And after all chunks succeed, the final summary shows aggregated creados/actualizados/errores + "60/60 lotes procesados"

### S2: Progress tracking visible
Given an upload in progress at chunk 30/60
Then the UI shows "Lote 30/60" and 50% progress bar
And the Cancel button is clickable
When chunk 31 completes, the progress updates to "Lote 31/60" and ~52%

### S3: Cancel mid-upload
Given an upload in progress at chunk 30/60
When the user clicks Cancel
Then `controller.abort()` is called
And no more POST requests are sent
And the system displays partial results: sum of creados/actualizados/errores from chunks 1–29
And the upload button is re-enabled

### S4: Chunk failure with automatic retry success
Given a POST request for chunk N that fails (e.g., 500 or network timeout)
When the system automatically retries the same chunk
And the retry succeeds
Then the aggregated results are updated with the retry's response
And the upload continues with chunk N+1
And the user never sees an error dialog

### S5: Persistent chunk failure (retry also fails)
Given a chunk that fails (e.g., timeout)
When the automatic retry also fails
Then the upload pauses at chunk N
And a dialog appears with three options: Reintentar, Saltar, Cancelar
When the user selects "Saltar"
Then chunk N is skipped (no results counted)
And the upload resumes with chunk N+1
And the dialog closes

### S6: Small file — under 250 products
Given a CSV with 50 valid products
When the user uploads the file
Then a single POST request is sent with all 50 products
And the progress bar briefly shows "Lote 1/1" and 100%
And the final summary is displayed with the single chunk's results

### S7: Empty file — no valid products
Given a CSV file that has only headers or all rows with missing required columns
When the user uploads it
Then the system shows an inline error: "No se encontraron productos válidos en el archivo. Verifica las columnas (Nombre y Código obligatorios)."
And NO network requests are made to `/api/productos/bulk`
And the upload returns to IDLE state

### S8: Cold start timeouts on first chunk
Given a deployment that is cold (no recent requests, Prisma + Neon need to warm up)
When the first POST request times out (>10s on Vercel Hobby)
Then the auto-retry fires once
If the retry also times out, the system shows the error dialog with Reintentar/Saltar/Cancelar
When the user clicks Reintentar and the instance is now warm
Then the chunk succeeds and the upload continues normally
