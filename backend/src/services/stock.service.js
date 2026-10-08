// ============================================================
// STOCK SERVICE — LÓGICA DE NEGOCIO DE STOCK
// ============================================================

const prisma = require('../lib/prisma')
const { ingresoStockSchema, ingresoStockItemSchema } = require('../schemas')

/**
 * Registrar ingreso de mercadería (reposición de stock)
 */
const procesarIngresoStock = async ({ items, proveedorId, numeroRemito, observaciones }) => {
  // 1. Validar esquema
  const validated = ingresoStockSchema.parse({
    items,
    proveedorId,
    numeroRemito,
    observaciones
  })

  // 2. Obtener productos con locks
  const productoIds = validated.items.map(i => i.productoId)
  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } }
  })

  const productoMap = new Map(productos.map(p => [p.id, p]))

  // 3. Validar items
  for (const item of validated.items) {
    if (!productoMap.has(item.productoId)) {
      throw new Error(`Producto ID ${item.productoId} no encontrado`)
    }
    if (item.cantidad <= 0) {
      throw new Error(`Cantidad inválida para producto ${item.productoId}`)
    }
  }

  // 4. Calcular total
  const total = validated.items.reduce((acc, i) => {
    return acc + (parseFloat(i.precioUnitario) || 0) * parseInt(i.cantidad)
  }, 0)

  // 5. Transacción atómica
  const ingreso = await prisma.$transaction(async (tx) => {
    // Crear registro de ingreso
    const nuevoIngreso = await tx.ingresoStock.create({
      data: {
        proveedorId: proveedorId ? parseInt(proveedorId) : null,
        numeroRemito,
        observaciones,
        total: total || null,
        items: {
          create: validated.items.map(item => ({
            productoId: item.productoId,
            cantidad: parseInt(item.cantidad),
            precioUnitario: item.precioUnitario ? parseFloat(item.precioUnitario) : null
          }))
        }
      },
      include: {
        items: { include: { producto: { select: { nombre: true } } } },
        proveedor: { select: { nombre: true } }
      }
    })

    // Sumar stock a cada producto (actualizar precio si se proporciona precio de compra)
    for (const item of validated.items) {
      const producto = productoMap.get(item.productoId)
      await tx.producto.update({
        where: { id: producto.id },
        data: {
          stock: { increment: item.cantidad }
        }
      })
    }

    return nuevoIngreso
  })

  return ingreso
}

/**
 * Listar historial de ingresos de stock
 */
const listarIngresos = async ({ desde, hasta, skip = 0, take = 20 }) => {
  const whereClause = {}

  if (desde || hasta) {
    whereClause.fecha = {}
    if (desde) whereClause.fecha.gte = new Date(desde)
    if (hasta) whereClause.fecha.lte = new Date(hasta)
  }

  const ingresos = await prisma.ingresoStock.findMany({
    where: whereClause,
    include: {
      items: { include: { producto: { select: { nombre: true, codigoBarras: true } } } },
      proveedor: { select: { nombre: true } }
    },
    orderBy: { fecha: 'desc' },
    skip,
    take
  })

  return ingresos
}

/**
 * Obtener productos con stock bajo (<= stockMinimo)
 */
const obtenerStockBajo = async () => {
  return await prisma.$queryRaw`
    SELECT p.*, c.nombre as categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p."categoriaId" = c.id
    WHERE p.stock <= p."stockMinimo" AND p.activo = true
    ORDER BY p.stock ASC
  `
}

/**
 * Sincronizar stock en masa (verificar discrepancias con el histórico de ventas/ingresos)
 */
const verificarStockDiscordancia = async () => {
  // Calcular stock teórico basado en el histórico
  const stockTeorico = await prisma.$queryRaw`
    SELECT p.id, SUM(CASE WHEN COALESCE(vi.cantidad, 0) > COALESCE(ii.cantidad, 0) THEN p.stock - (vi.cantidad - ii.cantidad) ELSE p.stock END) as stock_teorico
    FROM productos p
    LEFT JOIN venta_items vi ON vi.productoId = p.id
    LEFT JOIN ingreso_stock_items ii ON ii.productoId = p.id
    GROUP BY p.id
  `

  // Comparar con stock actual
  const discrepancias = []
  for (const item of stockTeorico) {
    const productoActual = await prisma.producto.findUnique({ where: { id: item.id } })
    if (productoActual && Math.abs(parseFloat(productoActual.stock) - parseFloat(item.stock_teorico)) > 0) {
      discrepancias.push({
        productoId: item.id,
        nombre: productoActual.nombre,
        stockActual: productoActual.stock,
        stockTeorico: item.stock_teorico,
        diferencia: parseFloat(productoActual.stock) - parseFloat(item.stock_teorico)
      })
    }
  }

  return discrepancias
}

module.exports = {
  procesarIngresoStock,
  listarIngresos,
  obtenerStockBajo,
  verificarStockDiscordancia
}