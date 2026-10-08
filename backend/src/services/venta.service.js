// ============================================================
// VENTA SERVICE — LÓGICA DE NEGOCIO PRINCIPAL
// ============================================================

const prisma = require('../lib/prisma')
const { ventaSchema, ventaItemSchema } = require('../schemas')
const { NotFoundError, ConflictError } = require('../utils/errors')

/**
 * Crear una venta completa con validación atómica
 */
const crearVenta = async ({ items, cajaId, usuarioId, metodoPago, descuento = 0, observaciones }) => {
  // 1. Validar esquema de entrada
  const validated = ventaSchema.parse({
    items,
    cajaId,
    usuarioId,
    metodoPago,
    descuento
  })

  // 2. Verificar que la caja existe y está abierta
  const caja = await prisma.caja.findUnique({ where: { id: Number(cajaId) } })
  if (!caja) {
    throw new NotFoundError('Caja')
  }
  if (caja.estado !== 'ABIERTA') {
    throw new ConflictError('La caja no está abierta')
  }

  // 3. Obtener productos con locks (SELECT FOR UPDATE para evitar race conditions)
  const productoIds = validated.items.map(i => i.productoId)
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } }
  })

  // 3. Verificar que todos los productos existen y están activos
  const productoMap = new Map(productos.map(p => [p.id, p]))
  for (const item of validated.items) {
    const producto = productoMap.get(item.productoId)
    if (!producto) {
      throw new NotFoundError(`Producto ID ${item.productoId}`)
    }
    if (!producto.activo) {
      throw new ConflictError(`El producto "${producto.nombre}" no está activo`)
    }
    if (producto.stock < item.cantidad) {
      throw new ConflictError(`Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`)
    }
  }

  // 4. Calcular totales dentro de la transacción
  return await prisma.$transaction(async (tx) => {
    // 5. Calcular subtotal
    const subtotal = validated.items.reduce((acc, item) => {
      const producto = productoMap.get(item.productoId)
      return acc + producto.precio * item.cantidad
    }, 0)

    const total = Math.max(0, subtotal - Number(descuento))

    // 6. Crear venta
    const nuevaVenta = await tx.venta.create({
      data: {
        subtotal,
        descuento: Number(descuento),
        total,
        metodoPago: metodoPago || 'EFECTIVO',
        cajaId: Number(cajaId),
        usuarioId: Number(usuarioId),
        observaciones: validated.observaciones,
        items: {
          create: validated.items.map(item => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            precioUnitario: productoMap.get(item.productoId).precio,
            subtotal: productoMap.get(item.productoId).precio * item.cantidad
          }))
        }
      },
      include: {
        items: { include: { producto: true } },
        usuario: { select: { nombre: true } }
      }
    })

    // 7. Descontar stock de cada producto (atómico)
    for (const item of validated.items) {
      const producto = productoMap.get(item.productoId)
      await tx.producto.update({
        where: { id: producto.id },
        data: { stock: { decrement: item.cantidad } }
      })
    }

    return nuevaVenta
  })
}

/**
 * Listar ventas con filtros y paginación
 */
const listarVentas = async ({ from, to, cajaId, estado, skip = 0, take = 20 }) => {
  const whereClause = {}

  if (cajaId) {
    whereClause.cajaId = Number(cajaId)
  }

  if (estado) {
    whereClause.estado = estado
  }

  if (from || to) {
    whereClause.fecha = {}
    if (from) whereClause.fecha.gte = new Date(from)
    if (to) whereClause.fecha.lte = new Date(to)
  }

  // Get total count for pagination
  const total = await prisma.venta.count({ where: whereClause })

  // Get paginated data, ordered by fecha DESC
  const ventas = await prisma.venta.findMany({
    where: whereClause,
    include: {
      items: { include: { producto: { select: { nombre: true } } } },
      usuario: { select: { nombre: true } }
    },
    orderBy: { fecha: 'desc' },
    skip,
    take
  })

  const totalPages = Math.ceil(total / take)
  const currentPage = Math.floor(skip / take) + 1

  return {
    data: ventas,
    pagination: {
      page: currentPage,
      limit: take,
      total,
      totalPages
    }
  }
}

/**
 * Obtener una venta por ID
 */
const obtenerVenta = async ({ ventaId }) => {
  const venta = await prisma.venta.findUnique({
    where: { id: Number(ventaId) },
    include: {
      items: { include: { producto: true } },
      usuario: { select: { nombre: true } },
      caja: true
    }
  })

  if (!venta) {
    throw new NotFoundError('Venta')
  }

  return venta
}

/**
 * Anular una venta y reponer stock
 */
const anularVenta = async ({ ventaId }) => {
  // 1. Obtener venta con items
  const venta = await prisma.venta.findUnique({
    where: { id: Number(ventaId) },
    include: { items: true }
  })

  if (!venta) {
    throw new NotFoundError('Venta')
  }

  if (venta.estado === 'ANULADA') {
    throw new ConflictError('La venta ya está anulada')
  }

  // 2. Reponer stock y actualizar estado en transacción
  await prisma.$transaction(async (tx) => {
    // Anular venta
    await tx.venta.update({
      where: { id: venta.id },
      data: { estado: 'ANULADA' }
    })

    // Reponer stock de cada item
    for (const item of venta.items) {
      await tx.producto.update({
        where: { id: item.productoId },
        data: { stock: { increment: item.cantidad } }
      })
    }
  })

  return { mensaje: 'Venta anulada y stock repuesto correctamente' }
}

module.exports = {
  crearVenta,
  listarVentas,
  obtenerVenta,
  anularVenta
}