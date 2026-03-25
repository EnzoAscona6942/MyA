const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')

const router = express.Router()

// POST /api/stock/ingreso — registrar ingreso de mercadería
router.post('/ingreso', authMiddleware, soloAdmin, async (req, res) => {
  const { items, proveedorId, numeroRemito, observaciones } = req.body

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'El ingreso debe tener al menos un item' })
  }

  try {
    const total = items.reduce((acc, i) => {
      return acc + (parseFloat(i.precioUnitario) || 0) * parseInt(i.cantidad)
    }, 0)

    const ingreso = await prisma.$transaction(async (tx) => {
      const nuevoIngreso = await tx.ingresoStock.create({
        data: {
          proveedorId: proveedorId ? parseInt(proveedorId) : null,
          numeroRemito,
          observaciones,
          total: total || null,
          items: {
            create: items.map(item => ({
              productoId: parseInt(item.productoId),
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

      // Sumar stock a cada producto
      for (const item of items) {
        await tx.producto.update({
          where: { id: parseInt(item.productoId) },
          data: { stock: { increment: parseInt(item.cantidad) } }
        })
      }

      return nuevoIngreso
    })

    res.status(201).json(ingreso)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Error al registrar ingreso de stock' })
  }
})

// GET /api/stock/ingresos — historial de ingresos
router.get('/ingresos', authMiddleware, async (req, res) => {
  const { desde, hasta } = req.query

  try {
    const ingresos = await prisma.ingresoStock.findMany({
      where: {
        ...(desde || hasta) && {
          fecha: {
            ...(desde && { gte: new Date(desde) }),
            ...(hasta && { lte: new Date(hasta) })
          }
        }
      },
      include: {
        items: { include: { producto: { select: { nombre: true, codigoBarras: true } } } },
        proveedor: { select: { nombre: true } }
      },
      orderBy: { fecha: 'desc' }
    })
    res.json(ingresos)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ingresos de stock' })
  }
})

module.exports = router
