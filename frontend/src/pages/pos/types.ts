// ============================================================
// POS - TYPES & CONSTANTS
// ============================================================

import type { Producto, Caja, Venta } from '../../types/api';

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

// ── Typography ───────────────────────────────────────────────
export const FS = {
  xs: 12,      // captions: stock, barcode, metadata, sidebar date/role
  sm: 13,      // labels, secondary lines, count badge
  base: 15,    // product names, body copy
  md: 17,      // emphasised values
  lg: 20,      // section headings ("Carrito", "Confirmar pago")
  xl: 24,      // page title ("Punto de Venta")
  display: 34  // the amount in the payment modal
} as const;

export const SZ = {
  target: 34,      // interactive control height (mouse-comfortable)
  cartMin: 360,
  cartMax: 460
} as const;

// Single owner of the two font roles: Sora for text, DM Mono for figures.
export const FONT = {
  sans: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  mono: 'var(--font-mono, ui-monospace, Cascadia Mono, monospace)'
} as const;

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