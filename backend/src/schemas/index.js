// ============================================================
// ZOD SCHEMAS — VALIDACIÓN CENTRALIZADA (JavaScript)
// ============================================================

const { z } = require('zod')

// ── Helpers ──────────────────────────────────────────────────
const positiveInt = z.number().int().positive()
const nonNegativeInt = z.number().int().min(0)
const positiveFloat = z.number().positive()
const nonNegativeFloat = z.number().min(0)
const email = z.string().email('Email inválido')
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe tener al menos una mayúscula')
  .regex(/[a-z]/, 'La contraseña debe tener al menos una minúscula')
  .regex(/[0-9]/, 'La contraseña debe tener al menos un número')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe tener al menos un símbolo')

// ── Auth ─────────────────────────────────────────────────────
const loginSchema = z.object({
  email,
  password: z.string().min(1, 'La contraseña es requerida')
})

const registerSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  email,
  password,
  rol: z.enum(['ADMIN', 'CAJERO']).default('CAJERO')
})

// ── Productos ────────────────────────────────────────────────
const productoSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(200),
  descripcion: z.string().max(500).optional(),
  codigoBarras: z.string().max(50).optional(),
  codigoInterno: z.string().max(50).optional(),
  precio: nonNegativeFloat.default(0),
  precioCompra: nonNegativeFloat.optional(),
  stock: nonNegativeInt.default(0),
  stockMinimo: nonNegativeInt.default(5),
  unidadMedida: z.string().default('unidad'),
  imagen: z.string().url().optional(),
  categoriaId: positiveInt.optional(),
  proveedorId: positiveInt.optional()
})

const productoCreateSchema = productoSchema
const productoUpdateSchema = productoSchema.partial()

// ── Ventas ───────────────────────────────────────────────────
const ventaItemSchema = z.object({
  productoId: positiveInt,
  cantidad: positiveInt
})

const ventaSchema = z.object({
  cajaId: positiveInt,
  items: z.array(ventaItemSchema).min(1, 'La venta debe tener al menos un item'),
  metodoPago: z.enum(['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR']).default('EFECTIVO'),
  descuento: nonNegativeFloat.default(0),
  montoRecibido: nonNegativeFloat.optional(),
  observaciones: z.string().max(500).optional()
})

// ── Caja ─────────────────────────────────────────────────────
const cajaAbrirSchema = z.object({
  montoInicial: positiveFloat,
  observaciones: z.string().max(500).optional()
})

const cajaCloseSchema = z.object({
  montoFinalReal: nonNegativeFloat,
  observaciones: z.string().max(500).optional()
})

const movimientoCajaSchema = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO']),
  monto: positiveFloat,
  descripcion: z.string().min(1, 'La descripción es requerida').max(200)
})

// ── Stock ────────────────────────────────────────────────────
const ingresoStockItemSchema = z.object({
  productoId: positiveInt,
  cantidad: positiveInt,
  precioUnitario: nonNegativeFloat.optional()
})

const ingresoStockSchema = z.object({
  items: z.array(ingresoStockItemSchema).min(1, 'El ingreso debe tener al menos un item'),
  proveedorId: positiveInt.optional(),
  numeroRemito: z.string().max(50).optional(),
  observaciones: z.string().max(500).optional()
})

// ── Query params ─────────────────────────────────────────────
// Express entrega los query params SIEMPRE como string, por eso estos
// necesitan `.coerce()`; sin él cualquier `?skip=0` se rechaza con 400.
const paginationSchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  take: z.coerce.number().int().positive().max(100).default(20)
})

// ── ID param ─────────────────────────────────────────────────
const idParamSchema = z.object({
  id: positiveInt
})

// ── Busqueda ─────────────────────────────────────────────────
const busquedaSchema = z.object({
  busqueda: z.string().max(100).optional(),
  categoriaId: positiveInt.optional(),
  stockBajo: z.boolean().optional(),
  activo: z.boolean().optional()
})

module.exports = {
  // Auth
  loginSchema,
  registerSchema,
  // Productos
  productoSchema,
  productoCreateSchema,
  productoUpdateSchema,
  // Ventas
  ventaItemSchema,
  ventaSchema,
  // Caja
  cajaAbrirSchema,
  cajaCloseSchema,
  movimientoCajaSchema,
  // Stock
  ingresoStockItemSchema,
  ingresoStockSchema,
  // Query
  paginationSchema,
  idParamSchema,
  busquedaSchema
}