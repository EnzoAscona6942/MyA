const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware } = require('../middlewares/auth')
const { body, param, validationResult } = require('express-validator')

const router = express.Router()

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Error de validación',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    })
  }
  next()
}

// POST /api/ventas — registrar una venta completa
router.post('/',
  authMiddleware,
  [
    body('cajaId').isInt().withMessage('El ID de caja es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Los items de la venta son requeridos'),
    body('metodoPago').optional().isIn(['EFECTIVO', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'TRANSFERENCIA', 'QR']).withMessage('Método de pago inválido'),
    body('montoRecibido').optional().isFloat({ min: 0 }).withMessage('El monto recibido debe ser un número positivo'),
    body('descuento').optional().isFloat({ min: 0 }).withMessage('El descuento debe ser un número positivo')
  ],
  validate,
  async (req, res) => {
    const { items, metodoPago, descuento, montoRecibido, cajaId, observaciones } = req.body

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'La venta debe tener al menos un item' })
    }

    if (!cajaId) {
      return res.status(400).json({ error: 'Debe haber una caja abierta' })
    }

    try {
    // Verificar que la caja esté abierta
    const caja = await prisma.caja.findUnique({ where: { id: parseInt(cajaId) } })
    if (!caja || caja.estado !== 'ABIERTA') {
      return res.status(400).json({ error: 'No hay una caja abierta' })
    }

    // Verificar stock y obtener precios actuales
    const productosIds = items.map(i => parseInt(i.productoId))
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } }
    })

    for (const item of items) {
      const producto = productos.find(p => p.id === parseInt(item.productoId))
      if (!producto) {
        return res.status(404).json({ error: `Producto ID ${item.productoId} no encontrado` })
      }
      if (!producto.activo) {
        return res.status(400).json({ error: `El producto "${producto.nombre}" no está activo` })
      }
      if (producto.stock < parseInt(item.cantidad)) {
        return res.status(400).json({
          error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}`
        })
      }
    }

    // Calcular totales
    const descuentoVal = parseFloat(descuento) || 0
    const subtotal = items.reduce((acc, item) => {
      const producto = productos.find(p => p.id === parseInt(item.productoId))
      return acc + parseFloat(producto.precio) * parseInt(item.cantidad)
    }, 0)

    const total = subtotal - descuentoVal
    const vuelto = montoRecibido ? parseFloat(montoRecibido) - total : null

    // Crear venta + items + descontar stock en una transacción
    const venta = await prisma.$transaction(async (tx) => {
      const nuevaVenta = await tx.venta.create({
        data: {
          subtotal,
          descuento: descuentoVal,
          total,
          metodoPago: metodoPago || 'EFECTIVO',
          montoRecibido: montoRecibido ? parseFloat(montoRecibido) : null,
          vuelto,
          cajaId: parseInt(cajaId),
          usuarioId: req.usuario.id,
          observaciones,
          items: {
            create: items.map(item => {
              const producto = productos.find(p => p.id === parseInt(item.productoId))
              const cantidad = parseInt(item.cantidad)
              return {
                productoId: producto.id,
                cantidad,
                precioUnitario: producto.precio,
                subtotal: parseFloat(producto.precio) * cantidad
              }
            })
          }
        },
        include: {
          items: { include: { producto: true } },
          usuario: { select: { nombre: true } }
        }
      })

      // Descontar stock de cada producto
      for (const item of items) {
        await tx.producto.update({
          where: { id: parseInt(item.productoId) },
          data: { stock: { decrement: parseInt(item.cantidad) } }
        })
      }

      return nuevaVenta
    })

    res.status(201).json(venta)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar la venta' })
  }
})

// GET /api/ventas — listar ventas (con filtros por fecha, caja y paginación)
router.get('/', authMiddleware, async (req, res) => {
  const { from, to, cajaId, estado, skip, take } = req.query

  // Default pagination: 20 items per page
  const pageSize = take ? parseInt(take) : 20
  const offset = skip ? parseInt(skip) : 0

  try {
    const whereClause = {}

    if (cajaId) {
      whereClause.cajaId = parseInt(cajaId)
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
      skip: offset,
      take: pageSize
    })

    const totalPages = Math.ceil(total / pageSize)
    const currentPage = Math.floor(offset / pageSize) + 1

    res.json({
      data: ventas,
      pagination: {
        page: currentPage,
        limit: pageSize,
        total,
        totalPages
      }
    })
  } catch (err) {
    console.error('Error fetching ventas:', err)
    res.status(500).json({ error: 'Error al obtener ventas' })
  }
})

// GET /api/ventas/:id — detalle de una venta
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: { include: { producto: true } },
        usuario: { select: { nombre: true } },
        caja: true
      }
    })
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' })
    res.json(venta)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la venta' })
  }
})

// PUT /api/ventas/:id/anular — anular una venta y reponer stock
router.put('/:id/anular', authMiddleware, async (req, res) => {
  try {
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { items: true }
    })

    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' })
    if (venta.estado === 'ANULADA') {
      return res.status(400).json({ error: 'La venta ya está anulada' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.venta.update({
        where: { id: venta.id },
        data: { estado: 'ANULADA' }
      })

      // Reponer stock
      for (const item of venta.items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { increment: item.cantidad } }
        })
      }
    })

    res.json({ mensaje: 'Venta anulada y stock repuesto correctamente' })
  } catch (err) {
    res.status(500).json({ error: 'Error al anular la venta' })
  }
})

module.exports = router
