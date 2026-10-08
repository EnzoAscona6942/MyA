import { useState, useRef, useCallback } from 'react';

const CHUNK_SIZE = 250;

// ── Tipos públicos ────────────────────────────────────────────
export type UploadState =
  | 'idle'
  | 'uploading'
  | 'paused'
  | 'cancelled'
  | 'done'
  | 'error';

export interface UploadProgress {
  currentChunk: number;
  totalChunks: number;
  processedProducts: number;
  totalProducts: number;
  percent: number;
}

export interface UploadResults {
  creados: number;
  actualizados: number;
  errores: number;
  chunksCompletados: number;
  totalChunks: number;
}

export interface UploadError {
  chunkIndex: number;
  message: string;
  canRetry: boolean;
}

interface UseChunkedUploadOptions {
  apiUrl: string;
  headers: Record<string, string>;
}

/** Respuesta de POST /productos/bulk. Todos los campos son opcionales. */
interface BulkChunkResponse {
  creados?: number;
  actualizados?: number;
  errores?: number;
}

const PROGRESS_INICIAL: UploadProgress = {
  currentChunk: 0,
  totalChunks: 0,
  processedProducts: 0,
  totalProducts: 0,
  percent: 0,
};

const AGGREGADO_INICIAL = { creados: 0, actualizados: 0, errores: 0, chunksCompletados: 0 };

/**
 * Sube lotes de N elementos a POST /productos/bulk de forma secuencial,
 * con un reintento por chunk y pausa manual al segundo fallo consecutivo.
 */
export function useChunkedUpload<T = unknown>({ apiUrl, headers }: UseChunkedUploadOptions) {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState<UploadProgress>(PROGRESS_INICIAL);
  const [results, setResults] = useState<UploadResults>({
    ...AGGREGADO_INICIAL,
    totalChunks: 0,
  });
  const [error, setError] = useState<UploadError | null>(null);

  // Internal refs for the sequential upload loop
  const controllerRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<T[][]>([]);
  const chunkIndexRef = useRef(0);
  const retryCountRef = useRef(0);
  const aggregatedRef = useRef({ ...AGGREGADO_INICIAL });
  const totalProductsRef = useRef(0);
  const totalChunksRef = useRef(0);

  const updateProgress = useCallback(() => {
    const currentChunk = chunkIndexRef.current;
    const totalChunks = totalChunksRef.current;
    const totalProducts = totalProductsRef.current;
    const processedProducts = Math.min(currentChunk * CHUNK_SIZE, totalProducts);
    const percent = Math.round((currentChunk / totalChunks) * 100);
    setProgress({ currentChunk, totalChunks, processedProducts, totalProducts, percent });
  }, []);

  // Retorno explícito: la recursión sobre su propio inicializador obliga a
  // anotar el tipo para que TS no infiera `any`.
  const processNextChunk = useCallback(async (): Promise<void> => {
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted) return;

    const chunks = chunksRef.current;
    const idx = chunkIndexRef.current;

    if (idx >= chunks.length) {
      setState('done');
      return;
    }

    try {
      const chunk = chunks[idx];
      const response = await fetch(`${apiUrl}/productos/bulk`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ productos: chunk }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json() as BulkChunkResponse;

      aggregatedRef.current.creados += data.creados || 0;
      aggregatedRef.current.actualizados += data.actualizados || 0;
      aggregatedRef.current.errores += data.errores || 0;
      aggregatedRef.current.chunksCompletados += 1;

      setResults({
        creados: aggregatedRef.current.creados,
        actualizados: aggregatedRef.current.actualizados,
        errores: aggregatedRef.current.errores,
        chunksCompletados: aggregatedRef.current.chunksCompletados,
        totalChunks: chunks.length
      });

      retryCountRef.current = 0;
      chunkIndexRef.current = idx + 1;
      updateProgress();

      await processNextChunk();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setState('cancelled');
        return;
      }

      if (retryCountRef.current < 1) {
        retryCountRef.current++;
        await processNextChunk(); // retry same chunk (idx not incremented)
        return;
      }

      // Two consecutive failures → pause and wait for user decision
      setError({
        chunkIndex: idx,
        message: err instanceof Error && err.message ? err.message : 'Error de conexión',
        canRetry: true
      });
      setState('paused');
    }
  }, [apiUrl, headers, updateProgress]);

  const upload = useCallback(async (products: T[]) => {
    if (!products || products.length === 0) return;

    // Reset tracking refs
    aggregatedRef.current = { ...AGGREGADO_INICIAL };
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    retryCountRef.current = 0;

    const totalProducts = products.length;
    const totalChunks = Math.ceil(totalProducts / CHUNK_SIZE);
    totalProductsRef.current = totalProducts;
    totalChunksRef.current = totalChunks;

    // Split products into chunks
    for (let i = 0; i < totalProducts; i += CHUNK_SIZE) {
      chunksRef.current.push(products.slice(i, i + CHUNK_SIZE));
    }

    // Set initial state
    setError(null);
    setProgress({ currentChunk: 0, totalChunks, processedProducts: 0, totalProducts, percent: 0 });
    setResults({ ...AGGREGADO_INICIAL, totalChunks });
    setState('uploading');

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      await processNextChunk();
    } catch (err) {
      // Unexpected non-recoverable error (e.g., runtime bug)
      setError({
        chunkIndex: chunkIndexRef.current,
        message: err instanceof Error && err.message ? err.message : 'Error inesperado',
        canRetry: false
      });
      setState('error');
    }
  }, [processNextChunk]);

  const cancel = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setState('cancelled');
  }, []);

  const retryChunk = useCallback(async () => {
    setError(null);
    retryCountRef.current = 0;
    setState('uploading');
    await processNextChunk();
  }, [processNextChunk]);

  const skipChunk = useCallback(async () => {
    chunkIndexRef.current++;
    retryCountRef.current = 0;
    setError(null);
    setState('uploading');
    await processNextChunk();
  }, [processNextChunk]);

  const reset = useCallback(() => {
    controllerRef.current = null;
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    retryCountRef.current = 0;
    aggregatedRef.current = { ...AGGREGADO_INICIAL };
    totalProductsRef.current = 0;
    totalChunksRef.current = 0;
    setState('idle');
    setProgress(PROGRESS_INICIAL);
    setResults({ ...AGGREGADO_INICIAL, totalChunks: 0 });
    setError(null);
  }, []);

  return { state, progress, results, error, upload, cancel, retryChunk, skipChunk, reset };
}