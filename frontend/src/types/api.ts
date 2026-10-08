// ============================================================
// API TYPES - Auto-generados desde Swagger/OpenAPI
// NOTA: Actualizar manualmente cuando cambie el backend
// ============================================================

// ── Auth ────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  rol?: 'ADMIN' | 'CAJERO';
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  usuario: Usuario;
}

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'CAJERO';
  activo: boolean;
  creadoEn: string;
}

// ── Productos ────────────────────────────────────────────────

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string | null;
  codigoBarras?: string | null;
  codigoInterno?: string | null;
  precio: number;
  precioCompra?: number | null;
  stock: number;
  stockMinimo: number;
  unidadMedida: string;
  activo: boolean;
  imagen?: string | null;
  categoriaId?: number | null;
  proveedorId?: number | null;
  categoria?: Categoria;
  proveedor?: Proveedor;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ProductoCreate {
  nombre: string;
  descripcion?: string;
  codigoBarras: string;
  codigoInterno?: string;
  precio?: number;
  precioCompra?: number;
  stock?: number;
  stockMinimo?: number;
  unidadMedida?: string;
  imagen?: string;
  categoriaId?: number;
  proveedorId?: number;
}

export interface ProductoUpdate extends Partial<Omit<ProductoCreate, 'codigoBarras'>> {
  activo?: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string | null;
  creadoEn: string;
}

export interface Proveedor {
  id: number;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  activo: boolean;
  creadoEn: string;
}

// ── Ventas ──────────────────────────────────────────────────

export interface VentaItem {
  productoId: number;
  cantidad: number;
}

export interface VentaCreate {
  cajaId: number;
  items: VentaItem[];
  metodoPago?: 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA' | 'QR';
  descuento?: number;
  montoRecibido?: number;
  observaciones?: string;
}

export interface Venta {
  id: number;
  fecha: string;
  subtotal: number;
  descuento: number;
  total: number;
  metodoPago: 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA' | 'QR';
  montoRecibido?: number | null;
  vuelto?: number | null;
  estado: 'COMPLETADA' | 'ANULADA' | 'PENDIENTE';
  observaciones?: string | null;
  cajaId: number;
  usuarioId: number;
  items: VentaItemDetail[];
  usuario?: Usuario;
  caja?: Caja;
}

export interface VentaItemDetail {
  id: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  producto: Producto;
}

export interface VentaListResponse {
  data: Venta[];
  pagination: Pagination;
}

export type MetodoPago = 'EFECTIVO' | 'TARJETA_DEBITO' | 'TARJETA_CREDITO' | 'TRANSFERENCIA' | 'QR';
export type EstadoVenta = 'COMPLETADA' | 'ANULADA' | 'PENDIENTE';

// ── Caja ────────────────────────────────────────────────────

export interface Caja {
  id: number;
  fechaApertura: string;
  fechaCierre?: string | null;
  montoInicial: number;
  montoFinalReal?: number | null;
  estado: 'ABIERTA' | 'CERRADA';
  observaciones?: string | null;
  usuarioId: number;
  usuario?: Usuario;
  totalVentas?: number;
  cantidadVentas?: number;
}

export interface CajaAbrir {
  montoInicial: number;
  observaciones?: string;
}

export interface CajaClose {
  montoFinalReal: number;
  observaciones?: string;
}

export interface CajaCloseResponse {
  caja: Caja;
  resumen: CajaResumen;
}

export interface CajaResumen {
  montoInicial: number;
  totalVentas: number;
  ventasPorMetodo: VentasPorMetodo[];
  totalIngresos: number;
  totalEgresos: number;
  efectivoEsperado: number;
  montoFinalReal: number;
  diferencia: number;
}

export interface VentasPorMetodo {
  metodoPago: string;
  _sum: { total: number };
  _count: { id: number };
}

// ── Movimientos de Caja ────────────────────────────────────

export interface MovimientoCaja {
  id: number;
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  descripcion: string;
  fecha: string;
  cajaId: number;
}

export interface MovimientoCajaCreate {
  tipo: 'INGRESO' | 'EGRESO';
  monto: number;
  descripcion: string;
}

// ── Stock ──────────────────────────────────────────────────

export interface IngresoStockItem {
  productoId: number;
  cantidad: number;
  precioUnitario?: number | null;
}

export interface IngresoStockCreate {
  items: IngresoStockItem[];
  proveedorId?: number;
  numeroRemito?: string;
  observaciones?: string;
}

export interface IngresoStock {
  id: number;
  fecha: string;
  numeroRemito?: string | null;
  observaciones?: string | null;
  total?: number | null;
  proveedorId?: number | null;
  proveedor?: Proveedor;
  items: IngresoStockItemDetail[];
}

export interface IngresoStockItemDetail {
  id: number;
  cantidad: number;
  precioUnitario?: number | null;
  producto: Producto;
}

// ── Pagination ─────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Error ──────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR';

// ── Health ─────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok';
  proyecto: string;
  version: string;
}

// ── API Client Types ──────────────────────────────────────

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

export interface ApiClient {
  get<T>(url: string, options?: RequestOptions): Promise<T>;
  post<T>(url: string, body: unknown, options?: RequestOptions): Promise<T>;
  put<T>(url: string, body: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(url: string, options?: RequestOptions): Promise<T>;
}