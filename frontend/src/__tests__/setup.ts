/* eslint-disable no-undef */
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { Mock } from 'vitest';

// Mock localStorage
//
// `localStorageMock` se tipa como `Storage` (lib.dom) porque
// `Object.defineProperty(window, 'localStorage', ...)` valida el valor contra
// esa interfaz. El wrapper original solo cubría get/set/remove/clear; `length`
// y `key()` se agregan aquí para completarla. Nada en `src` los lee (solo se
// usan getItem/setItem/removeItem/clear), así que el agregado es inerte.
const localStorageMock: Storage = (() => {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    // `?? null` en vez de `as`: `noUncheckedIndexedAccess` tipa el acceso como
    // `string | undefined` y la interfaz exige `string | null`.
    key: (index: number) => Object.keys(store)[index] ?? null,
    // Se conserva el `||` original (no `??`): un valor vacío debe devolver
    // `null`, igual que antes de la migración.
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch global
//
// `global.fetch` conserva la firma real de DOM/Node, que un `vi.fn()` sin tipar
// no satisface. Mismo límite único `as unknown as typeof fetch` que usan los
// tests de hook, en lugar de repetir el cast en cada uso.
const installFetch = (mock: Mock): void => {
  global.fetch = mock as unknown as typeof fetch;
};

installFetch(vi.fn());

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // El original usaba `args[0]?.includes?.('Warning:')`, una llamada opcional
  // sobre un valor `any`. Con `unknown[]` se traduce a un guard de `string`,
  // que es el único caso real (React emite las advertencias como string).
  const first = args[0];
  if (typeof first === 'string' && first.includes('Warning:')) return;
  originalConsoleError(...args);
};