import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChunkedUpload } from '../hooks/useChunkedUpload';

const API_URL = 'http://test.com/api';
const HEADERS = { 'Content-Type': 'application/json' };

function createProducts(count) {
  return Array.from({ length: count }, (_, i) => ({
    nombre: `Product ${i}`,
    codigoBarras: `COD${String(i).padStart(5, '0')}`
  }));
}

/**
 * Creates a signal-aware fetch mock that can hang on specific calls
 * and properly rejects when AbortController.signal is aborted.
 */
function createFetchMock(responses) {
  let callCount = 0;
  const hangingResolvers = [];
  return {
    mock: vi.fn().mockImplementation(async (_url, opts) => {
      const idx = callCount++;
      const { signal } = opts || {};

      if (responses[idx] === 'HANG') {
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          const onAbort = () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      }

      if (typeof responses[idx] === 'function') {
        return responses[idx]({ idx, signal });
      }

      if (responses[idx] && responses[idx].error) {
        throw responses[idx].error;
      }

      if (responses[idx] && responses[idx].status === 'reject') {
        throw responses[idx].error || new Error('Request failed');
      }

      return {
        ok: responses[idx]?.ok !== false,
        json: () => {
          const val = responses[idx]?.json
            ? Promise.resolve(responses[idx].json)
            : Promise.resolve(responses[idx]);
          return val;
        },
        text: () => Promise.resolve(responses[idx]?.errorText || '')
      };
    }),
    getCallCount: () => callCount
  };
}

describe('useChunkedUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Task 1.1: State Machine & Interface ──
  describe('Task 1.1: State machine and interface', () => {
    it('should initialize with idle state and default values', () => {
      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      expect(result.current.state).toBe('idle');
      expect(result.current.progress).toEqual({
        currentChunk: 0,
        totalChunks: 0,
        processedProducts: 0,
        totalProducts: 0,
        percent: 0
      });
      expect(result.current.results).toEqual({
        creados: 0,
        actualizados: 0,
        errores: 0,
        chunksCompletados: 0,
        totalChunks: 0
      });
      expect(result.current.error).toBeNull();
      expect(typeof result.current.upload).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
      expect(typeof result.current.retryChunk).toBe('function');
      expect(typeof result.current.skipChunk).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should transition from idle to uploading to done on successful single-chunk upload', async () => {
      const { mock } = createFetchMock([
        { creados: 5, actualizados: 10, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(1));
      });

      expect(result.current.state).toBe('done');
    });
  });

  // ── Task 1.2: Chunking Logic ──
  describe('Task 1.2: Chunking logic (CHUNK_SIZE=250)', () => {
    it('should send a single request for <250 products', async () => {
      const { mock } = createFetchMock([
        { creados: 50, actualizados: 0, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(50));
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result.current.results.creados).toBe(50);
    });

    it('should send 2 requests for 500 products', async () => {
      const { mock } = createFetchMock([
        { creados: 250, actualizados: 0, errores: 0 },
        { creados: 250, actualizados: 0, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(500));
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.results.chunksCompletados).toBe(2);
      expect(result.current.results.creados).toBe(500);
    });

    it('should send 3 requests for 501 products (250+250+1)', async () => {
      const bodyArr = [];
      const { mock } = createFetchMock([
        {
          json: { creados: 250, actualizados: 0, errores: 0 },
          // We use a function through the response object approach
        },
        {
          json: { creados: 250, actualizados: 0, errores: 0 }
        },
        {
          json: { creados: 1, actualizados: 0, errores: 0 }
        }
      ]);
      global.fetch = mock;

      // Override mock to capture bodies
      global.fetch.mockImplementation(async (url, opts) => {
        const body = JSON.parse(opts.body);
        bodyArr.push(body.productos);
        const length = body.productos.length;
        return {
          ok: true,
          json: () => Promise.resolve({ creados: length, actualizados: 0, errores: 0 })
        };
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(501));
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(bodyArr[0]).toHaveLength(250);
      expect(bodyArr[1]).toHaveLength(250);
      expect(bodyArr[2]).toHaveLength(1);
      expect(bodyArr[0][0].nombre).toBe('Product 0');
      expect(bodyArr[2][0].nombre).toBe('Product 500');
      expect(result.current.results.creados).toBe(501);
      expect(result.current.results.chunksCompletados).toBe(3);
    });
  });

  // ── Task 1.3: Auto-Retry Logic ──
  describe('Task 1.3: Auto-retry logic', () => {
    it('should retry once on failure and continue if retry succeeds', async () => {
      let attemptCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          json: () => Promise.resolve({ creados: 100, actualizados: 0, errores: 0 })
        };
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(100));
      });

      // First call failed, second succeeded → 2 fetch calls total
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.state).toBe('done');
      expect(result.current.results.creados).toBe(100);
    });

    it('should pause upload after double failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(100));
      });

      expect(result.current.state).toBe('paused');
      expect(result.current.error).not.toBeNull();
      expect(result.current.error.chunkIndex).toBe(0);
      expect(result.current.error.canRetry).toBe(true);
    });

    it('should only affect the failing chunk on double failure (later chunks not sent)', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout'));

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(500));
      });

      // Chunk 0 failed twice → paused after 2 calls
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result.current.state).toBe('paused');
    });
  });

  // ── Task 1.4: Cancel via AbortController ──
  describe('Task 1.4: Cancel via AbortController', () => {
    it('should cancel mid-upload and show partial results', async () => {
      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        fetchCount++;
        const { signal } = opts || {};
        if (fetchCount === 1) {
          // First chunk succeeds
          return {
            ok: true,
            json: () => Promise.resolve({ creados: 250, actualizados: 0, errores: 0 })
          };
        }
        // Second chunk hangs until aborted
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          const onAbort = () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      // Start upload (non-blocking await — upload promise will hang on second chunk)
      let uploadPromise;
      await act(async () => {
        uploadPromise = result.current.upload(createProducts(500));
      });

      // Wait for first chunk to complete
      await waitFor(() => {
        expect(result.current.results.chunksCompletados).toBe(1);
      });

      // Cancel mid-upload
      await act(async () => {
        result.current.cancel();
      });

      // Wait for cancelled state
      await waitFor(() => {
        expect(result.current.state).toBe('cancelled');
      });
      expect(result.current.results.creados).toBe(250);
      expect(result.current.results.chunksCompletados).toBe(1);
    });

    it('should set cancelled state immediately when cancel called during uploading', async () => {
      // Upload that never resolves
      global.fetch = vi.fn().mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        result.current.upload(createProducts(500));
      });

      await act(async () => {
        result.current.cancel();
      });

      await waitFor(() => expect(result.current.state).toBe('cancelled'));
    });
  });

  // ── Task 1.5: Progress Calculation ──
  describe('Task 1.5: Progress calculation', () => {
    it('should update progress after each chunk in multi-chunk upload', async () => {
      let chunkIndex = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        chunkIndex++;
        return {
          ok: true,
          json: () => Promise.resolve({ creados: 250, actualizados: 0, errores: 0 })
        };
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(500));
      });

      // Final state: 2/2 chunks, 100%
      expect(result.current.progress.currentChunk).toBe(2);
      expect(result.current.progress.totalChunks).toBe(2);
      expect(result.current.progress.percent).toBe(100);
      expect(result.current.progress.processedProducts).toBe(500);
    });

    it('should show correct intermediate progress during multi-chunk upload', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        callCount++;
        const { signal } = opts || {};
        if (callCount === 1) {
          return {
            ok: true,
            json: () => Promise.resolve({ creados: 250, actualizados: 0, errores: 0 })
          };
        }
        // Second chunk hangs so we can observe intermediate state
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        });
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      result.current.upload(createProducts(500));

      // After first chunk resolves, check intermediate progress
      await waitFor(() => {
        expect(result.current.progress.currentChunk).toBe(1);
        expect(result.current.progress.percent).toBe(50);
        expect(result.current.progress.processedProducts).toBe(250);
      });
    });

    it('should show 100% for single chunk upload (<250 products)', async () => {
      const { mock } = createFetchMock([
        { creados: 50, actualizados: 0, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(50));
      });

      expect(result.current.progress.percent).toBe(100);
      expect(result.current.progress.currentChunk).toBe(1);
      expect(result.current.progress.totalChunks).toBe(1);
      expect(result.current.progress.processedProducts).toBe(50);
    });
  });

  // ── Retry / Skip from paused state ──
  describe('retryChunk and skipChunk from paused state', () => {
    it('should retry the same chunk when retryChunk is called', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts <= 2) {
          throw new Error('Timeout'); // initial double failure
        }
        return {
          ok: true,
          json: () => Promise.resolve({ creados: 250, actualizados: 0, errores: 0 })
        };
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(250));
      });

      expect(result.current.state).toBe('paused');
      expect(global.fetch).toHaveBeenCalledTimes(2);

      await act(async () => {
        await result.current.retryChunk();
      });

      await waitFor(() => expect(result.current.state).toBe('done'));
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should skip the failed chunk and continue when skipChunk is called', async () => {
      let chunkId = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        chunkId++;
        if (chunkId <= 2) {
          throw new Error('Timeout'); // chunk 0 fails twice
        }
        // Chunk 1 succeeds
        return {
          ok: true,
          json: () => Promise.resolve({ creados: 250, actualizados: 0, errores: 0 })
        };
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(500));
      });

      expect(result.current.state).toBe('paused');
      expect(result.current.results.creados).toBe(0); // nothing succeeded yet

      await act(async () => {
        await result.current.skipChunk();
      });

      await waitFor(() => expect(result.current.state).toBe('done'));
      // Only the second chunk succeeded
      expect(result.current.results.creados).toBe(250);
      expect(result.current.results.chunksCompletados).toBe(1);
    });
  });

  // ── Results Aggregation ──
  describe('Results aggregation across chunks', () => {
    it('should aggregate creados, actualizados, errores from multiple chunks', async () => {
      const { mock } = createFetchMock([
        { creados: 100, actualizados: 150, errores: 0 },
        { creados: 200, actualizados: 50, errores: 2 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(500));
      });

      expect(result.current.results.creados).toBe(300);
      expect(result.current.results.actualizados).toBe(200);
      expect(result.current.results.errores).toBe(2);
      expect(result.current.results.chunksCompletados).toBe(2);
      expect(result.current.results.totalChunks).toBe(2);
    });

    it('should show partial aggregation when cancelled', async () => {
      let fetchCount = 0;
      global.fetch = vi.fn().mockImplementation(async (_url, opts) => {
        fetchCount++;
        const { signal } = opts || {};
        if (fetchCount === 1) {
          return {
            ok: true,
            json: () => Promise.resolve({ creados: 100, actualizados: 50, errores: 1 })
          };
        }
        // Second chunk hangs
        return new Promise((_resolve, reject) => {
          if (signal?.aborted) {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          }, { once: true });
        });
      });

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        result.current.upload(createProducts(500));
      });

      await waitFor(() => expect(result.current.results.chunksCompletados).toBe(1));

      await act(async () => {
        result.current.cancel();
      });

      await waitFor(() => expect(result.current.state).toBe('cancelled'));
      expect(result.current.results.creados).toBe(100);
      expect(result.current.results.actualizados).toBe(50);
      expect(result.current.results.errores).toBe(1);
      expect(result.current.results.chunksCompletados).toBe(1);
    });
  });

  // ── Reset ──
  describe('reset', () => {
    it('should return to idle state with default values', async () => {
      const { mock } = createFetchMock([
        { creados: 5, actualizados: 0, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(1));
      });

      expect(result.current.state).toBe('done');

      await act(async () => {
        result.current.reset();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.progress.percent).toBe(0);
      expect(result.current.results.creados).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  // ── Edge case: Empty products ──
  describe('Edge cases', () => {
    it('should not make any fetch calls when products array is empty', async () => {
      const { mock } = createFetchMock([]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload([]);
      });

      expect(global.fetch).toHaveBeenCalledTimes(0);
      // State should remain idle (no transition to uploading for empty)
      expect(result.current.state).toBe('idle');
    });
  });

  // ── Verify fetch URL and headers ──
  describe('API call format', () => {
    it('should POST to the correct URL with correct headers', async () => {
      const { mock } = createFetchMock([
        { creados: 1, actualizados: 0, errores: 0 }
      ]);
      global.fetch = mock;

      const { result } = renderHook(() =>
        useChunkedUpload({ apiUrl: API_URL, headers: HEADERS })
      );

      await act(async () => {
        await result.current.upload(createProducts(1));
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://test.com/api/productos/bulk',
        expect.objectContaining({
          method: 'POST',
          headers: HEADERS,
          body: expect.any(String)
        })
      );

      // Verify body structure
      const callArg = global.fetch.mock.calls[0][1];
      const parsedBody = JSON.parse(callArg.body);
      expect(parsedBody).toHaveProperty('productos');
      expect(parsedBody.productos).toHaveLength(1);
    });
  });
});
