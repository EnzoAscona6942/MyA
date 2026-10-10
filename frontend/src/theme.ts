// ============================================================
// THEME - DESIGN TOKENS
// ============================================================
//
// The single owner of the palette, the type scale, the control sizes and
// the font roles. Nothing else in the app writes a colour, a type step or a
// control height: a second declaration is a second source of truth, and this
// file is where that truth lives. Every module imports from here instead of
// redeclaring its own copy.
//
// `index.css :root` declares the same colours as custom properties for the
// shell layer; the two are kept in agreement by a guard in
// `__tests__/pos-ui-contracts.test.ts`.

// ── Paleta de colores ────────────────────────────────────────
//
// These stay literal rather than becoming `var(--token)` references on
// purpose. `C` is consumed in three contexts where a `var()` string is a
// behaviour no test here can observe: SVG presentation attributes, CSSOM
// assignment from hover handlers, and inline style concatenation.
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