// ============================================================
// POS - TYPES & CONSTANTS
// ============================================================

import type { Producto, Caja, Venta } from '../../types/api';

// The palette, the type scale, the control sizes and the font roles are owned
// by the shared theme. They are re-exported here so every POS module keeps
// importing them from './types' and no POS component changes.
export { C, FONT, FS, SZ } from '../../theme';

// ── Nav items ────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: 'pos', label: 'Caja / POS', iconName: 'ShopIcon' },
  { id: 'stock', label: 'Stock', iconName: 'BoxIcon' },
  { id: 'caja', label: 'Cierre de Caja', iconName: 'CajaIcon' },
  { id: 'reportes', label: 'Reportes', iconName: 'ChartIcon' },
  { id: 'productos', label: 'Productos', iconName: 'TagIcon' },
  { id: 'ventas', label: 'Ventas', iconName: 'TagIcon' },
  { id: 'usuarios', label: 'Usuarios', iconName: 'TagIcon' },
  { id: 'audit', label: 'Auditoría', iconName: 'TagIcon' },
] as const;

export type NavItem = typeof NAV_ITEMS[number];

// ── Tipos locales ────────────────────────────────────────────
export interface CartItem extends Producto {
  cantidad: number;
}

export interface VentaFront {
  id: number;
  items: Array<{
    nombre: string;
    cantidad: number;
    subtotal: number;
  }>;
  total: number;
  metodo: string;
  vuelto: number;
}

export interface CajaActiva extends Caja {
  totalVentas: number;
  cantidadVentas: number;
}

export type ModalType = null | 'pago' | 'ticket';
export type MetodoPago = 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA' | 'QR';

export const METODOS_PAGO = [
  { id: 'EFECTIVO', label: 'Efectivo' },
  { id: 'TARJETA_DEBITO', label: 'Débito' },
  { id: 'TARJETA_CREDITO', label: 'Crédito' },
  { id: 'TRANSFERENCIA', label: 'Transferencia' },
  { id: 'QR', label: 'QR' },
] as const;

// ── Helpers ──────────────────────────────────────────────────
export const fmt = (n: number): string =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(n);

export const now = (): string =>
  new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

export const today = (): string =>
  new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });