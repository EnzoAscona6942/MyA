// ============================================================
// STOCK - TYPES, CONSTANTS & HELPERS
// ============================================================

import type { Producto } from '../../types/api';

// The palette is owned by the shared theme; it is re-exported here so
// `render.tsx` keeps consuming it alongside the Stock types below.
export { C } from '../../theme';

// ── Tipos ────────────────────────────────────────────────────
export type ActiveTab = 'listado' | 'ingreso';

export interface Filtros {
  busqueda: string;
  categoriaId: string;
  stockBajo: boolean;
}

export interface FormIngreso {
  proveedorId: string;
  numeroRemito: string;
  observaciones: string;
}

/**
 * Fila editable del remito.
 * `cantidad` y `precioUnitario` guardan el string crudo del input;
 * se convierten a number sólo al construir el payload.
 */
export interface ItemIngresoForm {
  productoId: number;
  nombre: string;
  cantidad: number | string;
  precioUnitario: number | string;
}

/** El endpoint de productos responde数组 plano o paginado. */
export type RespuestaProductos = Producto[] | { data: Producto[] };

// ── Helpers ──────────────────────────────────────────────────

/** Acepta ambos formatos de respuesta del endpoint de productos. */
export const normalizarProductos = (res: RespuestaProductos): Producto[] =>
  Array.isArray(res) ? res : res.data ?? [];

/** `categoria` llega como objeto en el formato actual y como string en el legacy. */
export const nombreCategoria = (
  categoria: { nombre: string } | string | null | undefined
): string => {
  if (!categoria) return '-';
  return typeof categoria === 'string' ? categoria : categoria.nombre;
};