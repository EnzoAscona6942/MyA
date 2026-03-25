const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware, soloAdmin } = require('../middlewares/auth')

const router = express.Router()

// GET /api/reportes/ventas-hoy
router.get('/ventas-hoy', authMiddleware, async (req, res) => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const manana = new Date(hoy)
  manana.setDate(manana.getDate() + 1)

  try {
    const [resumen, porMetodo, ultimasVentas] = await Promise.all([
      prisma.venta.aggregate({
        where: { fecha: { gte: hoy, lt: manana }, estado: 'COMPLETADA' },
        _sum: { total: true, descuento: true },
        _count: { id: true }
      }),
      prisma.venta.groupBy({
        by: ['metodoPago'],
        where: { fecha: { gte: hoy, lt: manana }, estado: 'COMPLETADA' },
        _sum: { total: true },
        _count: { id: true }
      }),
      prisma.venta.findMany({
        where: { fecha: { gte: hoy, lt: manana } },
        include: { items: { include: { producto: { select: { nombre: true } } } } },
        orderBy: { fecha: 'desc' },
        take: 20
      })
    ])

    res.json({
      totalVentas: resumen._sum.total || 0,
      totalDescuentos: resumen._sum.descuento || 0,
      cantidadTransacciones: resumen._count.id,
      ventasPorMetodo: porMetodo,
      ultimasVentas
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reporte del día' })
  }
})

// GET /api/reportes/balance?desde=2024-01-01&hasta=2024-01-31
router.get('/balance', authMiddleware, soloAdmin, async (req, res) => {
  const { desde, hasta } = req.query

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos' })
  }

  try {
    const fechaDesde = new Date(desde)
    const fechaHasta = new Date(hasta)
    fechaHasta.setHours(23, 59, 59, 999)

    const [ventas, ventasPorMetodo, productosMasVendidos] = await Promise.all([
      // Totales del período
      prisma.venta.aggregate({
        where: {
          fecha: { gte: fechaDesde, lte: fechaHasta },
          estado: 'COMPLETADA'
        },
        _sum: { total: true, subtotal: true, descuento: true },
        _count: { id: true }
      }),

      // Desglose por método de pago
      prisma.venta.groupBy({
        by: ['metodoPago'],
        where: {
          fecha: { gte: fechaDesde, lte: fechaHasta },
          estado: 'COMPLETADA'
        },
        _sum: { total: true },
        _count: { id: true }
      }),

      // Top 10 productos más vendidos
      prisma.ventaItem.groupBy({
        by: ['productoId'],
        where: {
          venta: {
            fecha: { gte: fechaDesde, lte: fechaHasta },
            estado: 'COMPLETADA'
          }
        },
        _sum: { cantidad: true, subtotal: true },
        orderBy: { _sum: { cantidad: 'desc' } },
        take: 10
      })
    ])

    // Enriquecer con nombres de productos
    const productosIds = productosMasVendidos.map(p => p.productoId)
    const productos = await prisma.producto.findMany({
      where: { id: { in: productosIds } },
      select: { id: true, nombre: true }
    })

    const topProductos = productosMasVendidos.map(item => ({
      ...item,
      producto: productos.find(p => p.id === item.productoId)
    }))

    res.json({
      periodo: { desde, hasta },
      resumen: {
        totalBruto: ventas._sum.subtotal || 0,
        totalDescuentos: ventas._sum.descuento || 0,
        totalNeto: ventas._sum.total || 0,
        cantidadVentas: ventas._count.id
      },
      ventasPorMetodo,
      topProductos
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al generar balance' })
  }
})

// GET /api/reportes/ventas-por-dia?desde=2024-01-01&hasta=2024-01-31
router.get('/ventas-por-dia', authMiddleware, async (req, res) => {
  const { desde, hasta } = req.query

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Los parámetros desde y hasta son requeridos' })
  }

  try {
    const resultado = await prisma.$queryRaw`
      SELECT 
        DATE(fecha) as dia,
        COUNT(id)::int as cantidad_ventas,
        SUM(total) as total
      FROM ventas
      WHERE 
        fecha >= ${new Date(desde)} 
        AND fecha <= ${new Date(hasta + 'T23:59:59')}
        AND estado = 'COMPLETADA'
      GROUP BY DATE(fecha)
      ORDER BY dia ASC
    `
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ventas por día' })
  }
})

// GET /api/reportes/stock — estado actual del stock
router.get('/stock', authMiddleware, async (req, res) => {
  try {
    const [todos, stockBajo, sinStock] = await Promise.all([
      prisma.producto.count({ where: { activo: true } }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int as cantidad 
        FROM productos 
        WHERE stock <= "stockMinimo" AND stock > 0 AND activo = true
      `,
      prisma.producto.count({ where: { activo: true, stock: 0 } })
    ])

    const productosBajoStock = await prisma.$queryRaw`
      SELECT id, nombre, stock, "stockMinimo", "codigoBarras"
      FROM productos
      WHERE stock <= "stockMinimo" AND activo = true
      ORDER BY stock ASC
    `

    res.json({
      totalProductos: todos,
      stockBajo: stockBajo[0]?.cantidad || 0,
      sinStock,
      productosBajoStock
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener reporte de stock' })
  }
})

// GET /api/reportes/categorias — ventas por categoría
router.get('/categorias', authMiddleware, async (req, res) => {
  const { desde, hasta } = req.query

  try {
    const resultado = await prisma.$queryRaw`
      SELECT 
        c.nombre as categoria,
        COUNT(vi.id)::int as cantidad_items,
        SUM(vi.subtotal) as total
      FROM venta_items vi
      JOIN productos p ON vi."productoId" = p.id
      LEFT JOIN categorias c ON p."categoriaId" = c.id
      JOIN ventas v ON vi."ventaId" = v.id
      WHERE 
        v.estado = 'COMPLETADA'
        ${desde ? prisma.$raw`AND v.fecha >= ${new Date(desde)}` : prisma.$raw``}
        ${hasta ? prisma.$raw`AND v.fecha <= ${new Date(hasta + 'T23:59:59')}` : prisma.$raw``}
      GROUP BY c.nombre
      ORDER BY total DESC
    `
    res.json(resultado)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ventas por categoría' })
  }
})

module.exports = router
