const express = require('express')
const prisma = require('../lib/prisma')
const { authMiddleware } = require('../middlewares/auth')

const router = express.Router()

// GET /api/caja/activa — obtener la caja abierta actualmente
router.get('/activa', authMiddleware, async (req, res) => {
  try {
    const caja = await prisma.caja.findFirst({
      where: { estado: 'ABIERTA' },
      include: {
        usuario: { select: { nombre: true } },
        movimientos: true
      }
    })

    if (!caja) return res.status(404).json({ error: 'No hay una caja abierta' })

    // Calcular totales de ventas de la caja activa
    const resumen = await prisma.venta.aggregate({
      where: { cajaId: caja.id, estado: 'COMPLETADA' },
      _sum: { total: true },
      _count: { id: true }
    })

    res.json({
      ...caja,
      totalVentas: resumen._sum.total || 0,
      cantidadVentas: resumen._count.id
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener caja activa' })
  }
})

// POST /api/caja/abrir — abrir caja
router.post('/abrir', authMiddleware, async (req, res) => {
  const { montoInicial } = req.body

  if (montoInicial === undefined || montoInicial === null) {
    return res.status(400).json({ error: 'El monto inicial es requerido' })
  }

  try {
    // Verificar que no haya otra caja abierta
    const cajaAbierta = await prisma.caja.findFirst({ where: { estado: 'ABIERTA' } })
    if (cajaAbierta) {
      return res.status(400).json({ error: 'Ya hay una caja abierta. Cerrala antes de abrir una nueva.' })
    }

    const caja = await prisma.caja.create({
      data: {
        montoInicial: parseFloat(montoInicial),
        usuarioId: req.usuario.id
      },
      include: { usuario: { select: { nombre: true } } }
    })

    res.status(201).json(caja)
  } catch (err) {
    res.status(500).json({ error: 'Error al abrir caja' })
  }
})

// POST /api/caja/:id/cerrar — cerrar caja con resumen
router.post('/:id/cerrar', authMiddleware, async (req, res) => {
  const { montoFinalReal, observaciones } = req.body
  const cajaId = parseInt(req.params.id)

  if (montoFinalReal === undefined || montoFinalReal === null) {
    return res.status(400).json({ error: 'El monto final real es requerido' })
  }

  try {
    const caja = await prisma.caja.findUnique({ where: { id: cajaId } })
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' })
    if (caja.estado === 'CERRADA') return res.status(400).json({ error: 'La caja ya está cerrada' })

    // Calcular resumen de ventas por método de pago
    const ventasPorMetodo = await prisma.venta.groupBy({
      by: ['metodoPago'],
      where: { cajaId, estado: 'COMPLETADA' },
      _sum: { total: true },
      _count: { id: true }
    })

    const totalVentas = ventasPorMetodo.reduce((acc, v) => acc + parseFloat(v._sum.total || 0), 0)

    // Calcular movimientos manuales
    const movimientos = await prisma.movimientoCaja.findMany({ where: { cajaId } })
    const totalIngresos = movimientos
      .filter(m => m.tipo === 'INGRESO')
      .reduce((acc, m) => acc + parseFloat(m.monto), 0)
    const totalEgresos = movimientos
      .filter(m => m.tipo === 'EGRESO')
      .reduce((acc, m) => acc + parseFloat(m.monto), 0)

    // Efectivo esperado = monto inicial + ventas en efectivo + ingresos manuales - egresos
    const ventasEfectivo = ventasPorMetodo
      .find(v => v.metodoPago === 'EFECTIVO')?._sum?.total || 0
    const efectivoEsperado =
      parseFloat(caja.montoInicial) + parseFloat(ventasEfectivo) + totalIngresos - totalEgresos

    const diferencia = parseFloat(montoFinalReal) - efectivoEsperado

    const cajaCerrada = await prisma.caja.update({
      where: { id: cajaId },
      data: {
        estado: 'CERRADA',
        fechaCierre: new Date(),
        montoFinalReal: parseFloat(montoFinalReal),
        observaciones
      }
    })

    res.json({
      caja: cajaCerrada,
      resumen: {
        montoInicial: caja.montoInicial,
        totalVentas,
        ventasPorMetodo,
        totalIngresos,
        totalEgresos,
        efectivoEsperado,
        montoFinalReal: parseFloat(montoFinalReal),
        diferencia
      }
    })
  } catch (err) {
    res.status(500).json({ error: 'Error al cerrar caja' })
  }
})

// POST /api/caja/:id/movimiento — registrar ingreso o egreso manual
router.post('/:id/movimiento', authMiddleware, async (req, res) => {
  const { tipo, monto, descripcion } = req.body
  const cajaId = parseInt(req.params.id)

  if (!tipo || !monto || !descripcion) {
    return res.status(400).json({ error: 'Tipo, monto y descripción son requeridos' })
  }

  if (!['INGRESO', 'EGRESO'].includes(tipo)) {
    return res.status(400).json({ error: 'Tipo debe ser INGRESO o EGRESO' })
  }

  try {
    const caja = await prisma.caja.findUnique({ where: { id: cajaId } })
    if (!caja || caja.estado !== 'ABIERTA') {
      return res.status(400).json({ error: 'No hay caja abierta con ese ID' })
    }

    const movimiento = await prisma.movimientoCaja.create({
      data: { tipo, monto: parseFloat(monto), descripcion, cajaId }
    })

    res.status(201).json(movimiento)
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar movimiento' })
  }
})

// GET /api/caja — historial de cajas
router.get('/', authMiddleware, async (req, res) => {
  const { desde, hasta } = req.query

  try {
    const cajas = await prisma.caja.findMany({
      where: {
        ...(desde || hasta) && {
          fechaApertura: {
            ...(desde && { gte: new Date(desde) }),
            ...(hasta && { lte: new Date(hasta) })
          }
        }
      },
      include: { usuario: { select: { nombre: true } } },
      orderBy: { fechaApertura: 'desc' }
    })
    res.json(cajas)
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener historial de cajas' })
  }
})

module.exports = router
