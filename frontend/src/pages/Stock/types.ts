// ============================================================
// STOCK - TYPES, CONSTANTS & HELPERS
// ============================================================

import type { Producto } from '../../types/api';

// ── Paleta de colores ────────────────────────────────────────
export const C = {
  bg: '#F5F5F3',
  white: '#FFFFFF',
  sidebar: '#0A0A0A',
  text: '#171717',
  textMid: '#52525B',
  textLight: '#A1A1AA',
  border: 'rgba(0,0,0,0.15)',
  accent: '#10B981',
  accentHov: '#059669',
  accentBg: '#D1FAE5',
  danger: '#EF4444',
  dangerBg: '#FEE2E2',
  amber: '#F59E0B',
  amberBg: '#FEF3C7',
  blue: '#3B82F6',
  blueBg: '#DBEAFE'
} as const;

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